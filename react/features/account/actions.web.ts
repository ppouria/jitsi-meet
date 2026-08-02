import { IStore } from '../app/types';
import { leaveConference } from '../base/conference/actions';
import { IConfig } from '../base/config/configType';
import { openDialog } from '../base/dialog/actions';
import { setJWT } from '../base/jwt/actions';
import { getLogger } from '../base/logging/functions';
import { getLocalParticipant } from '../base/participants/functions';
import { updateSettings } from '../base/settings/actions';
import { showErrorNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../notifications/constants';

import { AccountAPIError, accountAPI } from './api';
import AccountAuthDialog from './components/web/AccountAuthDialog';
import { updateAccountState } from './reducer';
import { acquireBrowserRoomLock, releaseBrowserRoomLock } from './roomLock.web';
import {
    ACCOUNT_ROOM_CLOSED_COMMAND,
    IAccountProfile,
    IAccountStat,
    IAccountTokenResponse
} from './types';

const logger = getLogger('features/account');

export function getAccountServiceURL(config?: IConfig): string | undefined {
    const serviceURL = config?.accountServiceUrl?.trim();

    return serviceURL || undefined;
}

function applyAccountUser(dispatch: IStore['dispatch'], user?: IAccountProfile) {
    dispatch(updateAccountState({
        initialized: true,
        user
    }));

    if (user) {
        dispatch(updateSettings({
            avatarURL: user.avatarUrl ?? '',
            displayName: user.nickname || user.username,
            email: user.email
        }));
    }
}

export function loadAccount() {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const serviceURL = getAccountServiceURL(getState()['features/base/config']);

        if (!serviceURL) {
            dispatch(updateAccountState({ initialized: true }));

            return undefined;
        }

        try {
            const { user } = await accountAPI<{ user: IAccountProfile; }>(serviceURL, '/me');

            applyAccountUser(dispatch, user);

            return user;
        } catch (error) {
            if (!(error instanceof AccountAPIError) || error.status !== 401) {
                logger.warn('Unable to load account profile.', error);
            }
            applyAccountUser(dispatch);

            return undefined;
        }
    };
}

export function loginAccount(login: string, password: string) {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const serviceURL = getAccountServiceURL(getState()['features/base/config']);

        if (!serviceURL) {
            throw new Error('Account service is not configured.');
        }

        const { user } = await accountAPI<{ user: IAccountProfile; }>(serviceURL, '/login', {
            body: { login, password },
            method: 'POST'
        });

        applyAccountUser(dispatch, user);

        return user;
    };
}

export function signupAccount(username: string, email: string, nickname: string, password: string) {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const serviceURL = getAccountServiceURL(getState()['features/base/config']);

        if (!serviceURL) {
            throw new Error('Account service is not configured.');
        }

        const { user } = await accountAPI<{ user: IAccountProfile; }>(serviceURL, '/signup', {
            body: {
                email,
                nickname,
                password,
                username
            },
            method: 'POST'
        });

        applyAccountUser(dispatch, user);

        return user;
    };
}

export function logoutAccount() {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();
        const serviceURL = getAccountServiceURL(state['features/base/config']);
        const roomName = state['features/account'].room?.roomName;

        try {
            if (serviceURL && roomName && state['features/account'].user) {
                await accountAPI(serviceURL, '/presence/heartbeat', {
                    body: {
                        active: false,
                        participantId: getLocalParticipant(state)?.id ?? '',
                        roomName
                    },
                    method: 'POST'
                }).catch(() => undefined);
            }
            serviceURL && await accountAPI(serviceURL, '/logout', { method: 'POST' });
        } finally {
            dispatch(setJWT());
            dispatch(updateAccountState({
                initialized: true,
                room: undefined,
                user: undefined
            }));
        }
    };
}

export function updateAccountProfile(nickname: string, bio: string, avatarDataUrl?: string) {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const serviceURL = getAccountServiceURL(getState()['features/base/config']);

        if (!serviceURL) {
            throw new Error('Account service is not configured.');
        }

        const { user } = await accountAPI<{ user: IAccountProfile; }>(serviceURL, '/profile', {
            body: {
                ...(typeof avatarDataUrl === 'string' ? { avatarDataUrl } : {}),
                bio,
                nickname
            },
            method: 'PUT'
        });

        applyAccountUser(dispatch, user);

        return user;
    };
}

export function loadAccountStats() {
    return async (_dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const serviceURL = getAccountServiceURL(getState()['features/base/config']);

        if (!serviceURL) {
            return [];
        }

        const result = await accountAPI<{ items: IAccountStat[]; }>(serviceURL, '/stats/me?days=7');

        return result.items ?? [];
    };
}

function promptForAccount(dispatch: IStore['dispatch']) {
    return new Promise<boolean>(resolve => {
        let settled = false;
        const finish = (result: boolean) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        dispatch(openDialog('AccountAuthDialog', AccountAuthDialog, {
            onAuthenticated: () => finish(true),
            onCancel: () => finish(false)
        }));
    });
}

export async function prepareAccountRoom(
        dispatch: IStore['dispatch'],
        getState: IStore['getState'],
        config: IConfig | undefined,
        roomName: string): Promise<boolean> {
    if (!(await acquireBrowserRoomLock(roomName))) {
        dispatch(showErrorNotification({
            titleKey: 'account.roomAlreadyOpen'
        }, NOTIFICATION_TIMEOUT_TYPE.LONG));

        return false;
    }

    const serviceURL = getAccountServiceURL(config);

    if (!serviceURL) {
        return true;
    }

    const requestToken = () => accountAPI<IAccountTokenResponse>(
        serviceURL,
        '/jitsi-token/' + encodeURIComponent(roomName) + '?format=json');
    let result: IAccountTokenResponse;

    try {
        result = await requestToken();
    } catch (error) {
        if (!(error instanceof AccountAPIError) || error.status !== 401 || !(await promptForAccount(dispatch))) {
            if (!(error instanceof AccountAPIError) || error.status !== 401) {
                dispatch(showErrorNotification({
                    title: error instanceof Error ? error.message : 'Account service failed.'
                }, NOTIFICATION_TIMEOUT_TYPE.LONG));
            }

            releaseBrowserRoomLock();

            return false;
        }

        try {
            result = await requestToken();
        } catch (retryError) {
            dispatch(showErrorNotification({
                title: retryError instanceof Error ? retryError.message : 'Could not authorize this room.'
            }, NOTIFICATION_TIMEOUT_TYPE.LONG));
            releaseBrowserRoomLock();

            return false;
        }
    }

    if (typeof result.jwt !== 'string' || !result.jwt || !result.room || typeof result.room.roomName !== 'string') {
        dispatch(showErrorNotification({
            title: 'Account service returned an invalid room token.'
        }, NOTIFICATION_TIMEOUT_TYPE.LONG));
        releaseBrowserRoomLock();

        return false;
    }

    dispatch(setJWT(result.jwt));
    dispatch(updateAccountState({ room: result.room }));

    if (!getState()['features/account'].user) {
        await dispatch(loadAccount());
    }

    return true;
}

export function leaveAccountRoom() {
    return (dispatch: IStore['dispatch']) => {
        dispatch(leaveConference());
        window.setTimeout(() => window.location.assign('/'), 400);
    };
}

export function closeAccountRoom() {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();
        const serviceURL = getAccountServiceURL(state['features/base/config']);
        const roomName = state['features/account'].room?.roomName;

        if (!serviceURL || !roomName || !state['features/account'].room?.isOwner) {
            return;
        }

        await accountAPI(serviceURL, '/rooms/' + encodeURIComponent(roomName) + '/close', { method: 'POST' });
        state['features/base/conference'].conference?.sendCommand(
            ACCOUNT_ROOM_CLOSED_COMMAND,
            { value: String(Date.now()) });
        dispatch(leaveAccountRoom());
    };
}
