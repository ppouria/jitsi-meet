/**
 * Returns whether an audio mute request must be blocked while deafened.
 *
 * @param {boolean} deafened - Whether deafen is enabled.
 * @param {boolean} muted - The requested microphone mute state.
 * @returns {boolean}
 */
export function shouldBlockAudioUnmute(deafened: boolean, muted: boolean) {
    return deafened && !muted;
}

/**
 * Parses the participant property used to signal deafen state.
 *
 * @param {unknown} value - The signalled property value.
 * @returns {boolean}
 */
export function parseDeafenedProperty(value: unknown) {
    return value === true || value === 'true';
}
