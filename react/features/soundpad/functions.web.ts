import JitsiMeetJS from '../base/lib-jitsi-meet';
import { MEDIA_TYPE } from '../base/media/constants';
import { AudioMixerEffect } from '../stream-effects/audio-mixer/AudioMixerEffect';

import {
    ISoundpadMessage,
    MAX_SOUND_DURATION_SECONDS,
    SOUNDPAD_MESSAGE,
    getSoundpadNextPlaybackAt,
    isSoundpadMessage
} from './protocol';

export {
    MAX_SOUND_DURATION_SECONDS,
    SOUNDPAD_MESSAGE,
    getSoundpadNextPlaybackAt,
    isSoundpadMessage
} from './protocol';

export const MAX_SOUND_BYTES = 2 * 1024 * 1024;

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

interface IRemoteSound {
    setMuted: (muted: boolean) => void;
    soundId: string;
    timeout: number;
}

const blockedParticipants = new Set<string>();
const remoteSounds = new Map<string, IRemoteSound>();

let nextPlaybackAt = 0;
let playbackStarting = false;

function sendSoundpadMessage(conference: { sendEndpointMessage: Function; }, message: ISoundpadMessage) {
    try {
        conference.sendEndpointMessage('', message);
    } catch {
        // Playback still works if the optional per-participant blocking signal cannot be sent.
    }
}

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

export function getSoundpadCooldownSeconds(now = Date.now()) {
    return Math.ceil(Math.max(0, nextPlaybackAt - now) / 1000);
}

export function isSoundpadBlocked(participantId: string): boolean {
    return blockedParticipants.has(participantId);
}

export function isSoundpadParticipantPlaying(participantId: string): boolean {
    return remoteSounds.has(participantId);
}

export function setSoundpadBlocked(participantId: string, blocked: boolean) {
    if (blocked) {
        blockedParticipants.add(participantId);
    } else {
        blockedParticipants.delete(participantId);
    }
}

export function resetSoundpadSession() {
    blockedParticipants.clear();
    remoteSounds.forEach(sound => {
        clearTimeout(sound.timeout);
        sound.setMuted(false);
    });
    remoteSounds.clear();
}

export function receiveSoundpadMessage(
        participantId: string,
        data: unknown,
        setMuted: (muted: boolean) => void) {
    if (!isSoundpadMessage(data)) {
        return;
    }

    const active = remoteSounds.get(participantId);

    if (data.state === 'stop') {
        if (active?.soundId === data.soundId) {
            clearTimeout(active.timeout);
            remoteSounds.delete(participantId);
            active.setMuted(false);
        }

        return;
    }

    if (active) {
        clearTimeout(active.timeout);
    }

    const timeout = window.setTimeout(() => {
        const current = remoteSounds.get(participantId);

        if (current?.soundId === data.soundId) {
            remoteSounds.delete(participantId);
            current.setMuted(false);
        }
    }, (data.duration! * 1000) + 1000);

    remoteSounds.set(participantId, {
        setMuted,
        soundId: data.soundId,
        timeout
    });

    if (blockedParticipants.has(participantId)) {
        setMuted(true);
    }
}

export async function broadcastSoundpadSound(
        conference: { sendEndpointMessage: Function; },
        localAudio: any,
        sound: ISoundpadSound,
        playLocally: boolean,
        sinkId?: string) {
    if (playbackStarting || getSoundpadCooldownSeconds() || localAudio._streamEffect) {
        throw new Error('Soundpad is not available.');
    }

    playbackStarting = true;
    let context: AudioContext | undefined;
    let effect: AudioMixerEffect | undefined;
    let mixAudio: any;
    let source: AudioBufferSourceNode | undefined;
    let applied = false;
    let soundId = '';

    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error('Web Audio is not available.');
        }

        context = new AudioContextClass();
        await context.resume();
        const buffer = await context.decodeAudioData(await sound.data.arrayBuffer());

        if (buffer.duration <= 0 || buffer.duration > MAX_SOUND_DURATION_SECONDS) {
            throw new Error('Invalid sound duration.');
        }

        const destination = context.createMediaStreamDestination();
        const track = destination.stream.getAudioTracks()[0];

        source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);
        if (playLocally) {
            if (sinkId && typeof (context as any).setSinkId === 'function') {
                await (context as any).setSinkId(sinkId).catch(() => undefined);
            }
            source.connect(context.destination);
        }

        [ mixAudio ] = JitsiMeetJS.createLocalTracksFromMediaStreams([ {
            deviceId: 'proxy:soundpad',
            mediaType: MEDIA_TYPE.AUDIO,
            sourceType: 'proxy',
            stream: destination.stream,
            track
        } ]);
        effect = new AudioMixerEffect(mixAudio);
        await localAudio.setEffect(effect);
        applied = true;
        soundId = crypto.randomUUID();
        nextPlaybackAt = getSoundpadNextPlaybackAt(Date.now(), buffer.duration);
        sendSoundpadMessage(conference, {
            duration: buffer.duration,
            name: SOUNDPAD_MESSAGE,
            soundId,
            state: 'start'
        });
        await new Promise<void>(resolve => {
            source!.onended = () => resolve();
            source!.start();
        });
    } finally {
        playbackStarting = false;

        if (soundId) {
            sendSoundpadMessage(conference, {
                name: SOUNDPAD_MESSAGE,
                soundId,
                state: 'stop'
            });
        }

        try {
            if (applied && localAudio._streamEffect === effect) {
                await localAudio.setEffect(undefined);
            }
        } finally {
            await mixAudio?.dispose();
            void context?.close();
        }
    }
}
