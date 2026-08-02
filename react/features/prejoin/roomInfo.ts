export interface IPrejoinParticipant {
    displayName: string;
    id: string;
}

export function getRoomInfoURL(locationURL: URL, roomName: string) {
    const url = new URL(locationURL.toString());
    const path = url.pathname.replace(/\/+$/, '');

    url.hash = '';
    url.pathname = `${path.slice(0, path.lastIndexOf('/'))}/_api/room-info`;
    url.search = '';
    url.searchParams.set('room', roomName);

    return url.toString();
}

export function parsePrejoinParticipants(payload: unknown): IPrejoinParticipant[] | undefined {
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { participants?: unknown; }).participants)) {
        return undefined;
    }

    return (payload as { participants: unknown[]; }).participants.flatMap(participant => {
        if (!participant || typeof participant !== 'object') {
            return [];
        }

        const { displayName, id } = participant as { displayName?: unknown; id?: unknown; };

        if (typeof id !== 'string' || !id.trim()) {
            return [];
        }

        return [ {
            displayName: typeof displayName === 'string' ? displayName.trim() : '',
            id: id.trim()
        } ];
    });
}
