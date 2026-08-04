import { CONFERENCE_LEFT, ENDPOINT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';

import { receiveSoundpadMessage, resetSoundpadSession } from './functions.web';

MiddlewareRegistry.register(store => next => action => {
    if (action.type === ENDPOINT_MESSAGE_RECEIVED) {
        const participantId = action.participant?.getId?.();
        const state = store.getState();

        if (participantId
                && !state['features/base/media'].audio.deafened
                && !state['features/filmstrip'].personalAudioMutes[participantId]?.forMe) {
            receiveSoundpadMessage(
                participantId,
                action.data,
                state['features/filmstrip'].participantsVolume[participantId] ?? 1,
                state['features/base/settings'].audioOutputDeviceId);
        }
    } else if (action.type === CONFERENCE_LEFT) {
        resetSoundpadSession();
    }

    return next(action);
});
