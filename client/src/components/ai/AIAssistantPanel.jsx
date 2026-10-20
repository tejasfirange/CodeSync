import { AlertTriangle, Check, Clipboard, Code2, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { generateAiRequest } from '../../api/ai.api.js';

const intents = [
  { value: 'generate', label: 'Generate code' },
  { value: 'explain', label: 'Explain code' },
  { value: 'fix', label: 'Fix a bug' },
  { value: 'review', label: 'Review code' }
];

const normalizePath = (value) => String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
const getFilePath = (file) => file?.path || file?.filename || '';
const getErrorMessage = (error) => error?.message || 'CodeSync AI could not complete that request. Try again.';

const AIAssistantPanel = ({ roomId, projectId, activeFile, canEdit = true, onApplyCode, onClose }) => {
  const [intent, setIntent] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [selection, setSelection] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    setIntent('generate');
    setPrompt('');
    setSelection('');
    setResult(null);
    setLoading(false);
    setError('');
    setCopied(false);
    setApplied(false);
  }, [roomId]);

  const assistant = result?.assistant || null;
  const context = result?.context || null;
  const activeFilePath = getFilePath(activeFile);
  const generatedFilePath = assistant?.filePath || '';
  const contextTargetFile = context?.targetFile || activeFilePath || 'Workspace';
  const pathMismatch = Boolean(generatedFilePath && activeFilePath && normalizePath(generatedFilePath) !== normalizePath(activeFilePath));
  const hasCode = typeof assistant?.code === 'string' && assistant.code.trim().length > 0;
  const canApply = Boolean(hasCode && activeFile?._id && canEdit && !pathMismatch && !loading);
  const canSubmit = Boolean(roomId && projectId && prompt.trim() && !loading);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || !roomId || !projectId || loading) {
      if (!cleanPrompt) setError('Tell CodeSync AI what you want it to do first.');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');
    setResult(null);
    setCopied(false);
    setApplied(false);

    const payload = {
      roomId,
      projectId,
      ...(activeFile?._id ? { fileId: activeFile._id } : {}),
      intent,
      prompt: cleanPrompt,
      ...(selection.trim() ? { selection: selection.trim() } : {})
    };

    try {
      const response = await generateAiRequest(payload);
      if (requestId === requestIdRef.current) {
        setResult(response || null);
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleCopy = async () => {
    if (!hasCode) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(assistant.code);
      } else {
        const helper = document.createElement('textarea');
        helper.value = assistant.code;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not copy the generated code. Select it manually from the preview.');
    }
  };

  const handleApply = () => {
    if (!canApply) return;
    onApplyCode?.(assistant.code);
    setApplied(true);
  };

  return (
    <aside className="ai-panel flex h-full min-h-0 flex-col bg-[#0b1714] text-neutral-100" aria-label="CodeSync AI assistant">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-300/30 bg-teal-300/10 text-teal-200 shadow-[0_0_18px_rgba(57,255,136,0.12)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xs font-black uppercase tracking-[0.14em] text-teal-200">CodeSync AI</h2>
            <p className="truncate text-[11px] font-semibold text-neutral-500">Repository-aware workspace assistant</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Close CodeSync AI"
          title="Close CodeSync AI"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">Intent</span>
            <select
              className="h-9 w-full rounded-lg border border-white/10 bg-[#060807] px-2.5 text-sm font-semibold text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              aria-label="AI intent"
              disabled={loading}
            >
              {intents.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">Prompt</span>
            <textarea
              className="min-h-[84px] w-full resize-y rounded-lg border border-white/10 bg-[#060807] px-3 py-2 text-sm leading-5 text-white outline-none placeholder:text-neutral-600 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the change or question..."
              aria-label="AI prompt"
              maxLength={4000}
              disabled={loading}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">
              <span>Selected text</span>
              <span className="font-semibold normal-case tracking-normal text-neutral-600">optional</span>
            </span>
            <textarea
              className="min-h-[52px] w-full resize-y rounded-lg border border-white/10 bg-[#060807] px-3 py-2 font-mono text-xs leading-5 text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              placeholder="Paste a focused snippet (the server supplies repository context)."
              aria-label="Selected text (optional)"
              maxLength={12000}
              disabled={loading}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-neutral-500">
            <span className="min-w-0 truncate" title={contextTargetFile}>
              Target: <strong className="text-neutral-300">{contextTargetFile}</strong>
            </span>
            <span className="shrink-0">{context?.fileCount ?? '—'} files in context</span>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold leading-5 text-rose-100" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal-300/50 bg-gradient-to-r from-teal-300 to-cyan-300 px-4 text-sm font-black text-neutral-950 shadow-[0_0_18px_rgba(57,255,136,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit}
            aria-label={loading ? 'Generating with CodeSync AI' : 'Generate with CodeSync AI'}
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </form>

        {result ? (
          <section className="mt-4 grid gap-3 border-t border-white/10 pt-4" aria-label="AI result">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-teal-200">Summary</h3>
                {assistant?.language ? <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-black uppercase text-neutral-500">{assistant.language}</span> : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-5 text-neutral-200">{assistant?.summary || 'No summary returned.'}</p>
            </div>

            {assistant?.explanation ? (
              <div>
                <h3 className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-teal-200">Explanation</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-5 text-neutral-300">{assistant.explanation}</p>
              </div>
            ) : null}

            {pathMismatch ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span>Generated for <strong>{generatedFilePath}</strong>, but the active file is <strong>{activeFilePath}</strong>. Apply is disabled for safety.</span>
              </div>
            ) : null}

            {assistant?.warnings?.length ? (
              <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2">
                <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Warnings
                </h3>
                <ul className="grid gap-1 text-xs leading-5 text-amber-100">
                  {assistant.warnings.map((warning, index) => <li key={`${warning}-${index}`}>• {warning}</li>)}
                </ul>
              </div>
            ) : null}

            {hasCode ? (
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-teal-200">
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" /> Code preview
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2 text-[11px] font-bold text-neutral-300 transition hover:border-teal-300/40 hover:text-teal-200"
                      onClick={handleCopy}
                      aria-label="Copy generated code"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
                      {copied ? 'Copied' : 'Copy code'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-teal-300/35 bg-teal-300/10 px-2 text-[11px] font-black text-teal-200 transition hover:bg-teal-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={handleApply}
                      disabled={!canApply}
                       aria-label="Apply generated file to editor"
                       title={pathMismatch ? 'Generated file does not match the active file' : !canEdit ? 'You have view-only access' : !activeFile?._id ? 'Open a file before applying code' : 'Replace the active editor file after review'}
                    >
                      {applied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                       {applied ? 'Applied' : 'Apply full file'}
                    </button>
                  </div>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-[#060807] p-3 font-mono text-xs leading-5 text-neutral-200 whitespace-pre-wrap break-words">{assistant.code}</pre>
                {!activeFile?._id && !pathMismatch ? <p className="mt-1.5 text-xs font-semibold text-neutral-500">Open a file to apply this code.</p> : !canEdit && !pathMismatch ? <p className="mt-1.5 text-xs font-semibold text-neutral-500">View-only access cannot apply changes.</p> : null}
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2 text-[11px] font-bold text-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleCopy}
                    disabled
                    aria-label="Copy generated code"
                  >
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy code
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded border border-teal-300/20 bg-teal-300/5 px-2 text-[11px] font-black text-teal-200 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={handleApply}
                    disabled
                     aria-label="Apply generated file to editor"
                  >
                    Apply to editor
                  </button>
                </div>
                <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold leading-5 text-neutral-500">This response does not include replacement code, so Apply to editor is unavailable.</p>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </aside>
  );
};

export default AIAssistantPanel;
