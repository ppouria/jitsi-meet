import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SOUNDPAD_MESSAGE,
    getSoundpadNextPlaybackAt,
    isSoundpadMessage
} from '../react/features/soundpad/protocol.ts';

test('soundpad waits for the sound plus ten seconds and validates control messages', () => {
    assert.equal(getSoundpadNextPlaybackAt(1_000, 10), 21_000);
    assert.equal(getSoundpadNextPlaybackAt(1_000, 0.5), 11_500);
    assert.equal(isSoundpadMessage({
        duration: 10,
        name: SOUNDPAD_MESSAGE,
        soundId: 'sound-1',
        state: 'start'
    }), true);
    assert.equal(isSoundpadMessage({
        duration: 11,
        name: SOUNDPAD_MESSAGE,
        soundId: 'sound-1',
        state: 'start'
    }), false);
});
