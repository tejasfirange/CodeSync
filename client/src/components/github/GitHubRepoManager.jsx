import {
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  FileCode2,
  Github,
  GitBranch,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UploadCloud
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  connectGithubProjectRepoRequest,
  disconnectGithubAccountRequest,
  disconnectGithubRepositoryRequest,
  getGithubAccountRequest,
  getGithubOAuthStartUrl,
  getGithubRepositoryChangesRequest,
  getGithubRepositoryRequest,
  listGithubBranchesRequest,
  listGithubReposRequest,
  pullGithubRepositoryRequest,
  pushGithubRepositoryRequest
} from '../../api/github.api.js';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import Modal from '../common/Modal.jsx';
import Spinner from '../common/Spinner.jsx';

const getDefaultBranch = (repo) => repo?.defaultBranch || repo?.default_branch || 'main';

const formatDate = (value) => {
  if (!value) {
    return 'Not synced yet';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};

const getErrorHint = (error, fallback = 'GitHub request failed.') => {
  if (error?.status === 401) {
    return 'GitHub account not connected or token expired. Reconnect your GitHub account.';
  }
  if (error?.status === 403) {
    return 'Permission denied. Private repositories require GitHub repository access permission.';
  }
  if (error?.status === 404) {
    return 'Repository or branch not found.';
  }
  return error?.message || fallback;
};

const Toast = ({ type, children }) => {
  if (!children) {
    return null;
  }

  const classes =
    type === 'error'
      ? 'border-rose-300/20 bg-rose-950/60 text-rose-100'
      : 'border-teal-300/20 bg-teal-300/10 text-teal-100';

  return <p className={`rounded-lg border px-3 py-2 text-sm font-semibold ${classes}`}>{children}</p>;
};

const ProgressBar = ({ progress }) => {
  if (!progress) {
    return null;
  }

  return (
    <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-teal-100">
        <span className="truncate">{progress.label}</span>
        <span>{progress.value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300 transition-all duration-300"
          style={{ width: `${progress.value}%` }}
        />
      </div>
    </div>
  );
};

const statusLabels = {
  added: 'new',
  modified: 'changed',
  deleted: 'removed'
};

const statusClasses = {
  added: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  modified: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  deleted: 'border-rose-300/20 bg-rose-300/10 text-rose-100'
};

const ChangeBadge = ({ status }) => (
  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${statusClasses[status] || statusClasses.modified}`}>
    {statusLabels[status] || status}
  </span>
);

const VisibilityFilter = ({ value, onChange }) => (
  <div className="flex h-10 rounded-lg border border-white/10 bg-black/30 p-1">
    {['all', 'public', 'private'].map((item) => (
      <button
        key={item}
        type="button"
        onClick={() => onChange(item)}
        className={`rounded-md px-3 text-xs font-black uppercase tracking-[0.12em] transition ${
          value === item ? 'bg-teal-300 text-neutral-950' : 'text-neutral-400 hover:bg-white/10 hover:text-white'
        }`}
      >
        {item === 'all' ? 'All' : item}
      </button>
    ))}
  </div>
);

const AccountCard = ({ account, onDisconnect, working }) => (
  <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <img src={account.avatarUrl} alt="" className="h-11 w-11 rounded-lg bg-black object-cover" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <span className="truncate">@{account.username}</span>
            <CheckCircle2 className="h-4 w-4 text-teal-200" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold text-neutral-500">Connected status</p>
        </div>
      </div>
      <Button variant="ghost" icon={Trash2} onClick={onDisconnect} disabled={working}>
        Disconnect Account
      </Button>
    </div>
  </section>
);

const RepoBrowser = ({
  repositories,
  repoLoading,
  search,
  setSearch,
  visibility,
  setVisibility,
  onSelect,
  onLoadMore,
  hasNextPage,
  repoPage
}) => (
  <section className="space-y-3">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-neutral-200">Search repositories</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
          <input
            className="h-11 w-full rounded-lg border border-white/10 bg-[#0f1413] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or owner"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-neutral-200">Filter</span>
        <VisibilityFilter value={visibility} onChange={setVisibility} />
      </label>
    </div>

    {repoLoading && repositories.length === 0 ? <Spinner label="Loading repositories" /> : null}
    {!repoLoading && repositories.length === 0 ? (
      <div className="rounded-lg border border-dashed border-white/15 p-5 text-sm font-semibold text-neutral-400">No repositories found.</div>
    ) : null}

    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {repositories.map((repo) => (
        <article key={repo.repoId} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-black text-white">{repo.repoName}</h3>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-neutral-300">
                  {repo.visibility}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-neutral-500">{repo.fullName}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-neutral-500">
                <span>Default branch: {getDefaultBranch(repo)}</span>
                <span>Updated: {formatDate(repo.updatedAt)}</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onSelect(repo)} disabled={repoLoading}>
              Select
            </Button>
          </div>
        </article>
      ))}
    </div>

    {hasNextPage ? (
      <Button variant="secondary" icon={RefreshCw} onClick={() => onLoadMore(repoPage + 1)} disabled={repoLoading}>
        {repoLoading ? 'Loading' : 'Load more'}
      </Button>
    ) : null}
  </section>
);

const BranchPicker = ({ selectedRepo, branches, branchLoading, selectedBranch, setSelectedBranch, onCancel, onConfirm, working }) => (
  <section className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-100">Choose branch</p>
        <h3 className="mt-1 truncate text-sm font-black text-white">{selectedRepo?.fullName}</h3>
        <p className="mt-2 text-xs font-semibold text-neutral-400">
          Default branch: {getDefaultBranch(selectedRepo)} - {selectedRepo?.visibility}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={working}>
        Back to repositories
      </Button>
    </div>

    {branchLoading ? <Spinner label="Loading branches" /> : null}
    <label className="mt-3 block">
      <span className="mb-2 block text-sm font-semibold text-neutral-200">Branch</span>
      <select
        className="h-11 w-full rounded-lg border border-white/10 bg-[#0f1413] px-3 text-sm font-semibold text-white outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
        value={selectedBranch}
        onChange={(event) => setSelectedBranch(event.target.value)}
        disabled={branchLoading}
      >
        {branches.map((item) => (
          <option key={item.name} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
    {branches.length === 0 && !branchLoading ? (
      <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
        No branches were returned for this repository.
      </p>
    ) : null}
    <Button icon={GitBranch} onClick={onConfirm} disabled={working || branchLoading || !selectedBranch || branches.length === 0} className="mt-3 w-full">
      {working ? 'Connecting' : 'Confirm Repository'}
    </Button>
  </section>
);

const ConnectedRepoCard = ({ repository, canPush, onPull, onPush, onChange, onDisconnect, working, progress }) => (
  <section className="rounded-lg border border-white/10 bg-black/30 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Github className="h-4 w-4 text-teal-200" aria-hidden="true" />
          <span className="truncate">{repository.fullName}</span>
          <a href={repository.htmlUrl} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <p className="mt-2 text-xs font-semibold text-neutral-500">Last sync: {formatDate(repository.lastSyncAt)}</p>
      </div>
      <span className="shrink-0 rounded-full border border-teal-300/20 bg-teal-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-teal-100">
        {repository.visibility}
      </span>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg bg-black/35 p-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
          Selected branch
        </div>
        <p className="mt-1 text-sm font-bold text-white">{repository.selectedBranch}</p>
      </div>
      <div className="rounded-lg bg-black/35 p-3">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Write access</div>
        <p className="mt-1 text-sm font-bold text-white">{canPush ? 'Available' : 'Read only'}</p>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <Button icon={DownloadCloud} onClick={onPull} disabled={working}>
        Pull from GitHub
      </Button>
      <Button variant="secondary" icon={UploadCloud} onClick={onPush} disabled={working || !canPush}>
        Push to GitHub
      </Button>
      <Button variant="secondary" icon={RefreshCw} onClick={onChange} disabled={working}>
        Change Repository
      </Button>
      <Button variant="ghost" icon={Trash2} onClick={onDisconnect} disabled={working}>
        Disconnect Repository
      </Button>
    </div>

    <div className="mt-4">
      <ProgressBar progress={progress} />
    </div>

    {!canPush ? (
      <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
        Push requires write access to this GitHub repository.
      </p>
    ) : null}
  </section>
);

const GitHubRepoManager = ({ project, files = [], onPullFiles, canManage = true }) => {
  const [open, setOpen] = useState(false);
  const [showRepoBrowser, setShowRepoBrowser] = useState(false);
  const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
  const [pullConfirmOpen, setPullConfirmOpen] = useState(false);

  const [account, setAccount] = useState(null);
  const [repository, setRepository] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [repoPage, setRepoPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [commitMessage, setCommitMessage] = useState('Update files from CodeSync');
  const [pushChanges, setPushChanges] = useState(null);
  const [pushChangesLoading, setPushChangesLoading] = useState(false);
  const [selectedPushFiles, setSelectedPushFiles] = useState(() => new Set());

  const [loading, setLoading] = useState(false);
  const [repoLoading, setRepoLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const isConnected = Boolean(account?._id);
  const canPush = Boolean(repository?.permissions?.push);
  const changedPushFiles = useMemo(() => (pushChanges?.files || []).filter((file) => file.status !== 'unchanged'), [pushChanges]);
  const selectedChangedCount = selectedPushFiles.size;
  const groupedPushFiles = useMemo(
    () => ({
      added: changedPushFiles.filter((file) => file.status === 'added'),
      modified: changedPushFiles.filter((file) => file.status === 'modified'),
      deleted: changedPushFiles.filter((file) => file.status === 'deleted')
    }),
    [changedPushFiles]
  );

  useEffect(() => {
    if (!progress || progress.value >= 92) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (!current || current.value >= 92) {
          return current;
        }

        return { ...current, value: Math.min(current.value + 7, 92) };
      });
    }, 450);

    return () => window.clearInterval(timer);
  }, [progress]);

  const startProgress = (label) => {
    setWorking(true);
    setProgress({ label, value: 12 });
  };

  const finishProgress = () => {
    setProgress((current) => (current ? { ...current, value: 100 } : null));
    window.setTimeout(() => setProgress(null), 700);
  };

  const loadState = async () => {
    if (!canManage) {
      return;
    }

    if (!project?._id) {
      setError('Open a project before using GitHub integration.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [accountResult, repoResult] = await Promise.all([getGithubAccountRequest(), getGithubRepositoryRequest(project._id)]);
      setAccount(accountResult.account);
      setRepository(repoResult.repository);
      setShowRepoBrowser(Boolean(accountResult.account && !repoResult.repository));
    } catch (loadError) {
      console.error('GitHub state load failed', loadError);
      setError(getErrorHint(loadError, 'GitHub connection failed.'));
    } finally {
      setLoading(false);
    }
  };

  const loadRepositories = async ({ page = 1, append = false } = {}) => {
    if (!canManage) {
      return;
    }

    setRepoLoading(true);
    setError('');
    try {
      const result = await listGithubReposRequest({ page, perPage: 30, search, visibility });
      setRepositories((current) => (append ? [...current, ...(result.repositories || [])] : result.repositories || []));
      setRepoPage(page);
      setHasNextPage(Boolean(result.pagination?.hasNextPage));
    } catch (repoError) {
      console.error('GitHub repository fetch failed', repoError);
      setError(getErrorHint(repoError, 'Repo fetch failed.'));
    } finally {
      setRepoLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadState();
    }
  }, [open, project?._id]);

  useEffect(() => {
    if (open && isConnected && showRepoBrowser) {
      const timer = window.setTimeout(() => loadRepositories({ page: 1 }), 250);
      return () => window.clearTimeout(timer);
    }
  }, [open, isConnected, showRepoBrowser, search, visibility]);

  const startOAuth = () => {
    if (!canManage) {
      return;
    }

    window.location.assign(getGithubOAuthStartUrl(true));
  };

  const chooseRepository = async (repo) => {
    setSelectedRepo(repo);
    setSelectedBranch(getDefaultBranch(repo));
    setBranchLoading(true);
    setError('');
    setBranches([]);

    try {
      const result = await listGithubBranchesRequest(repo.owner, repo.repoName);
      const nextBranches = result.branches || [];
      setBranches(nextBranches);
      if (!nextBranches.some((item) => item.name === getDefaultBranch(repo)) && nextBranches[0]?.name) {
        setSelectedBranch(nextBranches[0].name);
      }
    } catch (branchError) {
      console.error('GitHub branch fetch failed', branchError);
      setError(getErrorHint(branchError, 'Branch fetch failed.'));
    } finally {
      setBranchLoading(false);
    }
  };

  const connectSelectedRepository = async () => {
    if (!canManage) {
      return;
    }

    if (!project?._id) {
      setError('Open a project before selecting a repository.');
      return;
    }
    if (!selectedRepo || !selectedBranch) {
      setError('Choose a repository and branch first.');
      return;
    }

    startProgress('Connecting repository');
    setError('');
    setNotice('');

    try {
      const result = await connectGithubProjectRepoRequest(project._id, {
        owner: selectedRepo.owner,
        repo: selectedRepo.repoName,
        branch: selectedBranch
      });
      setRepository(result.repository);
      setSelectedRepo(null);
      setBranches([]);
      setShowRepoBrowser(false);
      setNotice('GitHub repository connected.');
    } catch (connectError) {
      console.error('GitHub repository connect failed', connectError);
      setError(getErrorHint(connectError, 'Repository connection failed.'));
    } finally {
      finishProgress();
      setWorking(false);
    }
  };

  const disconnectAccount = async () => {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm('Disconnect your GitHub account from CodeSync? Connected project repositories will be removed.');
    if (!confirmed) {
      return;
    }

    startProgress('Disconnecting GitHub account');
    setError('');
    try {
      await disconnectGithubAccountRequest();
      setAccount(null);
      setRepository(null);
      setRepositories([]);
      setSelectedRepo(null);
      setShowRepoBrowser(false);
      setNotice('GitHub account disconnected.');
    } catch (disconnectError) {
      console.error('GitHub account disconnect failed', disconnectError);
      setError(getErrorHint(disconnectError, 'Could not disconnect GitHub account.'));
    } finally {
      finishProgress();
      setWorking(false);
    }
  };

  const disconnectRepository = async () => {
    if (!canManage) {
      return;
    }

    if (!repository?._id) {
      return;
    }

    const confirmed = window.confirm('Disconnect this GitHub repository from the project? The repository itself will not be changed.');
    if (!confirmed) {
      return;
    }

    startProgress('Disconnecting repository');
    setError('');
    try {
      await disconnectGithubRepositoryRequest(repository._id);
      setRepository(null);
      setShowRepoBrowser(true);
      setNotice('GitHub repository disconnected.');
    } catch (disconnectError) {
      console.error('GitHub repository disconnect failed', disconnectError);
      setError(getErrorHint(disconnectError, 'Could not disconnect GitHub repository.'));
    } finally {
      finishProgress();
      setWorking(false);
    }
  };

  const pullRepository = async () => {
    if (!canManage) {
      return;
    }

    if (!repository?._id) {
      setError('Select a GitHub repository before pulling.');
      return;
    }

    startProgress('Pulling files from GitHub');
    setError('');
    setNotice('');
    try {
      const result = await pullGithubRepositoryRequest(repository._id);
      setRepository(result.repository);
      onPullFiles?.(result.files || []);
      setPullConfirmOpen(false);
      setNotice(`Imported ${result.syncedCount} file${result.syncedCount === 1 ? '' : 's'} from GitHub.`);
    } catch (pullError) {
      console.error('GitHub pull failed', pullError);
      setError(getErrorHint(pullError, 'Pull from GitHub failed.'));
    } finally {
      finishProgress();
      setWorking(false);
    }
  };

  const openPushModal = async () => {
    if (!repository?._id) {
      setError('Select a GitHub repository before pushing.');
      return;
    }

    setPushConfirmOpen(true);
    setPushChanges(null);
    setSelectedPushFiles(new Set());
    setPushChangesLoading(true);
    setError('');

    try {
      const result = await getGithubRepositoryChangesRequest(repository._id);
      setPushChanges(result);
      const changed = (result.files || []).filter((file) => file.status !== 'unchanged');
      setSelectedPushFiles(new Set(changed.map((file) => file.fileId)));
    } catch (changesError) {
      console.error('GitHub changes preview failed', changesError);
      setError(getErrorHint(changesError, 'Could not load changed files.'));
    } finally {
      setPushChangesLoading(false);
    }
  };

  const pushRepository = async () => {
    if (!canManage) {
      return;
    }

    if (!repository?._id) {
      setError('Select a GitHub repository before pushing.');
      return;
    }

    if (!commitMessage.trim()) {
      setError('Commit message is required.');
      return;
    }

    const selectedFiles = changedPushFiles
      .filter((file) => selectedPushFiles.has(file.fileId))
      .map((file) => ({
        fileId: file.fileId,
        path: file.path
      }));

    if (selectedFiles.length === 0) {
      setError('Select at least one changed file to push.');
      return;
    }

    startProgress('Pushing files to GitHub');
    setError('');
    setNotice('');
    try {
      const result = await pushGithubRepositoryRequest(repository._id, {
        commitMessage,
        files: selectedFiles
      });
      setRepository(result.repository);
      setPushConfirmOpen(false);
      setNotice(`Pushed ${result.pushedCount} file${result.pushedCount === 1 ? '' : 's'} to GitHub.`);
      if (result.failedCount > 0) {
        setError(`${result.failedCount} file${result.failedCount === 1 ? '' : 's'} could not be pushed.`);
      }
    } catch (pushError) {
      console.error('GitHub push failed', pushError);
      setError(getErrorHint(pushError, 'Push to GitHub failed.'));
    } finally {
      finishProgress();
      setWorking(false);
    }
  };

  const changeRepository = () => {
    if (!canManage) {
      return;
    }

    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch('');
    setShowRepoBrowser(true);
  };

  const togglePushFile = (fileId) => {
    setSelectedPushFiles((current) => {
      const next = new Set(current);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const selectAllChangedFiles = () => {
    setSelectedPushFiles(new Set(changedPushFiles.map((file) => file.fileId)));
  };

  const clearSelectedFiles = () => {
    setSelectedPushFiles(new Set());
  };

  return (
    <>
      <Button
        variant="secondary"
        icon={Github}
        onClick={() => canManage && setOpen(true)}
        disabled={!project?._id || !canManage}
        title={canManage ? 'GitHub integration' : 'Only the room host can use GitHub integration'}
      >
        GitHub
      </Button>

      <Modal title="GitHub integration" open={open} onClose={() => setOpen(false)} size="xl">
        <div className="space-y-4">
          <Toast type="error">{error}</Toast>
          <Toast>{notice}</Toast>
          {!canManage ? (
            <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
              <ShieldAlert className="mr-2 inline h-4 w-4" aria-hidden="true" />
              Only the room host can use GitHub integration.
            </p>
          ) : null}
          <ProgressBar progress={progress} />

          {loading ? <Spinner label="Loading GitHub integration" /> : null}

          {!loading && !isConnected ? (
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-white">
                  <Github className="h-7 w-7" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-white">Connect GitHub</h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-neutral-400">
                    Connect your GitHub account to import and sync repository files.
                  </p>
                </div>
              </div>
              <Button icon={Github} onClick={startOAuth} className="mt-5 w-full">
                Connect GitHub Account
              </Button>
            </section>
          ) : null}

          {!loading && isConnected ? (
            <>
              <AccountCard account={account} onDisconnect={disconnectAccount} working={working} />

              {repository && !showRepoBrowser ? (
                <ConnectedRepoCard
                  repository={repository}
                  canPush={canPush}
                  onPull={() => setPullConfirmOpen(true)}
                  onPush={openPushModal}
                  onChange={changeRepository}
                  onDisconnect={disconnectRepository}
                  working={working}
                  progress={progress}
                />
              ) : null}

              {showRepoBrowser ? (
                <>
                  {selectedRepo ? (
                    <BranchPicker
                      selectedRepo={selectedRepo}
                      branches={branches}
                      branchLoading={branchLoading}
                      selectedBranch={selectedBranch}
                      setSelectedBranch={setSelectedBranch}
                      onCancel={() => {
                        setSelectedRepo(null);
                        setBranches([]);
                        setSelectedBranch('');
                      }}
                      onConfirm={connectSelectedRepository}
                      working={working}
                    />
                  ) : (
                    <RepoBrowser
                      repositories={repositories}
                      repoLoading={repoLoading}
                      search={search}
                      setSearch={setSearch}
                      visibility={visibility}
                      setVisibility={setVisibility}
                      onSelect={chooseRepository}
                      onLoadMore={(page) => loadRepositories({ page, append: true })}
                      hasNextPage={hasNextPage}
                      repoPage={repoPage}
                    />
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>

      <Modal title="Confirm GitHub pull" open={pullConfirmOpen} onClose={() => setPullConfirmOpen(false)}>
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
            This will import/update files from GitHub into CodeSync.
          </p>
          <p className="text-sm font-medium text-neutral-400">CodeSync will import up to 80 safe text files from {repository?.selectedBranch}.</p>
          <ProgressBar progress={progress} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPullConfirmOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button icon={DownloadCloud} onClick={pullRepository} disabled={working}>
              {working ? 'Pulling' : 'Confirm Pull'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal title="Push to GitHub" open={pushConfirmOpen} onClose={() => setPushConfirmOpen(false)} size="xl">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-white">
              <Github className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-white">{repository?.fullName}</h3>
              <p className="mt-1 text-xs font-semibold text-neutral-500">Branch: {repository?.selectedBranch}</p>
              <p className="mt-2 text-sm font-medium text-neutral-400">This will update only the selected changed files in GitHub.</p>
            </div>
          </div>

          <Input label="Commit message" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} required minLength={3} />

          {pushChangesLoading ? (
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
              <div className="h-10 animate-pulse rounded bg-white/10" />
              <div className="h-10 animate-pulse rounded bg-white/10" />
              <div className="h-10 animate-pulse rounded bg-white/10" />
            </div>
          ) : changedPushFiles.length === 0 ? (
            <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-teal-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-black text-teal-50">Everything is up to date</p>
              <p className="mt-1 text-xs font-semibold text-teal-100/70">No changed CodeSync files were found for this branch.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-black/30">
              <div className="flex flex-col gap-3 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">{selectedChangedCount} changed file{selectedChangedCount === 1 ? '' : 's'} selected</p>
                  <p className="text-xs font-semibold text-neutral-500">
                    {pushChanges?.counts?.added || 0} added, {pushChanges?.counts?.modified || 0} modified
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={selectAllChangedFiles} disabled={working}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelectedFiles} disabled={working}>
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                {[
                  ['added', 'Added', groupedPushFiles.added],
                  ['modified', 'Modified', groupedPushFiles.modified],
                  ['deleted', 'Deleted', groupedPushFiles.deleted]
                ].map(([status, label, group]) =>
                  group.length ? (
                    <div key={status} className="mb-3 last:mb-0">
                      <p className="mb-2 px-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
                      <div className="space-y-1">
                        {group.map((file) => (
                          <label
                            key={file.fileId}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-white/10"
                            title={file.path}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 shrink-0 accent-teal-300"
                              checked={selectedPushFiles.has(file.fileId)}
                              onChange={() => togglePushFile(file.fileId)}
                              disabled={working}
                            />
                            <FileCode2 className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate font-semibold text-neutral-200">{file.path}</span>
                            <ChangeBadge status={file.status} />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {error ? <Toast type="error">{error}</Toast> : null}
          <ProgressBar progress={progress} />

          <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-white/10 bg-[#101413] px-5 py-4">
            <Button variant="secondary" onClick={() => setPushConfirmOpen(false)} disabled={working}>
              {changedPushFiles.length === 0 && !pushChangesLoading ? 'Close' : 'Cancel'}
            </Button>
            {changedPushFiles.length > 0 ? (
              <Button icon={UploadCloud} onClick={pushRepository} disabled={working || pushChangesLoading || !commitMessage.trim() || selectedChangedCount === 0}>
                {working ? 'Pushing' : 'Push selected files'}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default GitHubRepoManager;
