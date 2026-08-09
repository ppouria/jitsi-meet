interface IReceiverConstraints {
    constraints: Record<string, { maxHeight: number; }>;
    onStageSources: string[];
    selectedSources: string[];
}

/**
 * Prevents muted sources from being requested from the bridge.
 *
 * @param {IReceiverConstraints} receiverConstraints - The constraints being sent to the bridge.
 * @param {string[]} sourceNames - Source names the local user does not want to receive.
 * @returns {void}
 */
export function applyPersonalVideoMutes(receiverConstraints: IReceiverConstraints, sourceNames: string[]) {
    const mutedSources = new Set(sourceNames);

    mutedSources.forEach(sourceName => {
        receiverConstraints.constraints[sourceName] = { maxHeight: 0 };
    });
    receiverConstraints.onStageSources = receiverConstraints.onStageSources.filter(source => !mutedSources.has(source));
    receiverConstraints.selectedSources = receiverConstraints.selectedSources.filter(source => !mutedSources.has(source));
}
