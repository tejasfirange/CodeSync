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
          'h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-2',
          'border-white/10 bg-[#0f1413] text-white placeholder:text-neutral-500 focus:border-teal-300 focus:ring-teal-300/20',
          error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : '',
          className
        )}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
};

export default Input;
