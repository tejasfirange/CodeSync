import { ArrowRight, BookOpenCheck, Braces, BriefcaseBusiness, Code2, GitBranch, GraduationCap, LockKeyhole, MessageSquareText, MousePointer2, Network, ShieldCheck, Sparkles, TerminalSquare, UsersRound, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import HeroScene from '../components/landing/HeroScene.jsx';
import ProductPreview from '../components/landing/ProductPreview.jsx';

const features = [
  { icon: UsersRound, title: 'Invite-ready rooms', copy: 'Create a room, share the code, and bring everyone into the same coding workspace in seconds.' },
  { icon: Braces, title: 'Shared code workspace', copy: 'Edit together in a focused editor with language switching, file state, and saveable progress.' },
  { icon: MousePointer2, title: 'Live presence', copy: 'See who is active, where they are editing, and how the session is moving without asking.' },
  { icon: MessageSquareText, title: 'Contextual chat', copy: 'Keep decisions, questions, and quick notes beside the code instead of scattered across tools.' },
  { icon: ShieldCheck, title: 'Protected sessions', copy: 'Authenticated access, private room membership, and room-scoped collaboration by default.' },
  { icon: GitBranch, title: 'Project continuity', copy: 'Return to projects and files later instead of losing everything when the browser closes.' }
];

const stats = [
  ['Create', 'a secure room'],
  ['Invite', 'with one code'],
  ['Code', 'in real time'],
  ['Save', 'project progress']
];

const useCases = [
  { icon: BriefcaseBusiness, title: 'Technical interviews', copy: 'Run coding rounds with a clean shared editor, live cursors, and room chat.' },
  { icon: GraduationCap, title: 'Classrooms and labs', copy: 'Let instructors and learners work through examples without screen-share friction.' },
  { icon: BookOpenCheck, title: 'Pair programming', copy: 'Debug, review, and build together while keeping the working files in one place.' }
];

const trustItems = [
  ['Access control', 'Users authenticate before opening rooms or sockets.'],
  ['Room isolation', 'Code, cursors, users, and chat stay scoped to the active room.'],
  ['Persistent work', 'Projects, files, versions, and messages are stored for later sessions.'],
  ['Input hygiene', 'Requests are validated and messages are sanitized before persistence.']
];

const Landing = () => {
  const { user } = useAuth();
  const actionHref = user ? '/dashboard' : '/register';

  return (
    <div className="min-h-screen bg-[#060807] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#060807]/76 shadow-[0_18px_44px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-300/40 bg-teal-300/10 text-teal-200">
              <Code2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black tracking-normal">CodeSync</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-neutral-200 md:flex">
            <a className="transition hover:text-white" href="#product">Product</a>
            <a className="transition hover:text-white" href="#use-cases">Use cases</a>
            <a className="transition hover:text-white" href="#security">Security</a>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-black text-neutral-950 transition hover:bg-teal-100" to="/dashboard">
                Dashboard
              </Link>
            ) : (
              <>
                <Link className="hidden h-10 items-center justify-center rounded-lg px-3 text-sm font-bold text-neutral-100 transition hover:bg-white/10 sm:inline-flex" to="/login">
                  Login
                </Link>
                <Link className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-black text-neutral-950 transition hover:bg-teal-100" to="/register">
                  Start
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[88svh] overflow-hidden bg-[#060807] pt-16">
          <div className="absolute inset-0 opacity-45" aria-hidden="true">
            <HeroScene />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.12),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.16),rgba(0,0,0,0.42))]" aria-hidden="true" />
          <div className="absolute left-[8%] top-28 h-64 w-64 rounded-full bg-teal-300/12 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-20 right-[12%] h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 mx-auto grid min-h-[calc(88svh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.86fr_1fr] lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-teal-300/30 bg-black/35 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-100">
                <TerminalSquare className="h-4 w-4" aria-hidden="true" />
                Collaborative coding command center
              </div>
              <h1 className="text-6xl font-black leading-none tracking-normal text-white sm:text-7xl lg:text-8xl">CodeSync</h1>
              <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-neutral-200 sm:text-xl">
                Launch a live coding room with shared files, real-time cursors, room chat, and saved project state without making your team juggle five tools.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-teal-300 px-5 text-sm font-black text-neutral-950 transition hover:bg-teal-200" to={actionHref}>
                  Enter CodeSync
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link className="inline-flex h-12 items-center justify-center rounded-lg border border-white/20 bg-black/30 px-5 text-sm font-black text-white transition hover:bg-white/10" to="/login">
                  Secure login
                </Link>
              </div>
              <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  ['Live cursors', 'Track movement'],
                  ['Room chat', 'Keep context'],
                  ['Saved files', 'Resume later']
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
                    <p className="text-sm font-black">{title}</p>
                    <p className="mt-1 text-xs font-semibold text-neutral-400">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative max-w-3xl lg:justify-self-end">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-teal-100">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Interactive room preview
              </div>
              <ProductPreview dark />
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0b0f0e]">
          <div className="mx-auto grid max-w-7xl gap-0 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {stats.map(([label, value]) => (
              <div key={label} className="border-white/10 py-6 sm:border-r sm:px-6 first:sm:border-l">
                <p className="text-xl font-black text-white">{label}</p>
                <p className="mt-1 text-sm font-semibold text-neutral-400">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="bg-[#101413] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-teal-300">Product</p>
              <h2 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">A collaborative coding room that feels ready when the team arrives.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-neutral-300">
                CodeSync is for live coding sessions where the editor, files, people, and conversation need to stay together.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-300 text-neutral-950">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-neutral-300">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className="bg-[#101413] px-4 pb-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 lg:grid-cols-3">
              {useCases.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-300 text-neutral-950">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-black">{title}</h3>
                  </div>
                  <p className="mt-4 text-sm font-medium leading-6 text-neutral-300">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="bg-[#0b0f0e] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Trust</p>
              <h2 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">Designed for private collaboration, not public noise.</h2>
              <p className="mt-5 text-base font-medium leading-7 text-neutral-300">
                People join by room, collaboration stays scoped to that room, and the work remains available when the session continues later.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/70 p-4 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
                <LockKeyhole className="h-4 w-4 text-amber-300" aria-hidden="true" />
                Room protection model
              </div>
              <div className="grid gap-3 pt-4 sm:grid-cols-2">
                {trustItems.map(([title, copy]) => (
                  <div key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <p className="font-black text-white">{title}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-neutral-400">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-[#101413] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
            {[
              ['01', 'Create a room', 'Start a collaboration space with owner controls and a room code.'],
              ['02', 'Open the workspace', 'Edit project files, switch languages, and save versions.'],
              ['03', 'Work together', 'Watch users, cursors, code changes, and chat update in real time.']
            ].map(([number, title, copy]) => (
              <article key={number} className="border-t-2 border-white/30 pt-5">
                <p className="text-sm font-black text-teal-300">{number}</p>
                <h3 className="mt-3 text-2xl font-black">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-neutral-300">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#060807] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/10 pt-10 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-teal-200">
                <Network className="h-4 w-4" aria-hidden="true" />
                Network-ready
              </div>
              <h2 className="mt-3 text-3xl font-black">Launch a room and bring the team in.</h2>
            </div>
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-neutral-950 transition hover:bg-teal-100" to={actionHref}>
              Open platform
              <Zap className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Landing;
