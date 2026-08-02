import assert from 'node:assert/strict';

import { isIncomingPersonalAudioMuted } from '../react/features/filmstrip/personalAudioMute';

assert.equal(isIncomingPersonalAudioMuted(), false);
assert.equal(isIncomingPersonalAudioMuted({ forParticipant: true }), false);
assert.equal(isIncomingPersonalAudioMuted({ forMe: true }), true);
assert.equal(isIncomingPersonalAudioMuted({ byParticipant: true }), true);
