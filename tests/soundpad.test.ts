import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SOUNDPAD_MESSAGE,
    isSoundpadMessage,
    splitSoundpadPayload
} from '../react/features/soundpad/functions.web.ts';

test('soundpad payloads are chunked and untrusted messages are rejected', () => {
    const chunks = splitSoundpadPayload('a'.repeat(12_001));

    assert.deepEqual(chunks.map(chunk => chunk.length), [ 12_000, 1 ]);
    assert.equal(isSoundpadMessage({
        label: 'Bell',
        mimeType: 'audio/mpeg',
        name: SOUNDPAD_MESSAGE,
        part: 0,
        parts: 1,
        payload: 'YQ==',
        soundId: 'sound-1'
    }), true);
    assert.equal(isSoundpadMessage({
        label: 'Not audio',
        mimeType: 'text/html',
        name: SOUNDPAD_MESSAGE,
        part: 0,
        parts: 1,
        payload: 'YQ==',
        soundId: 'sound-1'
    }), false);
});
