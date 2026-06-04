import { TerminalSquare } from 'lucide-react';
import Button from '../common/Button.jsx';

const RunButton = ({ disabled, unsupported, onRun }) => (
  <Button
    variant="secondary"
    icon={TerminalSquare}
    onClick={onRun}
    disabled={disabled}
    title={unsupported ? 'Terminal can open, but this file cannot be executed.' : 'Toggle terminal'}
  >
    Terminal
  </Button>
);

export default RunButton;
