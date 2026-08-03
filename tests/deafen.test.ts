import assert from 'node:assert/strict';

import { shouldBlockAudioUnmute } from '../react/features/base/media/deafen.ts';

assert.equal(shouldBlockAudioUnmute(true, false), true);
assert.equal(shouldBlockAudioUnmute(true, true), false);
assert.equal(shouldBlockAudioUnmute(false, false), false);
