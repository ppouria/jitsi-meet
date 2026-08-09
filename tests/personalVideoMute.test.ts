import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPersonalVideoMutes } from '../react/features/filmstrip/personalVideoMute.ts';

test('personally muted video sources are not requested from the bridge', () => {
    const receiverConstraints = {
        constraints: {
            camera: { maxHeight: 720 },
            screen: { maxHeight: 1080 }
        },
        onStageSources: [ 'camera' ],
        selectedSources: [ 'camera', 'screen' ]
    };

    applyPersonalVideoMutes(receiverConstraints, [ 'camera' ]);

    assert.deepEqual(receiverConstraints.constraints.camera, { maxHeight: 0 });
    assert.deepEqual(receiverConstraints.constraints.screen, { maxHeight: 1080 });
    assert.deepEqual(receiverConstraints.onStageSources, []);
    assert.deepEqual(receiverConstraints.selectedSources, [ 'screen' ]);
});
