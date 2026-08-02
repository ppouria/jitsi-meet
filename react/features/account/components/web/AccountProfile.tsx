/* eslint-disable react/jsx-no-bind */
import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState, IStore } from '../../../app/types';
import { openDialog } from '../../../base/dialog/actions';
import Button from '../../../base/ui/components/web/Button';
import Input from '../../../base/ui/components/web/Input';
import {
    closeAccountRoom,
    loadAccount,
    loadAccountStats,
    logoutAccount,
    updateAccountProfile
} from '../../actions.web';
import { IAccountStat } from '../../types';

import AccountAuthDialog from './AccountAuthDialog';

const MAX_AVATAR_BYTES = 768 * 1024;

const useStyles = makeStyles()(theme => ({
    actions: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        marginTop: theme.spacing(4)
    },
    avatar: {
        alignItems: 'center',
        background: theme.palette.ui03,
        borderRadius: '50%',
        display: 'flex',
        fontSize: '28px',
        fontWeight: 700,
        height: '88px',
        justifyContent: 'center',
        marginBottom: theme.spacing(3),
        overflow: 'hidden',
        width: '88px',
        '& img': {
            height: '100%',
            objectFit: 'cover',
            width: '100%'
        }
    },
    error: {
        color: theme.palette.textError,
        marginTop: theme.spacing(3)
    },
    field: {
        marginTop: theme.spacing(3)
    },
    fileInput: {
        color: theme.palette.text01,
        maxWidth: '100%'
    },
    owner: {
        borderTop: '1px solid ' + theme.palette.ui03,
        marginTop: theme.spacing(4),
        paddingTop: theme.spacing(4)
    },
    status: {
        color: theme.palette.text02,
        marginTop: theme.spacing(3)
    },
    stats: {
        borderTop: '1px solid ' + theme.palette.ui03,
        marginTop: theme.spacing(4),
        paddingTop: theme.spacing(4)
    },
    statRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: theme.spacing(2) + ' 0'
    }
}));

function formatDuration(seconds: number) {
    const minutes = Math.round((Number(seconds) || 0) / 60);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return hours ? hours + 'h ' + rest + 'm' : rest + 'm';
}

export default function AccountProfile() {
    const { classes } = useStyles();
    const dispatch = useDispatch<IStore['dispatch']>();
    const { t } = useTranslation();
    const { initialized, room, user } = useSelector((state: IReduxState) => state['features/account']);
    const [ nickname, setNickname ] = useState(user?.nickname ?? '');
    const [ bio, setBio ] = useState(user?.bio ?? '');
    const [ avatarDraft, setAvatarDraft ] = useState<string | undefined>();
    const [ avatarDirty, setAvatarDirty ] = useState(false);
    const [ stats, setStats ] = useState<IAccountStat[]>([]);
    const [ error, setError ] = useState('');
    const [ status, setStatus ] = useState('');
    const [ saving, setSaving ] = useState(false);

    useEffect(() => {
        if (!initialized) {
            dispatch(loadAccount());
        }
    }, [ initialized ]);

    useEffect(() => {
        setNickname(user?.nickname ?? '');
        setBio(user?.bio ?? '');
        setAvatarDraft(undefined);
        setAvatarDirty(false);

        if (user) {
            dispatch(loadAccountStats())
                .then(setStats)
                .catch(() => setStats([]));
        } else {
            setStats([]);
        }
    }, [ user?.updatedAt ]);

    if (!initialized) {
        return (<div
            aria-busy = 'true'
            className = { classes.status }
            role = 'status'>
            {t('account.loading')}
        </div>);
    }

    if (!user) {
        return (<div>
            <p>{t('account.loginHelp')}</p>
            <Button
                accessibilityLabel = { t('account.loginOrSignup') }
                label = { t('account.loginOrSignup') }
                onClick = { () => dispatch(openDialog('AccountAuthDialog', AccountAuthDialog)) } />
        </div>);
    }

    const avatar = avatarDirty ? avatarDraft : user.avatarUrl;
    const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        setError('');
        if (!file) {
            return;
        }
        if (!file.type.startsWith('image/') || file.size > MAX_AVATAR_BYTES) {
            setError(t('account.avatarInvalid'));
            event.target.value = '';

            return;
        }

        const reader = new FileReader();

        reader.addEventListener('load', () => {
            if (typeof reader.result === 'string') {
                setAvatarDraft(reader.result);
                setAvatarDirty(true);
            }
        });
        reader.readAsDataURL(file);
    };
    const save = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setStatus('');
        setSaving(true);

        try {
            await dispatch(updateAccountProfile(nickname, bio, avatarDirty ? avatarDraft ?? '' : undefined));
            setStatus(t('account.profileSaved'));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : t('account.requestFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit = { save }>
            <div className = { classes.avatar }>
                {avatar
                    ? <img
                        alt = { t('account.avatarAlt') }
                        src = { avatar } />
                    : (nickname || user.username).trim().charAt(0).toUpperCase()}
            </div>
            <label htmlFor = 'account-avatar'>{t('account.avatar')}</label>
            <input
                accept = 'image/png,image/jpeg,image/webp,image/gif'
                className = { classes.fileInput }
                id = 'account-avatar'
                onChange = { onAvatarChange }
                type = 'file' />
            {(avatar || user.avatarUrl) && <div className = { classes.actions }>
                <Button
                    accessibilityLabel = { t('account.removeAvatar') }
                    label = { t('account.removeAvatar') }
                    onClick = { () => {
                        setAvatarDraft('');
                        setAvatarDirty(true);
                    } }
                    size = 'small'
                    type = 'secondary' />
            </div>}
            <Input
                autoComplete = 'name'
                className = { classes.field }
                id = 'account-profile-nickname'
                label = { t('account.nickname') }
                maxLength = { 80 }
                onChange = { setNickname }
                required = { true }
                type = 'text'
                value = { nickname } />
            <Input
                autoComplete = 'email'
                className = { classes.field }
                disabled = { true }
                id = 'account-profile-email'
                label = { t('account.email') }
                onChange = { () => undefined }
                type = 'email'
                value = { user.email } />
            <Input
                className = { classes.field }
                id = 'account-profile-bio'
                label = { t('account.bio') }
                maxLength = { 500 }
                maxRows = { 6 }
                minRows = { 3 }
                onChange = { setBio }
                textarea = { true }
                value = { bio } />
            {error && <div
                aria-live = 'assertive'
                className = { classes.error }
                role = 'alert'>{error}</div>}
            {status && <div
                aria-live = 'polite'
                className = { classes.status }
                role = 'status'>{status}</div>}
            <div className = { classes.actions }>
                <Button
                    accessibilityLabel = { t('account.saveProfile') }
                    disabled = { saving }
                    isSubmit = { true }
                    label = { t('account.saveProfile') } />
                <Button
                    accessibilityLabel = { t('account.logout') }
                    label = { t('account.logout') }
                    onClick = { () => dispatch(logoutAccount()) }
                    type = 'secondary' />
            </div>
            <section
                aria-labelledby = 'account-stats-title'
                className = { classes.stats }>
                <h2 id = 'account-stats-title'>{t('account.recentRoomTime')}</h2>
                {stats.length ? stats.slice(0, 8).map(item => (<div
                    className = { classes.statRow }
                    key = { item.day + '-' + item.room_name }>
                    <span>{item.room_name}</span>
                    <strong>{formatDuration(item.seconds)}</strong>
                </div>)) : <p>{t('account.noStats')}</p>}
            </section>
            {room?.isOwner && <section className = { classes.owner }>
                <h2>{t('account.roomOwner')}</h2>
                <Button
                    accessibilityLabel = { t('account.closeRoom') }
                    label = { t('account.closeRoom') }
                    onClick = { () => {
                        if (window.confirm(t('account.closeRoomConfirm'))) {
                            dispatch(closeAccountRoom()).catch(requestError =>
                                setError(requestError instanceof Error
                                    ? requestError.message
                                    : t('account.requestFailed')));
                        }
                    } }
                    type = 'destructive' />
            </section>}
        </form>
    );
}
