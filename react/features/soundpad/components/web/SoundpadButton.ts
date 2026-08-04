import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { openDialog } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import { IconPlay } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { closeOverflowMenuIfOpen } from '../../../toolbox/actions.web';

import SoundpadDialog from './SoundpadDialog';

interface IProps extends AbstractButtonProps {
    _disabled: boolean;
}

class SoundpadButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'soundpad.open';
    override icon = IconPlay;
    override label = 'soundpad.title';
    override tooltip = 'soundpad.open';

    override _handleClick() {
        this.props.dispatch(closeOverflowMenuIfOpen());
        this.props.dispatch(openDialog('SoundpadDialog', SoundpadDialog));
    }

    override _isDisabled() {
        return this.props._disabled;
    }
}

export default translate(connect((state: IReduxState) => ({
    _disabled: !state['features/account'].user || !state['features/base/conference'].conference
}))(SoundpadButton));
