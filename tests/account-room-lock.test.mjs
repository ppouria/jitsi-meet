import assert from 'node:assert/strict';
import test from 'node:test';

class LockManager {
    held = new Set();

    request(name, _options, callback) {
        if (this.held.has(name)) {
            return Promise.resolve(callback(null));
        }

        this.held.add(name);

        return Promise.resolve(callback({ name })).finally(() => this.held.delete(name));
    }
}

test('one browser tab per room while different rooms remain independent', async () => {
    const locks = new LockManager();
    const tabA = await import('../react/features/account/roomLock.web.ts?tab=a');
    const tabB = await import('../react/features/account/roomLock.web.ts?tab=b');

    assert.equal(await tabA.acquireBrowserRoomLock('Room-A', locks), true);
    assert.equal(await tabB.acquireBrowserRoomLock('room-a', locks), false);
    assert.equal(await tabB.acquireBrowserRoomLock('room-b', locks), true);

    tabA.releaseBrowserRoomLock();
    tabB.releaseBrowserRoomLock();
});
