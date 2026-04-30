import { CheckCircle2, DoorOpen, Github, Plus, Search, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGithubAccountRequest } from '../api/github.api.js';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Modal from '../components/common/Modal.jsx';
import DisbandRoomModal from '../components/rooms/DisbandRoomModal.jsx';
import JoinRoomForm from '../components/rooms/JoinRoomForm.jsx';
import RoomCard from '../components/rooms/RoomCard.jsx';
import RoomForm from '../components/rooms/RoomForm.jsx';
import useAuth from '../hooks/useAuth.js';
import useRoom from '../hooks/useRoom.js';

const getEntityId = (value) => (typeof value === 'object' && value !== null ? value._id : value);

const StatCard = ({ icon: Icon, label, value, detail }) => (
  <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-300/10 text-teal-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
        <p className="truncate text-xl font-black text-white">{value}</p>
      </div>
    </div>
    {detail ? <p className="mt-3 truncate text-xs font-semibold text-neutral-500">{detail}</p> : null}
  </article>
);

const SkeletonCard = () => (
  <article className="animate-pulse rounded-lg border border-white/10 bg-white/[0.04] p-5">
    <div className="h-5 w-2/3 rounded bg-white/10" />
    <div className="mt-4 h-4 w-full rounded bg-white/10" />
    <div className="mt-2 h-4 w-4/5 rounded bg-white/10" />
    <div className="mt-8 h-9 w-full rounded bg-white/10" />
  </article>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { rooms, loadRooms, createRoom, joinRoom, disbandRoom, loading, error } = useRoom();
  const [createOpen, setCreateOpen] = useState(false);
  const [disbandTarget, setDisbandTarget] = useState(null);
  const [disbanding, setDisbanding] = useState(false);
  const [disbandError, setDisbandError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [toast, setToast] = useState('');
  const [githubAccount, setGithubAccount] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const disbandMessage = sessionStorage.getItem('codesync.roomDisbandedMessage');
    if (disbandMessage) {
      setToast(disbandMessage);
      sessionStorage.removeItem('codesync.roomDisbandedMessage');
      window.setTimeout(() => setToast(''), 2600);
    }

    loadRooms().catch(() => {});
    getGithubAccountRequest()
      .then((result) => setGithubAccount(result.account))
      .catch(() => setGithubAccount(null));
  }, [loadRooms]);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      const room = await createRoom(payload);
      setCreateOpen(false);
      navigate(`/rooms/${room._id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (roomCode) => {
    setSubmitting(true);
    try {
      const room = await joinRoom(roomCode);
      navigate(`/rooms/${room._id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const copyRoomCode = async (roomCode) => {
    await navigator.clipboard.writeText(roomCode);
    setToast('Room code copied');
    window.setTimeout(() => setToast(''), 1400);
  };

  const handleDisbandRoom = async () => {
    if (!disbandTarget?._id) {
      return;
    }

    setDisbanding(true);
    setDisbandError('');
    try {
      await disbandRoom(disbandTarget._id);
      setDisbandTarget(null);
      setToast('Room disbanded successfully');
      window.setTimeout(() => setToast(''), 2200);
    } catch (disbandFailure) {
      setDisbandError(disbandFailure.message || 'Could not disband room');
    } finally {
      setDisbanding(false);
    }
  };

  const filteredRooms = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const nextRooms = rooms
      .filter((room) => {
        const ownerId = getEntityId(room.owner);
        if (filter === 'owned' && ownerId !== user?._id) {
          return false;
        }
        if (filter === 'joined' && ownerId === user?._id) {
          return false;
        }
        return true;
      })
      .filter((room) => !cleanQuery || room.name.toLowerCase().includes(cleanQuery) || room.roomCode.toLowerCase().includes(cleanQuery));

    return nextRooms.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
  }, [filter, query, rooms, sort, user?._id]);

  const ownedCount = useMemo(() => rooms.filter((room) => getEntityId(room.owner) === user?._id).length, [rooms, user?._id]);
  const recentRoom = filteredRooms[0] || rooms[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg border border-white/10 bg-[#101413] p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-black text-white">Dashboard</h1>
            <p className="mt-1 text-sm font-medium text-neutral-400">Rooms, collaborators, and connected coding workspaces.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              New room
            </Button>
          </div>
        </div>
      </section>

      {toast ? <p className="rounded-lg border border-teal-300/20 bg-teal-300/10 px-4 py-3 text-sm font-bold text-teal-100">{toast}</p> : null}
      {error ? <p className="rounded-lg bg-rose-950/50 px-4 py-3 text-sm font-semibold text-rose-100">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DoorOpen} label="Total rooms" value={rooms.length} detail={`${ownedCount} owned`} />
        <StatCard icon={UsersRound} label="Active rooms" value={rooms.length} detail="Available workspaces" />
        <StatCard icon={CheckCircle2} label="Recently opened" value={recentRoom?.name || 'None'} detail={recentRoom?.roomCode} />
        <StatCard icon={Github} label="GitHub" value={githubAccount ? 'Connected' : 'Not connected'} detail={githubAccount ? `@${githubAccount.username}` : 'Connect from a room'} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
              <input
                className="h-11 w-full rounded-lg border border-white/10 bg-[#0f1413] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search rooms by name or code"
                aria-label="Search rooms"
              />
            </label>
            <select
              className="h-11 rounded-lg border border-white/10 bg-[#0f1413] px-3 text-sm font-bold text-white outline-none focus:border-teal-300"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="owned">Owned</option>
              <option value="joined">Joined</option>
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-[#0f1413] px-3 text-sm font-bold text-white outline-none focus:border-teal-300"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-neutral-400">Join room</h2>
          <JoinRoomForm onSubmit={handleJoin} submitting={submitting} />
        </div>
      </section>

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </section>
      ) : filteredRooms.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room._id}
              room={room}
              isOwner={getEntityId(room.owner) === user?._id}
              onCopy={copyRoomCode}
              onDisband={setDisbandTarget}
            />
          ))}
        </section>
      ) : (
        <EmptyState icon={DoorOpen} title="No rooms found" action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Create your first room</Button>} />
      )}

      <Modal title="Create room" open={createOpen} onClose={() => setCreateOpen(false)}>
        <RoomForm onSubmit={handleCreate} submitting={submitting} />
      </Modal>

      <DisbandRoomModal
        open={Boolean(disbandTarget)}
        room={disbandTarget}
        loading={disbanding}
        error={disbandError}
        onClose={() => {
          setDisbandTarget(null);
          setDisbandError('');
        }}
        onConfirm={handleDisbandRoom}
      />
    </div>
  );
};

export default Dashboard;
