import ReducerRegistry from '../base/redux/ReducerRegistry';

import { IAccountProfile, IAccountRoom } from './types';

export const UPDATE_ACCOUNT_STATE = 'UPDATE_ACCOUNT_STATE';

export interface IAccountState {
    initialized: boolean;
    room?: IAccountRoom;
    user?: IAccountProfile;
}

const DEFAULT_STATE: IAccountState = {
    initialized: false
};

export function updateAccountState(state: Partial<IAccountState>) {
    return {
        type: UPDATE_ACCOUNT_STATE,
        state
    };
}

ReducerRegistry.register<IAccountState>('features/account', (state = DEFAULT_STATE, action): IAccountState => {
    if (action.type === UPDATE_ACCOUNT_STATE) {
        return {
            ...state,
            ...action.state
        };
    }

    return state;
});
