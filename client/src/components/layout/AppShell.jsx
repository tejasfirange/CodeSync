import { Code2, LogOut, PanelsTopLeft } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import { getInitials } from '../../utils/constants.js';
import clsx from '../../utils/clsx.js';

const AppShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRoomWorkspace = /^\/rooms\/[^/]+/.test(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="cyber-app h-screen overflow-hidden text-white transition-colors">
      <header className="cyber-navbar relative z-30 h-16 shrink-0">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-8">
            <Link to="/dashboard" className="cyber-brand flex shrink-0 items-center gap-3">
              <span className="cyber-brand-icon flex h-10 w-10 items-center justify-center rounded-lg">
                <Code2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-black tracking-normal text-[var(--text-main)]">CodeSync</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  clsx(
                    'cyber-nav-link inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition',
                    isActive
                      ? 'active'
                      : ''
                  )
                }
              >
                <PanelsTopLeft className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </NavLink>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="cyber-user-card hidden max-w-[260px] items-center gap-3 px-2 py-1.5 sm:flex">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                style={{ backgroundColor: user?.avatarColor || '#0f766e' }}
              >
                {getInitials(user?.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{user?.name}</p>
                <p className="truncate text-xs text-neutral-400">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="cyber-icon-button inline-flex h-10 w-10 items-center justify-center"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className={isRoomWorkspace ? 'cyber-main room-workspace-main h-[calc(100vh-64px)] overflow-hidden' : 'cyber-main dashboard-main mx-auto h-[calc(100vh-64px)] max-w-7xl overflow-y-auto px-4 py-6 sm:px-6 lg:px-8'}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
