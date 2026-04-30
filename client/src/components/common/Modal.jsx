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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <div className={`flex max-h-[calc(100vh-2rem)] w-full ${widths[size] || widths.md} flex-col rounded-lg bg-white shadow-panel dark:border dark:border-white/10 dark:bg-[#101413]`}>
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-bold text-neutral-950 dark:text-white">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-white/10">{footer}</div> : null}
      </div>
    </div>
  );
};

export default Modal;
