const EmptyState = ({ icon: Icon, title, action }) => (
  <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-8 text-center dark:border-white/12 dark:bg-[#101413]">
    {Icon ? <Icon className="mb-3 h-8 w-8 text-neutral-400 dark:text-neutral-500" aria-hidden="true" /> : null}
    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{title}</h3>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export default EmptyState;
