import { LockKeyhole, TerminalSquare } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import AuthHeader from '../components/layout/AuthHeader.jsx';
import useAuth from '../hooks/useAuth.js';

const Login = () => {
  const { user, login, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const updateField = (field, value) => {
    clearError();
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(form);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#060807] text-white">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_18%,rgba(45,212,191,0.10),transparent_32%),radial-gradient(circle_at_78%_28%,rgba(20,184,166,0.08),transparent_28%)]"
        aria-hidden="true"
      />
      <AuthHeader />
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-4 pb-8 pt-24 sm:px-6 lg:grid-cols-[1fr_480px] lg:px-8">
        <section className="hidden min-h-0 flex-col justify-center gap-16 py-8 lg:flex">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-teal-300/25 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-teal-100">
              <TerminalSquare className="h-4 w-4" aria-hidden="true" />
              Access node
            </div>
            <h1 className="text-5xl font-black leading-none tracking-normal">Return to your collaboration grid.</h1>
            <p className="mt-5 text-base font-medium leading-7 text-neutral-300">
              Open rooms, sync files, watch live cursors, and keep the conversation close to the code.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-black p-4 font-mono text-sm text-neutral-300 shadow-sm">
            <p><span className="text-teal-300">session</span>.restore()</p>
            <p><span className="text-amber-300">socket</span>.connect()</p>
            <p><span className="text-sky-300">workspace</span>.hydrate()</p>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full rounded-lg border border-white/10 bg-[#101413] p-6 shadow-2xl sm:p-8">
            <div className="mb-7">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-300 text-neutral-950">
                <LockKeyhole className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="text-3xl font-black text-white">Secure login</h1>
              <p className="mt-2 text-sm font-medium text-neutral-400">Authenticate to continue.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
                autoComplete="email"
                className="bg-[#0b0f0e]"
              />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                required
                autoComplete="current-password"
                className="bg-[#0b0f0e]"
              />
              {error ? (
                <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm font-semibold text-rose-100">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full !bg-teal-300 !text-neutral-950 hover:!bg-teal-200" disabled={loading}>
                Login
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-neutral-400">
              New here?{' '}
              <Link className="font-bold text-teal-200 hover:text-teal-100" to="/register">
                Create account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
