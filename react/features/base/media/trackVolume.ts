/**
 * Returns the volume for one remote audio source, falling back to the participant volume.
 *
 * @param {Object} volumes - Stored participant and source volumes.
 * @param {string} participantId - Owner of the audio source.
 * @param {string} sourceName - The exact audio source name.
 * @returns {number|undefined}
 */
export function getTrackVolume(
        volumes: Record<string, number>, participantId: string, sourceName?: string): number | undefined {
    return (sourceName ? volumes[sourceName] : undefined) ?? volumes[participantId];
}
