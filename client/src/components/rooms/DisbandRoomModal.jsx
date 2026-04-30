import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import Modal from '../common/Modal.jsx';

const metricValue = (value) => (Number.isFinite(value) ? value : 'Not loaded');

const DisbandRoomModal = ({ open, room, filesCount, messagesCount, loading, error, onClose, onConfirm }) => {
  const [confirmation, setConfirmation] = useState('');
  const roomName = room?.name || '';
  const canDisband = confirmation === roomName && !loading;

  const affectedData = useMemo(
    () => [
      ['Room name', roomName || 'Unknown'],
      ['Room code', room?.roomCode || 'Unknown'],
      ['Members', room?.members?.length ?? 0],
      ['Files', metricValue(filesCount)],
      ['Messages', metricValue(messagesCount)]
    ],
    [filesCount, messagesCount, room?.members?.length, room?.roomCode, roomName]
  );

  const handleClose = () => {
    if (loading) {
      return;
    }

    setConfirmation('');
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canDisband) {
      return;
    }

    await onConfirm?.();
    setConfirmation('');
  };

  return (
    <Modal
      title="Disband room?"
      open={open}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={handleSubmit} disabled={!canDisband}>
            {loading ? 'Disbanding...' : 'Disband Room Permanently'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-black text-rose-100">This action is permanent.</p>
              <p className="mt-1 text-sm leading-6 text-rose-100/80">
                All files, chat messages, projects, and GitHub connections linked to this room will be deleted.
              </p>
            </div>
          </div>
        </div>

        <dl className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-sm sm:grid-cols-2">
          {affectedData.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded bg-white/[0.03] px-3 py-2">
              <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">{label}</dt>
              <dd className="mt-1 truncate font-bold text-white" title={String(value)}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <Input
          label={`To confirm, type ${roomName}`}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={roomName}
          autoComplete="off"
          disabled={loading}
        />

        {confirmation && confirmation !== roomName ? <p className="text-sm font-semibold text-rose-200">Room name does not match.</p> : null}
        {error ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100">{error}</p> : null}
      </form>
    </Modal>
  );
};

export default DisbandRoomModal;
