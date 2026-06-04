import { Wifi, WifiOff } from 'lucide-react';
import { getInitials } from '../../utils/constants.js';

const formatPing = (pingMs) => (Number.isFinite(pingMs) ? `${pingMs} ms` : '-- ms');

const ActiveUsers = ({ users, connected, activeFileId, currentUserId, pingMs, onOpenUserFile }) => (
  <aside className="flex h-full min-h-0 flex-col bg-[#0f1413]">
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 px-3">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-neutral-400">Users</h2>
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${connected ? 'bg-teal-300/10 text-teal-200' : 'bg-rose-500/10 text-rose-200'}`}>
          {formatPing(pingMs)}
        </span>
        {connected ? <Wifi className="h-4 w-4 text-teal-700" aria-hidden="true" /> : <WifiOff className="h-4 w-4 text-rose-600" aria-hidden="true" />}
      </div>
    </div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      {users.map((entry) => {
        const userId = entry.userId || entry._id;
        const isCurrentUser = userId === currentUserId;
        const sameFile = Boolean(activeFileId && entry.activeFileId === activeFileId && !isCurrentUser);
        const activeFileLabel = entry.activeFilePath || entry.activeFileName;
        const roleLabel = entry.role ? `${entry.role.charAt(0).toUpperCase()}${entry.role.slice(1)}` : 'Editor';

        return (
          <button
            key={userId || entry.socketId}
            type="button"
            className="cyber-user-row flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            onClick={() => onOpenUserFile?.(entry)}
            disabled={!entry.activeFileId && !entry.activeFilePath}
            title={activeFileLabel ? `Open ${activeFileLabel}${entry.cursor?.position ? ' at cursor' : ''}` : 'No active file'}
          >
            <span
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
              style={{ backgroundColor: entry.avatarColor || '#0f766e' }}
            >
              {getInitials(entry.name)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f1413] bg-teal-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">{entry.name}</p>
                {sameFile ? (
                  <span className="cyber-same-file-badge shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide">
                    Same file
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400" title={activeFileLabel || 'Viewing room'}>
                {roleLabel} · {activeFileLabel ? `${entry.role === 'viewer' ? 'Viewing' : 'Editing'}: ${activeFileLabel}` : 'Viewing room'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  </aside>
);

export default ActiveUsers;
