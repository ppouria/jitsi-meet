export const MAX_SOUND_DURATION_SECONDS = 10;
export const SOUNDPAD_COOLDOWN_MS = 10_000;
export const SOUNDPAD_MESSAGE = 'voice-soundpad-state-v2';

export interface ISoundpadMessage {
    duration?: number;
    name: typeof SOUNDPAD_MESSAGE;
    soundId: string;
    state: 'start' | 'stop';
}

export function getSoundpadNextPlaybackAt(startedAt: number, duration: number) {
    return startedAt + (duration * 1000) + SOUNDPAD_COOLDOWN_MS;
}

export function isSoundpadMessage(data: unknown): data is ISoundpadMessage {
    const message = data as Partial<ISoundpadMessage> | undefined;

    return message?.name === SOUNDPAD_MESSAGE
        && typeof message.soundId === 'string'
        && /^[\w-]{1,64}$/.test(message.soundId)
        && (message.state === 'start' || message.state === 'stop')
        && (message.state === 'stop'
            || (typeof message.duration === 'number'
                && message.duration > 0
                && message.duration <= MAX_SOUND_DURATION_SECONDS));
}
