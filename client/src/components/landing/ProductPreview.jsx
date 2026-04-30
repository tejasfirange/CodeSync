import { CheckCircle2, Circle, FileCode2, MessageSquareText, MousePointer2, Play, UsersRound } from 'lucide-react';
import { useState } from 'react';
import clsx from '../../utils/clsx.js';

const scenarios = {
  interview: {
    label: 'Interview',
    title: 'Frontend challenge',
    room: 'ROOM-9F2A',
    code: [
      'function debounce(callback, delay) {',
      '  let timer;',
      '  return (...args) => {',
      '    clearTimeout(timer);',
      '    timer = setTimeout(() => callback(...args), delay);',
      '  };',
      '}'
    ],
    chat: ['Candidate is explaining edge cases', 'Interviewer saved the final version'],
    users: ['Tejas', 'Maya']
  },
  classroom: {
    label: 'Classroom',
    title: 'Data structures lab',
    room: 'LAB-41C7',
    code: [
      'class Queue {',
      '  items = [];',
      '  enqueue(value) { this.items.push(value); }',
      '  dequeue() { return this.items.shift(); }',
      '}'
    ],
    chat: ['Instructor joined room', '3 students are editing notes'],
    users: ['Asha', 'Ravi', 'Noor']
  },
  pair: {
    label: 'Pairing',
    title: 'Bugfix sprint',
    room: 'SYNC-A823',
    code: [
      'socket.on("code:sync", (patch) => {',
      '  if (patch.fileId !== activeFile.id) return;',
      '  editor.applyRemoteChange(patch);',
      '});'
    ],
    chat: ['Cursor moved to auth.service.js', 'Patch saved at version 14'],
    users: ['Dev', 'Review']
  }
};

const ProductPreview = ({ dark = true }) => {
  const [active, setActive] = useState('interview');
  const scenario = scenarios[active];

  return (
    <div
      className={clsx(
        'rounded-lg border p-4 shadow-2xl',
        dark ? 'border-white/10 bg-[#0f1413]/92 text-white' : 'border-neutral-200 bg-white text-neutral-950'
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={clsx('text-xs font-black uppercase tracking-[0.18em]', dark ? 'text-teal-200' : 'text-teal-700')}>Live room</p>
          <h2 className="mt-1 text-xl font-black">{scenario.title}</h2>
        </div>
        <code className={clsx('rounded-lg px-3 py-2 text-xs font-black', dark ? 'bg-white/10 text-teal-100' : 'bg-neutral-100 text-neutral-800')}>{scenario.room}</code>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {Object.entries(scenarios).map(([key, item]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={clsx(
              'h-10 rounded-lg text-sm font-black transition',
              active === key
                ? 'bg-teal-300 text-neutral-950'
                : dark
                  ? 'bg-white/5 text-neutral-300 hover:bg-white/10'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_170px]">
        <div className={clsx('overflow-hidden rounded-lg border font-mono text-sm', dark ? 'border-white/10 bg-black' : 'border-neutral-200 bg-neutral-950 text-white')}>
          <div className={clsx('flex items-center justify-between border-b px-3 py-2', dark ? 'border-white/10' : 'border-white/10')}>
            <span className="flex items-center gap-2 text-xs font-black text-neutral-400">
              <FileCode2 className="h-4 w-4" aria-hidden="true" />
              index.js
            </span>
            <span className="flex items-center gap-1 text-xs font-black text-teal-300">
              <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
              synced
            </span>
          </div>
          <div className="space-y-1 px-3 py-4">
            {scenario.code.map((line, index) => (
              <p key={`${line}-${index}`} className="whitespace-pre text-neutral-200">
                <span className="mr-4 select-none text-neutral-600">{String(index + 1).padStart(2, '0')}</span>
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className={clsx('rounded-lg border p-3', dark ? 'border-white/10 bg-white/[0.04]' : 'border-neutral-200 bg-neutral-50')}>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <UsersRound className="h-4 w-4 text-teal-400" aria-hidden="true" />
              Users
            </div>
            <div className="flex -space-x-2">
              {scenario.users.map((user, index) => (
                <span
                  key={user}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-current text-xs font-black text-white"
                  style={{ backgroundColor: ['#0f766e', '#2563eb', '#b45309'][index] }}
                >
                  {user[0]}
                </span>
              ))}
            </div>
          </div>

          <div className={clsx('rounded-lg border p-3', dark ? 'border-white/10 bg-white/[0.04]' : 'border-neutral-200 bg-neutral-50')}>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <MessageSquareText className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Activity
            </div>
            <div className="space-y-2">
              {scenario.chat.map((item) => (
                <p key={item} className={clsx('text-xs font-semibold leading-5', dark ? 'text-neutral-300' : 'text-neutral-600')}>
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className={clsx('rounded-lg border p-3', dark ? 'border-white/10 bg-white/[0.04]' : 'border-neutral-200 bg-neutral-50')}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black">
                <MousePointer2 className="h-4 w-4 text-sky-400" aria-hidden="true" />
                Cursors live
              </span>
              <CheckCircle2 className="h-4 w-4 text-teal-400" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div className={clsx('mt-4 flex items-center justify-between rounded-lg px-3 py-3', dark ? 'bg-teal-300/10' : 'bg-teal-50')}>
        <span className={clsx('text-sm font-black', dark ? 'text-teal-100' : 'text-teal-900')}>Ready for a shared session</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-300 text-neutral-950">
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
};

export default ProductPreview;
