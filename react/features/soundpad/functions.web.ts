export const MAX_SOUND_DURATION_SECONDS = 10;
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;
export const SOUNDPAD_MESSAGE = 'voice-soundpad-v1';

const BASE64_CHUNK_LENGTH = 12_000;
const MAX_BASE64_LENGTH = 4 * Math.ceil(MAX_SOUND_BYTES / 3);
const MAX_SOUND_PARTS = Math.ceil(MAX_BASE64_LENGTH / BASE64_CHUNK_LENGTH);
const MAX_PENDING_SOUNDS = 32;
const PENDING_SOUND_TTL = 15_000;
const DB_NAME = 'jitsi-soundpad';
const STORE_NAME = 'sounds';

export interface ISoundpadSound {
    accountId: number;
    createdAt: number;
    data: Blob;
    duration: number;
    id: string;
    name: string;
    type: string;
}

export interface ISoundpadMessage {
    label: string;
    mimeType: string;
    name: typeof SOUNDPAD_MESSAGE;
    part: number;
    parts: number;
    payload: string;
    soundId: string;
}

interface IPendingSound {
    chunks: Array<string | undefined>;
    expiresAt: number;
    label: string;
    mimeType: string;
    received: number;
}

const blockedParticipants = new Set<string>();
const pendingSounds = new Map<string, IPendingSound>();
const playingSounds = new Map<string, Set<HTMLAudioElement>>();

function openDatabase(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });

            store.createIndex('accountId', 'accountId');
        };
    });
}

export async function getSoundpadSounds(accountId: number): Promise<ISoundpadSound[]> {
    const database = await openDatabase();

    return new Promise<ISoundpadSound[]>((resolve, reject) => {
        const request = database.transaction(STORE_NAME).objectStore(STORE_NAME)
            .index('accountId').getAll(accountId);

        request.onerror = () => {
            database.close();
            reject(request.error);
        };
        request.onsuccess = () => {
            database.close();
            resolve((request.result as ISoundpadSound[]).sort((a, b) => a.createdAt - b.createdAt));
        };
    });
}

export async function saveSoundpadSound(sound: ISoundpadSound): Promise<void> {
    const database = await openDatabase();

    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');

        transaction.objectStore(STORE_NAME).put(sound);
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
    }).finally(() => database.close());
}

export async function deleteSoundpadSound(id: string): Promise<void> {
    const database = await openDatabase();

    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');

        transaction.objectStore(STORE_NAME).delete(id);
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
    }).finally(() => database.close());
}

export function getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        const url = URL.createObjectURL(file);
        let settled = false;
        const finish = (duration?: number) => {
            if (settled) {
                return;
            }
            settled = true;
            audio.onerror = null;
            audio.onloadedmetadata = null;
            URL.revokeObjectURL(url);
            audio.removeAttribute('src');
            audio.load();

            if (duration) {
                resolve(duration);
            } else {
                reject(new Error('Invalid audio file.'));
            }
        };

        audio.onerror = () => finish();
        audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : undefined);
        audio.preload = 'metadata';
        audio.src = url;
    });
}

export function splitSoundpadPayload(payload: string): string[] {
    if (!payload || payload.length > MAX_BASE64_LENGTH) {
        throw new Error('Sound payload is too large.');
    }

    const chunks = [];

    for (let offset = 0; offset < payload.length; offset += BASE64_CHUNK_LENGTH) {
        chunks.push(payload.slice(offset, offset + BASE64_CHUNK_LENGTH));
    }

    return chunks;
}

export function isSoundpadMessage(data: unknown): data is ISoundpadMessage {
    const message = data as Partial<ISoundpadMessage> | undefined;

    return message?.name === SOUNDPAD_MESSAGE
        && typeof message.soundId === 'string'
        && /^[\w-]{1,64}$/.test(message.soundId)
        && typeof message.mimeType === 'string'
        && /^audio\/[\w.+-]{1,64}$/.test(message.mimeType)
        && typeof message.label === 'string'
        && message.label.length <= 80
        && Number.isInteger(message.part)
        && Number.isInteger(message.parts)
        && Number(message.part) >= 0
        && Number(message.parts) > 0
        && Number(message.parts) <= MAX_SOUND_PARTS
        && Number(message.part) < Number(message.parts)
        && typeof message.payload === 'string'
        && message.payload.length > 0
        && message.payload.length <= BASE64_CHUNK_LENGTH
        && /^[A-Za-z0-9+/]*={0,2}$/.test(message.payload);
}

export function isSoundpadBlocked(participantId: string): boolean {
    return blockedParticipants.has(participantId);
}

export function setSoundpadBlocked(participantId: string, blocked: boolean) {
    if (blocked) {
        blockedParticipants.add(participantId);
        pendingSounds.forEach((_sound, key) => key.startsWith(`${participantId}:`) && pendingSounds.delete(key));
        playingSounds.get(participantId)?.forEach(audio => audio.pause());
        playingSounds.delete(participantId);
    } else {
        blockedParticipants.delete(participantId);
    }
}

export function resetSoundpadSession() {
    blockedParticipants.clear();
    pendingSounds.clear();
    playingSounds.forEach(sounds => sounds.forEach(audio => audio.pause()));
    playingSounds.clear();
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += 32_768) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }

    return btoa(binary);
}

function playAudio(participantId: string, source: string, volume = 1, sinkId?: string) {
    const audio = new Audio(source);
    const active = playingSounds.get(participantId) ?? new Set<HTMLAudioElement>();
    const cleanup = () => {
        active.delete(audio);
        if (!active.size) {
            playingSounds.delete(participantId);
        }
    };

    active.add(audio);
    playingSounds.set(participantId, active);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });

    const setSink = sinkId && typeof (audio as any).setSinkId === 'function'
        ? (audio as any).setSinkId(sinkId).catch(() => undefined)
        : Promise.resolve();

    setSink.then(() => audio.play()).catch(cleanup);
}

export async function broadcastSoundpadSound(
        conference: { sendEndpointMessage: Function; },
        sound: ISoundpadSound,
        playLocally: boolean,
        sinkId?: string) {
    const payload = bytesToBase64(new Uint8Array(await sound.data.arrayBuffer()));
    const chunks = splitSoundpadPayload(payload);
    const soundId = crypto.randomUUID();

    for (let part = 0; part < chunks.length; part++) {
        conference.sendEndpointMessage('', {
            label: sound.name.slice(0, 80),
            mimeType: sound.type,
            name: SOUNDPAD_MESSAGE,
            part,
            parts: chunks.length,
            payload: chunks[part],
            soundId
        });

        if (part % 16 === 15) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    if (playLocally) {
        playAudio('local', `data:${sound.type};base64,${payload}`, 1, sinkId);
    }
}

export function receiveSoundpadMessage(
        participantId: string,
        data: unknown,
        volume = 1,
        sinkId?: string) {
    if (blockedParticipants.has(participantId) || !isSoundpadMessage(data)) {
        return;
    }

    const now = Date.now();

    pendingSounds.forEach((sound, key) => sound.expiresAt < now && pendingSounds.delete(key));

    const key = `${participantId}:${data.soundId}`;
    const existing = pendingSounds.get(key);

    if (!existing && pendingSounds.size >= MAX_PENDING_SOUNDS) {
        return;
    }

    const pending = existing ?? {
        chunks: new Array(data.parts),
        expiresAt: now + PENDING_SOUND_TTL,
        label: data.label,
        mimeType: data.mimeType,
        received: 0
    };

    if (pending.chunks.length !== data.parts
            || pending.mimeType !== data.mimeType
            || pending.chunks[data.part]) {
        return;
    }

    pending.chunks[data.part] = data.payload;
    pending.received++;
    pendingSounds.set(key, pending);

    if (pending.received === data.parts) {
        pendingSounds.delete(key);
        const payload = pending.chunks.join('');

        if (payload.length <= MAX_BASE64_LENGTH) {
            playAudio(participantId, `data:${pending.mimeType};base64,${payload}`, volume, sinkId);
        }
    }
}
