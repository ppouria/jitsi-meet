/* eslint-disable react/jsx-no-bind */
import React, { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState } from '../../../app/types';
import Button from '../../../base/ui/components/web/Button';
import Dialog from '../../../base/ui/components/web/Dialog';
import {
    ISoundpadSound,
    MAX_SOUND_BYTES,
    MAX_SOUND_DURATION_SECONDS,
    broadcastSoundpadSound,
    deleteSoundpadSound,
    getAudioDuration,
    getSoundpadSounds,
    saveSoundpadSound
} from '../../functions.web';

const useStyles = makeStyles()(theme => ({
    actions: {
        display: 'flex',
        gap: theme.spacing(2)
    },
    error: {
        color: theme.palette.textError,
        marginTop: theme.spacing(3)
    },
    file: {
        color: theme.palette.text01,
        maxWidth: '100%'
    },
    help: {
        color: theme.palette.text02,
        marginBottom: theme.spacing(3)
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
        listStyle: 'none',
        margin: `${theme.spacing(4)} 0 0`,
        padding: 0
    },
    row: {
        alignItems: 'center',
        borderTop: `1px solid ${theme.palette.ui03}`,
        display: 'flex',
        gap: theme.spacing(2),
        justifyContent: 'space-between',
        paddingTop: theme.spacing(2)
    },
    status: {
        color: theme.palette.text02,
        marginTop: theme.spacing(3)
    }
}));

export default function SoundpadDialog() {
    const { classes } = useStyles();
    const { t } = useTranslation();
    const user = useSelector((state: IReduxState) => state['features/account'].user);
    const conference = useSelector((state: IReduxState) => state['features/base/conference'].conference);
    const deafened = useSelector((state: IReduxState) => state['features/base/media'].audio.deafened);
    const sinkId = useSelector((state: IReduxState) => state['features/base/settings'].audioOutputDeviceId);
    const [ sounds, setSounds ] = useState<ISoundpadSound[]>([]);
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState('');
    const [ status, setStatus ] = useState('');

    useEffect(() => {
        if (user) {
            getSoundpadSounds(user.id).then(setSounds).catch(() => setError(t('soundpad.storageError')));
        }
    }, [ user?.id ]);

    const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        event.target.value = '';
        setError('');
        setStatus('');
        if (!file || !user) {
            return;
        }
        if (!file.type.startsWith('audio/') || file.size > MAX_SOUND_BYTES) {
            setError(t('soundpad.invalidFile'));

            return;
        }

        setBusy(true);
        try {
            const duration = await getAudioDuration(file);

            if (duration > MAX_SOUND_DURATION_SECONDS) {
                setError(t('soundpad.tooLong'));

                return;
            }

            const sound: ISoundpadSound = {
                accountId: user.id,
                createdAt: Date.now(),
                data: file.slice(0, file.size, file.type),
                duration,
                id: crypto.randomUUID(),
                name: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
                type: file.type
            };

            await saveSoundpadSound(sound);
            setSounds(current => [ ...current, sound ]);
            setStatus(t('soundpad.uploaded', { name: sound.name }));
        } catch {
            setError(t('soundpad.invalidFile'));
        } finally {
            setBusy(false);
        }
    };
    const play = async (sound: ISoundpadSound) => {
        if (!conference) {
            return;
        }

        setError('');
        setStatus('');
        setBusy(true);
        try {
            await broadcastSoundpadSound(conference, sound, !deafened, sinkId);
            setStatus(t('soundpad.playing', { name: sound.name }));
        } catch {
            setError(t('soundpad.sendError'));
        } finally {
            setBusy(false);
        }
    };
    const remove = async (sound: ISoundpadSound) => {
        setError('');
        try {
            await deleteSoundpadSound(sound.id);
            setSounds(current => current.filter(item => item.id !== sound.id));
        } catch {
            setError(t('soundpad.storageError'));
        }
    };

    return (
        <Dialog
            cancel = {{ hidden: true }}
            ok = {{ hidden: true }}
            titleKey = 'soundpad.title'>
            <p
                className = { classes.help }
                id = 'soundpad-help'>{t('soundpad.help')}</p>
            <label htmlFor = 'soundpad-file'>{t('soundpad.upload')}</label>
            <input
                accept = 'audio/*'
                aria-describedby = 'soundpad-help'
                className = { classes.file }
                disabled = { busy || !user }
                id = 'soundpad-file'
                onChange = { onUpload }
                type = 'file' />
            {error && <div
                aria-live = 'assertive'
                className = { classes.error }
                role = 'alert'>{error}</div>}
            {status && <div
                aria-live = 'polite'
                className = { classes.status }
                role = 'status'>{status}</div>}
            {sounds.length ? <ul className = { classes.list }>
                {sounds.map(sound => (<li
                    className = { classes.row }
                    key = { sound.id }>
                    <span>{sound.name} ({sound.duration.toFixed(1)}s)</span>
                    <div className = { classes.actions }>
                        <Button
                            accessibilityLabel = { t('soundpad.play', { name: sound.name }) }
                            disabled = { busy || !conference }
                            label = { t('soundpad.playButton') }
                            onClick = { () => play(sound) }
                            size = 'small' />
                        <Button
                            accessibilityLabel = { t('soundpad.delete', { name: sound.name }) }
                            disabled = { busy }
                            label = { t('soundpad.deleteButton') }
                            onClick = { () => remove(sound) }
                            size = 'small'
                            type = 'secondary' />
                    </div>
                </li>))}
            </ul> : <p className = { classes.status }>{t('soundpad.empty')}</p>}
        </Dialog>
    );
}
