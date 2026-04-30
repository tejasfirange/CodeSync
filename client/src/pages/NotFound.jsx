import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4 dark:bg-[#060807]">
    <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-panel dark:border-white/10 dark:bg-[#101413]">
      <h1 className="text-3xl font-black text-neutral-950 dark:text-white">Not found</h1>
      <p className="mt-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">This route is not available.</p>
      <Link
        to="/"
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        Home
      </Link>
    </div>
  </div>
);

export default NotFound;
