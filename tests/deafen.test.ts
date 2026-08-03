import assert from 'node:assert/strict';

import { parseDeafenedProperty, shouldBlockAudioUnmute } from '../react/features/base/media/deafen.ts';

assert.equal(shouldBlockAudioUnmute(true, false), true);
assert.equal(shouldBlockAudioUnmute(true, true), false);
assert.equal(shouldBlockAudioUnmute(false, false), false);
assert.equal(parseDeafenedProperty(true), true);
assert.equal(parseDeafenedProperty('true'), true);
assert.equal(parseDeafenedProperty('false'), false);
