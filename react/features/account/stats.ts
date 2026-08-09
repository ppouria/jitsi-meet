import type { IAccountStat } from './types';

export function aggregateAccountStats(items: IAccountStat[]): IAccountStat[] {
    const totals = new Map<string, IAccountStat>();

    for (const item of items) {
        const roomKey = item.room_name.trim().toLowerCase();
        const existing = totals.get(roomKey);

        if (existing) {
            existing.seconds += item.seconds;
        } else {
            totals.set(roomKey, { ...item });
        }
    }

    return [ ...totals.values() ];
}
