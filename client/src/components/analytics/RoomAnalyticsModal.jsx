import { Activity, BarChart3, FileCode2, Github, MessageSquareText, PlayCircle, RefreshCcw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getRoomAnalyticsRequest } from '../../api/analytics.api.js';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';
import Spinner from '../common/Spinner.jsx';

const formatDate = (value) => (value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Never');
const entries = (value = {}) => Object.entries(value).sort((a, b) => b[1] - a[1]);

const StatCard = ({ icon: Icon, label, value, detail }) => (
  <article className="rounded-lg border border-[var(--border-main)] bg-[rgba(7,17,15,0.72)] p-3">
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[rgba(57,255,136,0.08)] text-[var(--accent)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
        <p className="truncate text-lg font-black text-[var(--text-main)]">{value}</p>
      </div>
    </div>
    {detail ? <p className="mt-2 truncate text-xs font-semibold text-[var(--text-muted)]">{detail}</p> : null}
  </article>
);

const MiniBarChart = ({ data, emptyText }) => {
  const items = entries(data);
  const max = Math.max(...items.map(([, count]) => count), 1);
  if (!items.length) {
    return <p className="rounded-lg border border-[var(--border-main)] bg-black/20 p-3 text-sm text-[var(--text-muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map(([label, count]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs font-bold text-[var(--text-muted)]">
            <span>{label}</span>
            <span>{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]" style={{ width: `${Math.max(6, (count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const ActivityList = ({ items = [], emptyText }) => {
  if (!items.length) {
    return <p className="rounded-lg border border-[var(--border-main)] bg-black/20 p-3 text-sm text-[var(--text-muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item._id} className="rounded-lg border border-[var(--border-main)] bg-black/20 px-3 py-2">
          <p className="truncate text-sm font-bold text-[var(--text-main)]">{item.path || item.filename}</p>
          <p className="text-xs text-[var(--text-muted)]">{item.language || 'unknown'} · edits {item.editCount || 0} · {formatDate(item.lastEditedAt || item.updatedAt)}</p>
        </div>
      ))}
    </div>
  );
};

const Section = ({ title, children }) => (
  <section className="rounded-lg border border-[var(--border-main)] bg-[rgba(2,4,3,0.32)] p-4">
    <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--accent)]">{title}</h3>
    {children}
  </section>
);

const RoomAnalyticsModal = ({ open, room, onClose, onError }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    if (!room?._id) return;
    setLoading(true);
    setError('');
    try {
      const result = await getRoomAnalyticsRequest(room._id);
      setAnalytics(result);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load room analytics.');
      onError?.('Unable to load room analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !analytics) {
      loadAnalytics();
    }
  }, [open, room?._id]);

  const overview = analytics?.overview || {};
  const executionStatus = useMemo(
    () => ({ success: analytics?.executions?.success || 0, failed: analytics?.executions?.failed || 0, timeout: analytics?.executions?.timeout || 0 }),
    [analytics]
  );

  return (
    <Modal
      title={`Room Analytics${room?.name ? ` · ${room.name}` : ''}`}
      open={open}
      onClose={onClose}
      size="xl"
      footer={<Button variant="secondary" icon={RefreshCcw} onClick={loadAnalytics} disabled={loading}>Refresh</Button>}
    >
      {loading && !analytics ? (
        <div className="flex min-h-72 items-center justify-center">
          <Spinner label="Loading analytics" />
        </div>
      ) : error && !analytics ? (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm font-semibold text-rose-100">{error}</p>
      ) : analytics ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={Users} label="Members" value={overview.totalMembers || 0} />
            <StatCard icon={FileCode2} label="Files" value={overview.totalFiles || 0} />
            <StatCard icon={MessageSquareText} label="Messages" value={overview.totalMessages || 0} />
            <StatCard icon={PlayCircle} label="Executions" value={overview.totalExecutions || 0} />
            <StatCard icon={Activity} label="Last activity" value={formatDate(overview.lastActivityAt)} />
            <StatCard icon={Github} label="GitHub" value={overview.githubConnected ? 'Connected' : 'Not connected'} detail={analytics.github?.repoName} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Collaboration">
              <MiniBarChart data={analytics.members?.roleBreakdown} emptyText="No member roles found." />
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Most active: {analytics.members?.mostActiveUser?.user?.name || 'No activity yet'}
              </p>
            </Section>

            <Section title="Files">
              <p className="mb-3 text-sm text-[var(--text-muted)]">Total code lines: <span className="font-black text-[var(--text-main)]">{analytics.files?.totalLines || 0}</span></p>
              <MiniBarChart data={analytics.files?.byLanguage} emptyText="No files yet." />
            </Section>

            <Section title="Recently Edited">
              <ActivityList items={analytics.files?.recentlyEdited} emptyText="No recent file edits." />
            </Section>

            <Section title="Most Edited">
              <ActivityList items={analytics.files?.mostEdited} emptyText="No file edits tracked yet." />
            </Section>

            <Section title="Chat">
              <div className="grid gap-2 sm:grid-cols-3">
                <StatCard icon={MessageSquareText} label="Total" value={analytics.chat?.totalMessages || 0} />
                <StatCard icon={Activity} label="Today" value={analytics.chat?.messagesToday || 0} />
                <StatCard icon={Users} label="Top user" value={analytics.chat?.mostActiveUser?.user?.name || 'None'} />
              </div>
            </Section>

            <Section title="Execution">
              <MiniBarChart data={executionStatus} emptyText="No code executions yet." />
              <p className="mt-3 text-sm text-[var(--text-muted)]">Most executed language: {analytics.executions?.mostExecutedLanguage || 'None'}</p>
            </Section>

            <Section title="Execution Languages">
              <MiniBarChart data={analytics.executions?.byLanguage} emptyText="No execution language data yet." />
            </Section>

            <Section title="GitHub">
              {analytics.github?.connected ? (
                <div className="space-y-2 text-sm text-[var(--text-muted)]">
                  <p>Repository: <span className="font-bold text-[var(--text-main)]">{analytics.github.repoName}</span></p>
                  <p>Branch: <span className="font-bold text-[var(--text-main)]">{analytics.github.branch}</span></p>
                  <p>Last pull: {formatDate(analytics.github.lastPullAt)}</p>
                  <p>Last push: {formatDate(analytics.github.lastPushAt)}</p>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No GitHub repository connected.</p>
              )}
            </Section>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default RoomAnalyticsModal;
