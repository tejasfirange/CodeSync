import { ArrowRight, Copy, Crown, EllipsisVertical, Lock, Trash2, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInitials } from '../../utils/constants.js';

const formatDate = (value) => {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
};

const RoomCard = ({ room, isOwner, onCopy, onDisband }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <article className="group rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300/30 hover:bg-white/[0.06] hover:shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="truncate text-lg font-black text-white">{room.name}</h3>
            {room.isPrivate ? <Lock className="h-4 w-4 text-amber-600" aria-hidden="true" /> : null}
            {isOwner ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-300/20 bg-teal-300/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-teal-100">
                <Crown className="h-3 w-3" />
                Owner
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-neutral-300">{room.description || 'No description'}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: room.owner?.avatarColor || '#0f766e' }}
            title={room.owner?.name}
          >
            {getInitials(room.owner?.name)}
          </div>
          {isOwner ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 text-neutral-400 transition hover:bg-white/10 hover:text-white"
                aria-label={`Room actions for ${room.name}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
              >
                <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-10 z-10 w-48 overflow-hidden rounded-lg border border-white/10 bg-[#111615] shadow-panel">
                  <Link
                    to={`/rooms/${room._id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Open
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onCopy(room.roomCode);
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy room code
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-rose-200 transition hover:bg-rose-500/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onDisband?.(room);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Disband room
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs font-semibold text-neutral-500">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-300" aria-hidden="true" />
          <span>{room.members?.length || 0}</span>
          <span>members</span>
        </div>
        <span>Created {formatDate(room.createdAt)}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <code className="truncate rounded bg-black/30 px-2 py-1 text-xs font-bold text-neutral-100">{room.roomCode}</code>
          <button
            type="button"
            onClick={() => onCopy(room.roomCode)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 text-neutral-400 transition hover:bg-white/10 hover:text-white"
            aria-label={`Copy room code ${room.roomCode}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <Link
          to={`/rooms/${room._id}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-neutral-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          aria-label={`Open ${room.name}`}
        >
          Open
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
};

export default RoomCard;
