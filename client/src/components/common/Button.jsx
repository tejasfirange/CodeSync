import clsx from '../../utils/clsx.js';

const variants = {
  primary: 'bg-neutral-950 text-white hover:bg-neutral-800 focus-visible:ring-neutral-900 dark:bg-teal-300 dark:text-neutral-950 dark:hover:bg-teal-200',
  secondary:
    'bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 focus-visible:ring-teal-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10',
  ghost: 'text-neutral-700 hover:bg-neutral-100 focus-visible:ring-teal-700 dark:text-neutral-200 dark:hover:bg-white/10',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600'
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9 p-0'
};

const Button = ({ type = 'button', variant = 'primary', size = 'md', icon: Icon, children, className = '', ...props }) => (
  <button
    type={type}
    className={clsx(
      'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  >
    {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
    {children}
  </button>
);

export default Button;
