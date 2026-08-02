export const ACCOUNT_ROOM_CLOSED_COMMAND = 'voice-room-closed';

export interface IAccountProfile {
    avatarBase64?: string;
    avatarMime?: string;
    avatarUrl?: string;
    bio: string;
    createdAt: string;
    email: string;
    id: number;
    nickname: string;
    updatedAt: string;
    username: string;
}

export interface IAccountRoom {
    closed: boolean;
    closedAt?: string;
    createdAt?: string;
    id?: number;
    isOwner: boolean;
    ownerUserId?: number;
    roomName: string;
}

export interface IAccountRoomMessage {
    displayName: string;
    id: number;
    isMine: boolean;
    message: string;
    messageKey: string;
    participantId?: string;
    senderUserId: number;
    sentAt: string;
}

export interface IAccountStat {
    day: string;
    room_name: string;
    seconds: number;
}

export interface IAccountTokenResponse {
    expiresAt: string;
    jwt: string;
    room: IAccountRoom;
}
