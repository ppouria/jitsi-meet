/* eslint-disable react/jsx-no-bind */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connect, useDispatch } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState } from '../../../app/types';
import Avatar from '../../../base/avatar/components/Avatar';
import { isNameReadOnly } from '../../../base/config/functions.web';
import { IconArrowDown, IconArrowUp, IconPhoneRinging, IconVolumeOff } from '../../../base/icons/svg';
import { isVideoMutedByUser } from '../../../base/media/functions';
import { getLocalParticipant } from '../../../base/participants/functions';
import Popover from '../../../base/popover/components/Popover.web';
import ActionButton from '../../../base/premeeting/components/web/ActionButton';
import PreMeetingScreen from '../../../base/premeeting/components/web/PreMeetingScreen';
import { updateSettings } from '../../../base/settings/actions';
import { getDisplayName } from '../../../base/settings/functions.web';
import { getLocalJitsiVideoTrack } from '../../../base/tracks/functions.web';
import Button from '../../../base/ui/components/web/Button';
import Input from '../../../base/ui/components/web/Input';
import { BUTTON_TYPES } from '../../../base/ui/constants.any';
import isInsecureRoomName from '../../../base/util/isInsecureRoomName';
import { openDisplayNamePrompt } from '../../../display-name/actions';
import { isUnsafeRoomWarningEnabled } from '../../../prejoin/functions';
import {
    joinConference as joinConferenceAction,
    joinConferenceWithoutAudio as joinConferenceWithoutAudioAction,
    setJoinByPhoneDialogVisiblity as setJoinByPhoneDialogVisiblityAction
} from '../../actions.web';
import {
    isDeviceStatusVisible,
    isDisplayNameRequired,
    isJoinByPhoneButtonVisible,
    isJoinByPhoneDialogVisible,
    isPrejoinDisplayNameVisible
} from '../../functions';
import logger from '../../logger';
import { IPrejoinParticipant, getRoomInfoURL, parsePrejoinParticipants } from '../../roomInfo';
import { hasDisplayName } from '../../utils';

import JoinByPhoneDialog from './dialogs/JoinByPhoneDialog';

interface IProps {

    /**
     * Flag signaling if the device status is visible or not.
     */
    deviceStatusVisible: boolean;

    /**
     * If join by phone button should be visible.
     */
    hasJoinByPhoneButton: boolean;

    /**
     * Flag signaling if the display name is visible or not.
     */
    isDisplayNameVisible: boolean;

    /**
     * Joins the current meeting.
     */
    joinConference: Function;

    /**
     * Joins the current meeting without audio.
     */
    joinConferenceWithoutAudio: Function;

    /**
     * Whether conference join is in progress.
     */
    joiningInProgress?: boolean;

    /**
     * JWT used to securely query the room before joining.
     */
    jwt?: string;

    /**
     * Current meeting URL.
     */
    locationURL?: URL;

    /**
     * The name of the user that is about to join.
     */
    name: string;

    /**
     * Local participant id.
     */
    participantId?: string;

    /**
     * The prejoin config.
     */
    prejoinConfig?: any;

    /**
     * Whether the name input should be read only or not.
     */
    readOnlyName: boolean;

    /**
     * The room about to be joined.
     */
    roomName?: string;

    /**
     * Sets visibility of the 'JoinByPhoneDialog'.
     */
    setJoinByPhoneDialogVisiblity: Function;

    /**
     * Flag signaling the visibility of camera preview.
     */
    showCameraPreview: boolean;

    /**
     * If 'JoinByPhoneDialog' is visible or not.
     */
    showDialog: boolean;

    /**
     * If should show an error when joining without a name.
     */
    showErrorOnJoin: boolean;

    /**
     * If the recording warning is visible or not.
     */
    showRecordingWarning: boolean;

    /**
     * If should show unsafe room warning when joining.
     */
    showUnsafeRoomWarning: boolean;

    /**
     * Whether the user has approved to join a room with unsafe name.
     */
    unsafeRoomConsent?: boolean;

    /**
     * Updates settings.
     */
    updateSettings: Function;

    /**
     * The JitsiLocalTrack to display.
     */
    videoTrack?: Object;
}

const useStyles = makeStyles()(theme => {
    return {
        inputContainer: {
            width: '100%'
        },

        input: {
            width: '100%',
            marginBottom: theme.spacing(3),

            '& input': {
                textAlign: 'center'
            }
        },

        avatarContainer: {
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column'
        },

        avatar: {
            margin: `${theme.spacing(2)} auto ${theme.spacing(3)}`
        },

        avatarName: {
            ...theme.typography.bodyShortBoldLarge,
            color: theme.palette.prejoinTitleText,
            marginBottom: theme.spacing(5),
            textAlign: 'center'
        },

        error: {
            backgroundColor: theme.palette.prejoinActionButtonDanger,
            color: theme.palette.prejoinActionButtonPrimaryText,
            borderRadius: theme.shape.borderRadius,
            width: '100%',
            ...theme.typography.labelRegular,
            boxSizing: 'border-box',
            padding: theme.spacing(1),
            textAlign: 'center',
            marginTop: `-${theme.spacing(2)}`,
            marginBottom: theme.spacing(3)
        },

        dropdownContainer: {
            position: 'relative',
            width: '100%'
        },

        participants: {
            alignItems: 'center',
            color: theme.palette.prejoinTitleText,
            display: 'flex',
            flexDirection: 'column',
            marginBottom: theme.spacing(3),
            textAlign: 'center'
        },

        participantAvatars: {
            display: 'flex',
            justifyContent: 'center',
            marginBottom: theme.spacing(1),
            paddingLeft: theme.spacing(1)
        },

        participantAvatar: {
            border: `2px solid ${theme.palette.preMeetingBackground}`,
            borderRadius: '50%',
            marginLeft: `-${theme.spacing(1)}`
        },

        participantCount: {
            ...theme.typography.bodyShortBold,
            marginBottom: theme.spacing(1)
        },

        participantNames: {
            ...theme.typography.bodyShortRegular,
            color: theme.palette.prejoinRoomNameText,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },

        participantOverflow: {
            alignItems: 'center',
            background: theme.palette.ui03,
            border: `2px solid ${theme.palette.preMeetingBackground}`,
            borderRadius: '50%',
            display: 'flex',
            height: '36px',
            justifyContent: 'center',
            marginLeft: `-${theme.spacing(1)}`,
            width: '36px',
            ...theme.typography.labelBold
        },

        dropdownButtons: {
            width: '300px',
            padding: '8px 0',
            backgroundColor: theme.palette.prejoinActionButtonSecondary,
            color: theme.palette.prejoinActionButtonSecondaryText,
            borderRadius: theme.shape.borderRadius,
            position: 'relative',
            top: `-${theme.spacing(3)}`,

            '@media (max-width: 511px)': {
                margin: '0 auto',
                top: 0
            },

            '@media (max-width: 420px)': {
                top: 0,
                width: 'calc(100% - 32px)'
            }
        }
    };
});

const Prejoin = ({
    deviceStatusVisible,
    hasJoinByPhoneButton,
    isDisplayNameVisible,
    joinConference,
    joinConferenceWithoutAudio,
    joiningInProgress,
    jwt,
    locationURL,
    name,
    participantId,
    prejoinConfig,
    readOnlyName,
    roomName,
    setJoinByPhoneDialogVisiblity,
    showCameraPreview,
    showDialog,
    showErrorOnJoin,
    showRecordingWarning,
    showUnsafeRoomWarning,
    unsafeRoomConsent,
    updateSettings: dispatchUpdateSettings,
    videoTrack
}: IProps) => {
    const showDisplayNameField = useMemo(
        () => isDisplayNameVisible && !readOnlyName,
        [ isDisplayNameVisible, readOnlyName ]);
    const showErrorOnField = useMemo(
        () => showDisplayNameField && showErrorOnJoin,
        [ showDisplayNameField, showErrorOnJoin ]);
    const [ roomParticipants, setRoomParticipants ] = useState<IPrejoinParticipant[]>();
    const [ showJoinByPhoneButtons, setShowJoinByPhoneButtons ] = useState(false);
    const { classes } = useStyles();
    const { t } = useTranslation();
    const dispatch = useDispatch();

    useEffect(() => {
        if (!jwt || !locationURL || !roomName) {
            return;
        }

        let mounted = true;
        const loadParticipants = async () => {
            try {
                const response = await fetch(getRoomInfoURL(locationURL, roomName), {
                    headers: {
                        Authorization: `Bearer ${jwt}`
                    }
                });

                if (response.status === 404) {
                    mounted && setRoomParticipants([]);

                    return;
                }
                if (!response.ok) {
                    throw new Error(`Room info request failed (${response.status}).`);
                }

                const participants = parsePrejoinParticipants(await response.json());

                if (mounted && participants) {
                    setRoomParticipants(participants);
                }
            } catch (error) {
                logger.warn('Unable to load prejoin participants.', error);
            }
        };

        setRoomParticipants(undefined);
        void loadParticipants();
        const interval = window.setInterval(loadParticipants, 15000);

        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
    }, [ jwt, locationURL, roomName ]);

    /**
     * Handler for the join button.
     *
     * @param {Object} e - The synthetic event.
     * @returns {void}
     */
    const onJoinButtonClick = () => {
        if (showErrorOnJoin) {
            dispatch(openDisplayNamePrompt({
                onPostSubmit: joinConference,
                validateInput: hasDisplayName
            }));

            return;
        }

        logger.info('Prejoin join button clicked.');

        joinConference();
    };

    /**
     * Closes the dropdown.
     *
     * @returns {void}
     */
    const onDropdownClose = () => {
        setShowJoinByPhoneButtons(false);
    };

    /**
     * Displays the join by phone buttons dropdown.
     *
     * @param {Object} e - The synthetic event.
     * @returns {void}
     */
    const onOptionsClick = (e?: React.KeyboardEvent | React.MouseEvent | undefined) => {
        e?.stopPropagation();

        setShowJoinByPhoneButtons(show => !show);
    };

    /**
     * Sets the guest participant name.
     *
     * @param {string} displayName - Participant name.
     * @returns {void}
     */
    const setName = (displayName: string) => {
        dispatchUpdateSettings({
            displayName
        });
    };

    /**
     * Closes the join by phone dialog.
     *
     * @returns {undefined}
     */
    const closeDialog = () => {
        setJoinByPhoneDialogVisiblity(false);
    };

    /**
     * Displays the dialog for joining a meeting by phone.
     *
     * @returns {undefined}
     */
    const doShowDialog = () => {
        setJoinByPhoneDialogVisiblity(true);
        onDropdownClose();
    };

    /**
     * KeyPress handler for accessibility.
     *
     * @param {Object} e - The key event to handle.
     *
     * @returns {void}
     */
    const showDialogKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            doShowDialog();
        }
    };

    /**
     * KeyPress handler for accessibility.
     *
     * @param {Object} e - The key event to handle.
     *
     * @returns {void}
     */
    const onJoinConferenceWithoutAudioKeyPress = (e: React.KeyboardEvent) => {
        if (joinConferenceWithoutAudio
            && (e.key === ' '
                || e.key === 'Enter')) {
            e.preventDefault();
            logger.info('Prejoin joinConferenceWithoutAudio dispatched on a key pressed.');
            joinConferenceWithoutAudio();
        }
    };

    /**
     * Gets the list of extra join buttons.
     *
     * @returns {Object} - The list of extra buttons.
     */
    const getExtraJoinButtons = () => {
        const noAudio = {
            key: 'no-audio',
            testId: 'prejoin.joinWithoutAudio',
            icon: IconVolumeOff,
            label: t('prejoin.joinWithoutAudio'),
            onClick: () => {
                logger.info('Prejoin join conference without audio pressed.');
                joinConferenceWithoutAudio();
            },
            onKeyPress: onJoinConferenceWithoutAudioKeyPress
        };

        const byPhone = {
            key: 'by-phone',
            testId: 'prejoin.joinByPhone',
            icon: IconPhoneRinging,
            label: t('prejoin.joinAudioByPhone'),
            onClick: doShowDialog,
            onKeyPress: showDialogKeyPress
        };

        return {
            noAudio,
            byPhone
        };
    };

    /**
     * Handle keypress on input.
     *
     * @param {KeyboardEvent} e - Keyboard event.
     * @returns {void}
     */
    const onInputKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            logger.info('Dispatching join conference on Enter key press from the prejoin screen.');
            joinConference();
        }
    };

    const extraJoinButtons = getExtraJoinButtons();
    let extraButtonsToRender = Object.values(extraJoinButtons).filter((val: any) =>
        !(prejoinConfig?.hideExtraJoinButtons || []).includes(val.key)
    );

    if (!hasJoinByPhoneButton) {
        extraButtonsToRender = extraButtonsToRender.filter((btn: any) => btn.key !== 'by-phone');
    }
    const hasExtraJoinButtons = Boolean(extraButtonsToRender.length);
    const visibleParticipants = roomParticipants?.slice(0, 5) ?? [];
    const namedParticipants = roomParticipants?.slice(0, 3)
        .map(participant => participant.displayName || t('prejoin.participantFallback')) ?? [];
    const hiddenParticipantCount = (roomParticipants?.length ?? 0) - visibleParticipants.length;

    return (
        <PreMeetingScreen
            showDeviceStatus = { deviceStatusVisible }
            showRecordingWarning = { showRecordingWarning }
            showUnsafeRoomWarning = { showUnsafeRoomWarning }
            title = { t('prejoin.joinMeeting') }
            videoMuted = { !showCameraPreview }
            videoTrack = { videoTrack }>
            <div
                className = { classes.inputContainer }
                data-testid = 'prejoin.screen'>
                {showDisplayNameField ? (<Input
                    accessibilityLabel = { t('dialog.enterDisplayName') }
                    autoComplete = { 'name' }
                    autoFocus = { true }
                    className = { classes.input }
                    describedBy = { showErrorOnField ? 'prejoin-error-missing-name' : undefined }
                    error = { showErrorOnField }
                    id = 'premeeting-name-input'
                    onChange = { setName }
                    onKeyPress = { showUnsafeRoomWarning && !unsafeRoomConsent ? undefined : onInputKeyPress }
                    placeholder = { t('dialog.enterDisplayName') }
                    readOnly = { readOnlyName }
                    required = { true }
                    value = { name } />
                ) : (
                    <div className = { classes.avatarContainer }>
                        <Avatar
                            className = { classes.avatar }
                            displayName = { name }
                            participantId = { participantId }
                            size = { 72 } />
                        {isDisplayNameVisible && <div className = { classes.avatarName }>{name}</div>}
                    </div>
                )}

                {showErrorOnField && <div
                    className = { classes.error }
                    data-testid = 'prejoin.errorMessage'>
                    <p
                        aria-live = 'polite'
                        id = 'prejoin-error-missing-name' >
                        {t('prejoin.errorMissingName')}
                    </p>
                </div>}

                {roomParticipants && <section
                    aria-label = { roomParticipants.length
                        ? t('prejoin.peopleAlreadyHere', { count: roomParticipants.length })
                        : t('prejoin.noOneElseHere') }
                    aria-live = 'polite'
                    className = { classes.participants }
                    data-testid = 'prejoin.participants'>
                    {roomParticipants.length ? <>
                        <div
                            aria-hidden = 'true'
                            className = { classes.participantAvatars }>
                            {visibleParticipants.map(participant => (<Avatar
                                className = { classes.participantAvatar }
                                displayName = { participant.displayName }
                                key = { participant.id }
                                participantId = { participant.id }
                                size = { 36 } />))}
                            {hiddenParticipantCount > 0 && <span className = { classes.participantOverflow }>
                                +{hiddenParticipantCount}
                            </span>}
                        </div>
                        <div className = { classes.participantCount }>
                            {t('prejoin.peopleAlreadyHere', { count: roomParticipants.length })}
                        </div>
                        <div className = { classes.participantNames }>{namedParticipants.join(', ')}</div>
                    </> : <div className = { classes.participantCount }>{t('prejoin.noOneElseHere')}</div>}
                </section>}

                <div className = { classes.dropdownContainer }>
                    <Popover
                        content = { hasExtraJoinButtons && <div className = { classes.dropdownButtons }>
                            {extraButtonsToRender.map(({ key, ...rest }) => (
                                <Button
                                    disabled = { joiningInProgress || showErrorOnField }
                                    fullWidth = { true }
                                    key = { key }
                                    type = { BUTTON_TYPES.SECONDARY }
                                    { ...rest } />
                            ))}
                        </div> }
                        onPopoverClose = { onDropdownClose }
                        position = 'bottom'
                        trigger = 'click'
                        visible = { showJoinByPhoneButtons }>
                        <ActionButton
                            OptionsIcon = { showJoinByPhoneButtons ? IconArrowUp : IconArrowDown }
                            ariaDropDownLabel = { t('prejoin.joinWithoutAudio') }
                            ariaLabel = { t('prejoin.joinMeeting') }
                            ariaPressed = { showJoinByPhoneButtons }
                            disabled = { joiningInProgress
                                || (showUnsafeRoomWarning && !unsafeRoomConsent)
                                || showErrorOnField }
                            hasOptions = { hasExtraJoinButtons }
                            onClick = { onJoinButtonClick }
                            onOptionsClick = { onOptionsClick }
                            role = 'button'
                            tabIndex = { 0 }
                            testId = 'prejoin.joinMeeting'
                            type = 'primary'>
                            {t('prejoin.joinMeeting')}
                        </ActionButton>
                    </Popover>
                </div>
            </div>
            {showDialog && (
                <JoinByPhoneDialog
                    joinConferenceWithoutAudio = { joinConferenceWithoutAudio }
                    onClose = { closeDialog } />
            )}
        </PreMeetingScreen>
    );
};


/**
 * Maps (parts of) the redux state to the React {@code Component} props.
 *
 * @param {Object} state - The redux state.
 * @returns {Object}
 */
function mapStateToProps(state: IReduxState) {
    const name = getDisplayName(state);
    const showErrorOnJoin = isDisplayNameRequired(state) && !name;
    const { id: participantId } = getLocalParticipant(state) ?? {};
    const { joiningInProgress } = state['features/prejoin'];
    const { room } = state['features/base/conference'];
    const { locationURL } = state['features/base/connection'];
    const { jwt } = state['features/base/jwt'];
    const { unsafeRoomConsent } = state['features/base/premeeting'];
    const config = state['features/base/config'];
    const { showPrejoinWarning: showRecordingWarning } = config.recordings ?? {};

    return {
        deviceStatusVisible: isDeviceStatusVisible(state),
        hasJoinByPhoneButton: isJoinByPhoneButtonVisible(state),
        isDisplayNameVisible: isPrejoinDisplayNameVisible(state),
        joiningInProgress,
        jwt,
        locationURL,
        name,
        participantId,
        prejoinConfig: state['features/base/config'].prejoinConfig,
        readOnlyName: isNameReadOnly(state),
        roomName: room,
        showCameraPreview: !isVideoMutedByUser(state),
        showDialog: isJoinByPhoneDialogVisible(state),
        showErrorOnJoin,
        showRecordingWarning: Boolean(showRecordingWarning),
        showUnsafeRoomWarning: isInsecureRoomName(room) && isUnsafeRoomWarningEnabled(state),
        unsafeRoomConsent,
        videoTrack: getLocalJitsiVideoTrack(state)
    };
}

const mapDispatchToProps = {
    joinConferenceWithoutAudio: joinConferenceWithoutAudioAction,
    joinConference: joinConferenceAction,
    setJoinByPhoneDialogVisiblity: setJoinByPhoneDialogVisiblityAction,
    updateSettings
};

export default connect(mapStateToProps, mapDispatchToProps)(Prejoin);
