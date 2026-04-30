import { Code2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const AuthHeader = () => {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#060807]/88 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-300/40 bg-teal-300/10 text-teal-200">
            <Code2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-black text-white">CodeSync</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link className="hidden h-10 items-center rounded-lg px-3 text-sm font-bold text-neutral-200 transition hover:bg-white/10 sm:inline-flex" to="/">
            Home
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-lg bg-teal-300 px-4 text-sm font-black text-neutral-950 transition hover:bg-teal-200"
            to={isLogin ? '/register' : '/login'}
          >
            {isLogin ? 'Create account' : 'Login'}
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default AuthHeader;
