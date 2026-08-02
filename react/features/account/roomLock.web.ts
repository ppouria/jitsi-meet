interface IRoomLockManager {
    request: (
        name: string,
        options: { ifAvailable: true; },
        callback: (lock: Lock | null) => Promise<void> | void
    ) => Promise<unknown>;
}

let activeRoom: string | undefined;
let releaseActiveRoom: (() => void) | undefined;

export function acquireBrowserRoomLock(
        roomName: string,
        lockManager: IRoomLockManager | undefined = navigator.locks): Promise<boolean> {
    const room = roomName.trim().toLowerCase();

    if (activeRoom === room) {
        return Promise.resolve(true);
    }

    releaseBrowserRoomLock();
    if (!lockManager) {
        return Promise.resolve(true);
    }

    return new Promise(resolve => {
        void lockManager.request(`jitsi-meet-room:${room}`, { ifAvailable: true }, lock => {
            if (!lock) {
                resolve(false);

                return;
            }

            activeRoom = room;
            resolve(true);

            return new Promise<void>(release => {
                releaseActiveRoom = () => {
                    activeRoom = undefined;
                    releaseActiveRoom = undefined;
                    release();
                };
            });
        }).catch(() => resolve(false));
    });
}

export function releaseBrowserRoomLock() {
    releaseActiveRoom?.();
}
