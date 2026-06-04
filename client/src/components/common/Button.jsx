import clsx from '../../utils/clsx.js';

const variants = {
  primary: 'cyber-btn cyber-btn-primary',
  secondary:
    'cyber-btn cyber-btn-secondary',
  ghost: 'cyber-btn cyber-btn-ghost',
  danger: 'cyber-btn cyber-btn-danger'
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
