import assert from 'node:assert/strict';

import { getTrackVolume } from '../react/features/base/media/trackVolume.ts';

const volumes = {
    participant: 0.8,
    'participant-a1': 0.25
};

assert.equal(getTrackVolume(volumes, 'participant', 'participant-a1'), 0.25);
assert.equal(getTrackVolume(volumes, 'participant', 'participant-a0'), 0.8);
assert.equal(getTrackVolume({}, 'participant', 'participant-a1'), undefined);
