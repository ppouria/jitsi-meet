import { connect } from 'react-redux';

import { createToolbarEvent } from '../../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../../analytics/functions';
import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconDeviceHeadphone, IconDeviceHeadphoneSlash } from '../../../base/icons/svg';
import { setDeafened } from '../../../base/media/actions';
import { playSound, registerSound, unregisterSound } from '../../../base/sounds/actions';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { registerShortcut, unregisterShortcut } from '../../../keyboard-shortcuts/actions';
import { closeOverflowMenuIfOpen } from '../../actions.web';

const DEAFEN_SOUND_ID = 'DEAFEN_SOUND';
const UNDEAFEN_SOUND_ID = 'UNDEAFEN_SOUND';

interface IProps extends AbstractButtonProps {
    _deafened: boolean;
}

/**
 * A button that mutes both the microphone and all incoming participant audio.
 */
class DeafenButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.deafen';
    override icon = IconDeviceHeadphone;
    override label = 'toolbar.deafen';
    override toggledAccessibilityLabel = 'toolbar.accessibilityLabel.undeafen';
    override toggledIcon = IconDeviceHeadphoneSlash;
    override toggledLabel = 'toolbar.undeafen';
    override toggledTooltip = 'toolbar.undeafen';
    override tooltip = 'toolbar.deafen';

    constructor(props: IProps) {
        super(props);

        this._onKeyboardShortcut = this._onKeyboardShortcut.bind(this);
    }

    override componentDidMount() {
        const { dispatch } = this.props;

        dispatch(registerSound(DEAFEN_SOUND_ID, 'left.mp3'));
        dispatch(registerSound(UNDEAFEN_SOUND_ID, 'joined.mp3'));
        dispatch(registerShortcut({
            character: 'H',
            handler: this._onKeyboardShortcut,
            helpDescription: 'keyboardShortcuts.deafen'
        }));
    }

    override componentWillUnmount() {
        const { dispatch } = this.props;

        dispatch(unregisterShortcut('H'));
        dispatch(unregisterSound(DEAFEN_SOUND_ID));
        dispatch(unregisterSound(UNDEAFEN_SOUND_ID));
    }

    override _isToggled() {
        return this.props._deafened;
    }

    override _handleClick() {
        const { _deafened, dispatch } = this.props;

        sendAnalytics(createToolbarEvent('toggle.deafen', { enable: !_deafened }));
        dispatch(closeOverflowMenuIfOpen());
        dispatch(setDeafened(!_deafened));
        dispatch(playSound(_deafened ? UNDEAFEN_SOUND_ID : DEAFEN_SOUND_ID));
    }

    _onKeyboardShortcut() {
        this._handleClick();
    }
}

export default translate(connect((state: IReduxState) => ({
    _deafened: state['features/base/media'].audio.deafened
}))(DeafenButton));
