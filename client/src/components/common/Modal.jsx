import { X } from 'lucide-react';
import Button from './Button.jsx';

const widths = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-[720px]'
};

const Modal = ({ title, open, onClose, children, footer, size = 'md' }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="cyber-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`cyber-modal flex max-h-[calc(100vh-2rem)] w-full ${widths[size] || widths.md} flex-col`}>
        <div className="cyber-modal-header flex shrink-0 items-center justify-between px-5 py-4">
          <h2 className="text-base font-black text-[var(--text-main)]">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="cyber-modal-footer flex shrink-0 justify-end gap-2 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
};

export default Modal;
