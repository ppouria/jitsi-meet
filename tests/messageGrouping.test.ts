import assert from 'node:assert/strict';

import { getMessageDay, groupMessagesBySender } from '../react/features/base/util/messageGrouping.ts';

const beforeMidnight = new Date(2026, 6, 4, 23, 59).getTime();
const afterMidnight = new Date(2026, 6, 5, 0, 1).getTime();
const groups = groupMessagesBySender([
    { participantId: 'one', timestamp: beforeMidnight },
    { participantId: 'one', timestamp: afterMidnight },
    { participantId: 'two', timestamp: afterMidnight }
]);

assert.notEqual(getMessageDay(beforeMidnight), getMessageDay(afterMidnight));
assert.deepEqual(groups.map(group => group.messages.length), [ 1, 1, 1 ]);
