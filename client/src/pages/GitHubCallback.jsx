import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/common/Button.jsx';

const GitHubCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status');
  const message = params.get('message');
  const success = status === 'success';

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-300/15 dark:text-teal-200">
          {success ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <ShieldAlert className="h-6 w-6" aria-hidden="true" />}
        </div>
        <h1 className="mt-4 text-xl font-black text-neutral-950 dark:text-white">{success ? 'GitHub connected' : 'GitHub connection failed'}</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-neutral-500 dark:text-neutral-400">
          {success ? 'You can return to your project and select a repository.' : message || 'GitHub could not finish the connection.'}
        </p>
        <Button onClick={() => navigate('/dashboard')} className="mt-5 w-full">
          Dashboard
        </Button>
      </section>
    </div>
  );
};

export default GitHubCallback;
