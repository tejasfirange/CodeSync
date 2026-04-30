const Spinner = ({ label = 'Loading' }) => (
  <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-teal-700 dark:border-neutral-700 dark:border-t-teal-300" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export default Spinner;
