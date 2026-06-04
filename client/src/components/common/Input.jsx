import clsx from '../../utils/clsx.js';

const Input = ({ label, error, className = '', labelClassName = '', ...props }) => {
  return (
    <label className="block">
      {label ? (
        <span className={clsx('mb-2 block text-sm font-semibold text-neutral-200', labelClassName)}>
          {label}
        </span>
      ) : null}
      <input
        className={clsx(
          'cyber-input h-11 w-full px-3 text-sm outline-none transition',
          error ? 'cyber-input-error' : '',
          className
        )}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-[var(--danger)]">{error}</span> : null}
    </label>
  );
};

export default Input;
