import { Eye, MonitorUp, ScreenShareOff } from 'lucide-react';
import Button from '../common/Button.jsx';

const ScreenShareButton = ({ activeShare, isSharing, canShare, status, onStart, onStop, onOpen, currentUserId }) => {
  const busy = status === 'starting';
  const someoneElseSharing = Boolean(activeShare && activeShare.sharerUserId !== currentUserId);

  if (isSharing) {
    return (
      <Button variant="danger" icon={ScreenShareOff} onClick={() => onStop?.()} disabled={busy}>
        Stop Sharing
      </Button>
    );
  }

  if (someoneElseSharing) {
    return (
      <Button variant="secondary" icon={Eye} onClick={onOpen}>
        View Screen
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      icon={MonitorUp}
      onClick={onStart}
      disabled={busy}
      title={canShare ? 'Share screen' : 'Screen sharing is disabled by the room owner.'}
    >
      {busy ? 'Starting' : 'Share Screen'}
    </Button>
  );
};

export default ScreenShareButton;
