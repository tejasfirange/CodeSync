import { Code2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const AuthHeader = () => {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <header className="cyber-navbar fixed inset-x-0 top-0 z-40 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="cyber-brand-icon flex h-10 w-10 items-center justify-center rounded-lg">
            <Code2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-black text-white">CodeSync</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link className="cyber-nav-link hidden h-10 items-center rounded-lg px-3 text-sm font-bold transition sm:inline-flex" to="/">
            Home
          </Link>
          <Link
            className="cyber-btn cyber-btn-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-black transition"
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
