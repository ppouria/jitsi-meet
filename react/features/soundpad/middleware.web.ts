import { CONFERENCE_LEFT, ENDPOINT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { setPersonalAudioMute } from '../filmstrip/actions.web';

import { receiveSoundpadMessage, resetSoundpadSession } from './functions.web';

MiddlewareRegistry.register(store => next => action => {
    if (action.type === ENDPOINT_MESSAGE_RECEIVED) {
        const participantId = action.participant?.getId?.();

        if (participantId) {
            receiveSoundpadMessage(participantId, action.data, muted => {
                store.dispatch(setPersonalAudioMute(participantId, 'soundpad', muted));
            });
        }
    } else if (action.type === CONFERENCE_LEFT) {
        resetSoundpadSession();
    }

    return next(action);
});
