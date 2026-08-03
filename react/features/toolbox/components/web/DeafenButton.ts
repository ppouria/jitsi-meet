import { connect } from 'react-redux';

import { createToolbarEvent } from '../../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../../analytics/functions';
import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconVolumeOff, IconVolumeUp } from '../../../base/icons/svg';
import { setDeafened } from '../../../base/media/actions';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { closeOverflowMenuIfOpen } from '../../actions.web';

interface IProps extends AbstractButtonProps {
    _deafened: boolean;
}

/**
 * A button that mutes both the microphone and all incoming participant audio.
 */
class DeafenButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.deafen';
    override icon = IconVolumeUp;
    override label = 'toolbar.deafen';
    override toggledAccessibilityLabel = 'toolbar.accessibilityLabel.undeafen';
    override toggledIcon = IconVolumeOff;
    override toggledLabel = 'toolbar.undeafen';
    override toggledTooltip = 'toolbar.undeafen';
    override tooltip = 'toolbar.deafen';

    override _isToggled() {
        return this.props._deafened;
    }

    override _handleClick() {
        const { _deafened, dispatch } = this.props;

        sendAnalytics(createToolbarEvent('toggle.deafen', { enable: !_deafened }));
        dispatch(closeOverflowMenuIfOpen());
        dispatch(setDeafened(!_deafened));
    }
}

export default translate(connect((state: IReduxState) => ({
    _deafened: state['features/base/media'].audio.deafened
}))(DeafenButton));
