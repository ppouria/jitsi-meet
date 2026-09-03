import { IStore } from '../app/types';
import { APP_WILL_MOUNT, APP_WILL_UNMOUNT } from '../base/app/actionTypes';
import { CONFERENCE_JOINED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import { IJitsiConference } from '../base/conference/reducer';
import { getLocalParticipant } from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { ADD_MESSAGE } from '../chat/actionTypes';
import { addMessage } from '../chat/actions';
import { MESSAGE_TYPE_LOCAL, MESSAGE_TYPE_REMOTE } from '../chat/constants';

import { getAccountServiceURL, leaveAccountRoom } from './actions.web';
import { accountAPI, buildAccountURL } from './api';
import { UPDATE_ACCOUNT_STATE, updateAccountState } from './reducer';
import { ACCOUNT_ROOM_CLOSED_COMMAND, IAccountRoom, IAccountRoomMessage } from './types';

const HEARTBEAT_MS = 20_000;
const ROOM_STATE_MS = 10_000;
const HISTORY_MESSAGE_PREFIX = 'account-history-';

const commandListenerConferences = new WeakSet<IJitsiConference>();
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let roomStateTimer: ReturnType<typeof setInterval> | undefined;
let activeStore: IStore | undefined;

function roomName(store: IStore) {
    const state = store.getState();

    return state['features/account'].room?.roomName ?? state['features/base/conference'].room;
}

async function sendPresence(store: IStore, active: boolean) {
    const state = store.getState();
    const serviceURL = getAccountServiceURL(state['features/base/config']);
    const room = roomName(store);

    if (!serviceURL || !room || !state['features/account'].user) {
        return;
    }

    await accountAPI(serviceURL, '/presence/heartbeat', {
        body: {
            active,
            participantId: getLocalParticipant(state)?.id ?? '',
            roomName: room
        },
        keepalive: !active,
        method: 'POST'
    });
}

async function refreshRoomState(store: IStore) {
    const state = store.getState();
    const serviceURL = getAccountServiceURL(state['features/base/config']);
    const room = roomName(store);

    if (!serviceURL || !room || !state['features/account'].user) {
        return;
    }

    const result = await accountAPI<IAccountRoom>(serviceURL, '/rooms/' + encodeURIComponent(room) + '/state');

    store.dispatch(updateAccountState({ room: result }));
    if (result.closed) {
        store.dispatch(leaveAccountRoom());
    }
}

async function loadRoomHistory(store: IStore) {
    const state = store.getState();
    const serviceURL = getAccountServiceURL(state['features/base/config']);
    const room = roomName(store);

    if (!serviceURL || !room || !state['features/account'].user) {
        return;
    }

    const result = await accountAPI<{ items: IAccountRoomMessage[]; room: IAccountRoom; }>(
        serviceURL,
        '/rooms/' + encodeURIComponent(room) + '/messages?limit=200');
    const existingIDs = new Set(store.getState()['features/chat'].messages.map(message => message.messageId));

    store.dispatch(updateAccountState({ room: result.room }));
    for (const item of result.items ?? []) {
        const messageId = HISTORY_MESSAGE_PREFIX + (item.messageKey || item.id);

        if (existingIDs.has(messageId)) {
            continue;
        }
        existingIDs.add(messageId);
        store.dispatch(addMessage({
            displayName: item.displayName || 'User',
            hasRead: true,
            isReaction: false,
            lobbyChat: false,
            message: item.message,
            messageId,
            messageType: item.isMine ? MESSAGE_TYPE_LOCAL : MESSAGE_TYPE_REMOTE,
            participantId: item.participantId || HISTORY_MESSAGE_PREFIX + item.senderUserId,
            privateMessage: false,
            skipAccountPersistence: true,
            timestamp: Date.parse(item.sentAt) || Date.now()
        }));
    }
}

function stopRoomRuntime() {
    heartbeatTimer && clearInterval(heartbeatTimer);
    roomStateTimer && clearInterval(roomStateTimer);
    heartbeatTimer = undefined;
    roomStateTimer = undefined;
}

function startRoomRuntime(store: IStore, conference: IJitsiConference) {
    stopRoomRuntime();

    if (!store.getState()['features/account'].user || !roomName(store)) {
        return;
    }

    sendPresence(store, true).catch(() => undefined);
    refreshRoomState(store).catch(() => undefined);
    loadRoomHistory(store).catch(() => undefined);
    heartbeatTimer = setInterval(() => sendPresence(store, true).catch(() => undefined), HEARTBEAT_MS);
    roomStateTimer = setInterval(() => refreshRoomState(store).catch(() => undefined), ROOM_STATE_MS);
    if (!commandListenerConferences.has(conference)) {
        commandListenerConferences.add(conference);
        conference.addCommandListener(ACCOUNT_ROOM_CLOSED_COMMAND, () => store.dispatch(leaveAccountRoom()));
    }
}

function persistMessage(store: IStore, action: any) {
    const state = store.getState();
    const serviceURL = getAccountServiceURL(state['features/base/config']);
    const room = roomName(store);

    if (!serviceURL
            || !room
            || !state['features/account'].user
            || action.skipAccountPersistence
            || action.messageType !== MESSAGE_TYPE_LOCAL
            || action.privateMessage
            || action.lobbyChat
            || action.isReaction
            || typeof action.message !== 'string'
            || !action.message) {
        return;
    }

    accountAPI(serviceURL, '/rooms/' + encodeURIComponent(room) + '/messages', {
        body: {
            displayName: action.displayName,
            message: action.message,
            messageId: action.messageId ?? '',
            participantId: action.participantId ?? '',
            timestamp: action.timestamp ?? Date.now()
        },
        method: 'POST'
    }).catch(() => undefined);
}

function onBeforeUnload() {
    if (!activeStore || !navigator.sendBeacon) {
        return;
    }

    const state = activeStore.getState();
    const serviceURL = getAccountServiceURL(state['features/base/config']);
    const room = roomName(activeStore);

    if (!serviceURL || !room || !state['features/account'].user) {
        return;
    }

    navigator.sendBeacon(buildAccountURL(serviceURL, '/presence/heartbeat'), new Blob([ JSON.stringify({
        active: false,
        participantId: getLocalParticipant(state)?.id ?? '',
        roomName: room
    }) ], { type: 'application/json' }));
}

MiddlewareRegistry.register(store => next => action => {
    const accountUserChanged = action.type === UPDATE_ACCOUNT_STATE
        && Object.prototype.hasOwnProperty.call(action.state, 'user');
    const wasLoggedIn = Boolean(store.getState()['features/account'].user);

    const result = next(action);

    switch (action.type) {
    case APP_WILL_MOUNT:
        activeStore = store;
        window.addEventListener('beforeunload', onBeforeUnload);
        break;
    case APP_WILL_UNMOUNT:
        sendPresence(store, false).catch(() => undefined);
        stopRoomRuntime();
        window.removeEventListener('beforeunload', onBeforeUnload);
        activeStore = undefined;
        break;
    case CONFERENCE_JOINED:
        startRoomRuntime(store, action.conference);
        break;
    case CONFERENCE_LEFT:
        sendPresence(store, false).catch(() => undefined);
        stopRoomRuntime();
        break;
    case UPDATE_ACCOUNT_STATE:
        if (accountUserChanged && !wasLoggedIn && action.state.user
                && store.getState()['features/base/conference'].conference) {
            startRoomRuntime(store, store.getState()['features/base/conference'].conference as IJitsiConference);
        } else if (accountUserChanged && !action.state.user) {
            stopRoomRuntime();
        }
        break;
    case ADD_MESSAGE:
        persistMessage(store, action);
        break;
    }

    return result;
});
