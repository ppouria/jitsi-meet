export const PERSONAL_AUDIO_MUTE_MESSAGE = 'personal-audio-mute';

export type PersonalAudioMuteDirection = 'byParticipant' | 'forMe' | 'forParticipant';

export type PersonalAudioMuteState = Partial<Record<PersonalAudioMuteDirection, boolean>>;

export function isIncomingPersonalAudioMuted(mute?: PersonalAudioMuteState) {
    return Boolean(mute?.byParticipant || mute?.forMe);
}
