/* eslint-disable react/jsx-no-bind */
import React, { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IStore } from '../../../app/types';
import { hideDialog } from '../../../base/dialog/actions';
import Button from '../../../base/ui/components/web/Button';
import Dialog from '../../../base/ui/components/web/Dialog';
import Input from '../../../base/ui/components/web/Input';
import { loginAccount, signupAccount } from '../../actions.web';
import { IAccountProfile } from '../../types';

const useStyles = makeStyles()(theme => ({
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: theme.spacing(4)
    },
    error: {
        color: theme.palette.textError,
        marginTop: theme.spacing(3)
    },
    field: {
        marginTop: theme.spacing(3)
    },
    tabs: {
        display: 'flex',
        gap: theme.spacing(2)
    }
}));

interface IProps {
    onAuthenticated?: (user: IAccountProfile) => void;
    onCancel?: () => void;
}

export default function AccountAuthDialog({ onAuthenticated, onCancel }: IProps) {
    const { classes } = useStyles();
    const dispatch = useDispatch<IStore['dispatch']>();
    const { t } = useTranslation();
    const [ mode, setMode ] = useState<'login' | 'signup'>('login');
    const [ login, setLogin ] = useState('');
    const [ username, setUsername ] = useState('');
    const [ email, setEmail ] = useState('');
    const [ nickname, setNickname ] = useState('');
    const [ password, setPassword ] = useState('');
    const [ error, setError ] = useState('');
    const [ submitting, setSubmitting ] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const user = mode === 'login'
                ? await dispatch(loginAccount(login, password))
                : await dispatch(signupAccount(username, email, nickname, password));

            dispatch(hideDialog('AccountAuthDialog', AccountAuthDialog));
            onAuthenticated?.(user);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : t('account.requestFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            cancel = {{ translationKey: 'dialog.Cancel' }}
            ok = {{ hidden: true }}
            onCancel = { onCancel }
            title = { t('account.title') }>
            <div className = { classes.tabs }>
                <Button
                    accessibilityLabel = { t('account.login') }
                    label = { t('account.login') }
                    onClick = { () => {
                        setError('');
                        setMode('login');
                    } }
                    type = { mode === 'login' ? 'primary' : 'secondary' } />
                <Button
                    accessibilityLabel = { t('account.signup') }
                    label = { t('account.signup') }
                    onClick = { () => {
                        setError('');
                        setMode('signup');
                    } }
                    type = { mode === 'signup' ? 'primary' : 'secondary' } />
            </div>
            <form onSubmit = { submit }>
                {mode === 'login' && <Input
                    autoComplete = 'username'
                    autoFocus = { true }
                    className = { classes.field }
                    id = 'account-login'
                    label = { t('account.loginIdentifier') }
                    onChange = { setLogin }
                    required = { true }
                    type = 'text'
                    value = { login } />}
                {mode === 'signup' && <>
                    <Input
                        autoComplete = 'username'
                        autoFocus = { true }
                        className = { classes.field }
                        id = 'account-username'
                        label = { t('account.username') }
                        maxLength = { 32 }
                        onChange = { setUsername }
                        required = { true }
                        type = 'text'
                        value = { username } />
                    <Input
                        autoComplete = 'email'
                        className = { classes.field }
                        id = 'account-email'
                        label = { t('account.email') }
                        onChange = { setEmail }
                        required = { true }
                        type = 'email'
                        value = { email } />
                    <Input
                        autoComplete = 'name'
                        className = { classes.field }
                        id = 'account-nickname'
                        label = { t('account.nickname') }
                        maxLength = { 80 }
                        onChange = { setNickname }
                        required = { true }
                        type = 'text'
                        value = { nickname } />
                </>}
                <Input
                    autoComplete = { mode === 'login' ? 'current-password' : 'new-password' }
                    className = { classes.field }
                    id = 'account-password'
                    label = { t('account.password') }
                    onChange = { setPassword }
                    required = { true }
                    type = 'password'
                    value = { password } />
                {error && <div
                    aria-live = 'assertive'
                    className = { classes.error }
                    role = 'alert'>
                    {error}
                </div>}
                <div className = { classes.actions }>
                    <Button
                        accessibilityLabel = { mode === 'login' ? t('account.login') : t('account.createAccount') }
                        disabled = { submitting }
                        isSubmit = { true }
                        label = { mode === 'login' ? t('account.login') : t('account.createAccount') } />
                </div>
            </form>
        </Dialog>
    );
}
