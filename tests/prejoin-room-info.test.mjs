import assert from 'node:assert/strict';
import test from 'node:test';

import { getRoomInfoURL, parsePrejoinParticipants } from '../react/features/prejoin/roomInfo.ts';

test('prejoin room info handles tenants and rejects malformed participants', () => {
    assert.equal(
        getRoomInfoURL(new URL('https://meet.example/demo'), 'demo'),
        'https://meet.example/_api/room-info?room=demo');
    assert.equal(
        getRoomInfoURL(new URL('https://meet.example/team/demo#config.foo=true'), 'demo'),
        'https://meet.example/team/_api/room-info?room=demo');
    assert.deepEqual(parsePrejoinParticipants({ participants: [
        { id: ' a ', displayName: ' Ada ' },
        { id: '', displayName: 'Ignored' },
        null
    ] }), [ { id: 'a', displayName: 'Ada' } ]);
    assert.equal(parsePrejoinParticipants({}), undefined);
});
