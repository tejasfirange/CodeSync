import { TerminalSquare } from 'lucide-react';
import Button from '../common/Button.jsx';

const RunButton = ({ disabled, unsupported, onRun, open = false }) => (
  <Button
    variant="secondary"
    icon={TerminalSquare}
    onClick={onRun}
    disabled={disabled}
    aria-expanded={open}
    aria-pressed={open}
    title={unsupported ? 'Terminal can open, but this file cannot be executed.' : open ? 'Collapse terminal panel' : 'Open terminal panel'}
  >
    Terminal
  </Button>
);

export default RunButton;
