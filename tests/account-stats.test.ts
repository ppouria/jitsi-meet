import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateAccountStats } from '../react/features/account/stats.ts';

test('account stats contain one total per room in recent order', () => {
    const result = aggregateAccountStats([
        { day: '2026-08-09', room_name: 'room-a', seconds: 3600 },
        { day: '2026-08-09', room_name: 'room-b', seconds: 120 },
        { day: '2026-08-08', room_name: 'room-a', seconds: 1800 },
        { day: '2026-08-07', room_name: 'ROOM-A ', seconds: 60 }
    ]);

    assert.deepEqual(result, [
        { day: '2026-08-09', room_name: 'room-a', seconds: 5460 },
        { day: '2026-08-09', room_name: 'room-b', seconds: 120 }
    ]);
});
