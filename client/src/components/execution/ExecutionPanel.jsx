import { ChevronDown, ChevronsDown, ChevronsUp, History, LockKeyhole, Package, Play, ShieldCheck, Terminal, Trash2, X, Maximize2, Minimize2 } from 'lucide-react';
import { memo, useRef, useState } from 'react';

const statusLabels = {
  idle: 'Idle',
  running: 'Running',
  success: 'Success',
  error: 'Error',
  timeout: 'Timeout'
};

const languageLabel = {
  javascript: 'JavaScript',
  python: 'Python',
  cpp: 'C++',
  c: 'C'
};

const commandByLanguage = {
  javascript: (filename) => `node ${filename || 'index.js'}`,
  python: () => 'python main.py',
  c: () => 'gcc main.c -o main && ./main',
  cpp: () => 'g++ main.cpp -o main && ./main'
};

const formatTime = (value) => {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
};

const truncateOutput = (value = '', maxLength = 40000) => {
  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return {
    text: value.slice(0, maxLength),
    truncated: true
  };
};

const DockerUnavailable = () => (
  <div className="terminal-docker-error">
    <p className="text-sm font-black text-[#ff4d6d]">Docker runtime unavailable</p>
    <p className="mt-1 text-xs leading-5 text-[#ffc2ce]">Code execution requires Docker to be running on the server.</p>
    <p className="mt-2 text-xs font-semibold text-[#75b798]">Start Docker Desktop and run again.</p>
  </div>
);

const OutputBlock = ({ title, value, tone = 'normal' }) => {
  const output = truncateOutput(value || '');

  return (
    <section className="terminal-output-section">
      <h4 className={tone === 'danger' ? 'terminal-section-title danger' : 'terminal-section-title'}>{title}</h4>
      <pre className={tone === 'danger' ? 'terminal-pre danger' : 'terminal-pre'}>
        {output.text || <span className="terminal-muted">(empty)</span>}
        {output.truncated ? <span className="terminal-truncated">{'\n'}Output truncated</span> : null}
      </pre>
    </section>
  );
};

const getCommand = (language, activeFile) => {
  const filename = activeFile?.filename || activeFile?.path?.split('/').pop();
  return commandByLanguage[language]?.(filename) || 'run current file';
};

const ExecutionPanel = ({
  open,
  activeFile,
  language,
  stdin,
  result,
  running,
  error,
  minimized,
  maximized = false,
  history = [],
  packages = [],
  packagesLoading = false,
  packageInstalling = false,
  packageMessage = '',
  onStdinChange,
  onRunAgain,
  onClear,
  onClose,
  onMinimize,
  onMaximize,
  onRestore,
  onSelectHistory,
  onInstallPackage,
  onRemovePackage,
  onCommand,
  canRun = true,
  onManageAccess
}) => {
  const [activeTab, setActiveTab] = useState('output');
  const [packageName, setPackageName] = useState('');
  const [commandText, setCommandText] = useState('');
  const [commandNotice, setCommandNotice] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [transcript, setTranscript] = useState([]);
  const [installLanguage, setInstallLanguage] = useState('python');

  const status = running ? 'running' : result?.status || (error ? 'error' : 'idle');
  const command = getCommand(language, activeFile);
  const isDockerError = /docker.*running|requires docker/i.test(error || result?.stderr || '');

  const canMaximize = !maximized;

  if (!open) {
    return null;
  }

  const appendTranscript = (entry) => {
    setTranscript((current) => [...current, { id: `${Date.now()}-${Math.random()}`, ...entry }].slice(-30));
  };

  const runCommandInput = async () => {
    const commandTextValue = commandText.trim();
    if (!commandTextValue) {
      return;
    }

    setCommandNotice('');
    setCommandHistory((current) => [commandTextValue, ...current.filter((item) => item !== commandTextValue)].slice(0, 20));
    setHistoryIndex(-1);
    appendTranscript({ type: 'command', text: `codesync:$ ${commandTextValue}` });
    try {
      if (commandTextValue === 'clear') {
        setTranscript([]);
        onClear?.();
        setCommandText('');
        return;
      }
      const commandResult = onCommand ? await onCommand(commandTextValue) : null;
      if (commandTextValue.includes('install ')) {
        setActiveTab('packages');
      } else {
        setActiveTab('output');
      }
      if (commandResult?.stdout) {
        appendTranscript({ type: commandResult.status === 'success' ? 'success' : 'stdout', text: commandResult.stdout });
      }
      if (commandResult?.stderr) {
        appendTranscript({ type: 'stderr', text: commandResult.stderr });
      }
    } catch (commandError) {
      appendTranscript({ type: 'stderr', text: commandError.message || 'Unsupported sandbox command. Type help to see allowed commands.' });
    }
    setCommandText('');
  };

  const installFromPackageTab = async () => {
    const nextPackage = packageName.trim();
    if (!nextPackage) {
      setCommandNotice('Enter a package name.');
      return;
    }
    appendTranscript({ type: 'command', text: `codesync:$ ${installLanguage === 'python' ? 'pip install' : 'npm install'} ${nextPackage}` });
    await onInstallPackage?.(nextPackage, installLanguage);
    setPackageName('');
  };

  const renderHistory = () => (
    <div className="terminal-history-list">
      {history.length ? (
        history.map((item) => (
          <button
            key={item.id}
            type="button"
            className="terminal-history-item"
            onClick={() => {
              onSelectHistory?.(item);
              setActiveTab('output');
            }}
          >
            <span className={`terminal-history-dot ${item.result?.status || 'idle'}`} />
            <span className="truncate">{formatTime(item.ranAt)}</span>
            <span className="truncate">{languageLabel[item.language] || item.language}</span>
            <span className="truncate">{item.fileName}</span>
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
          </button>
        ))
      ) : (
        <p className="terminal-empty-state">No runs or install actions yet.</p>
      )}
    </div>
  );

  const renderPackages = () => (
    <div className="terminal-packages">
      <div className="terminal-package-card">
        <div>
          <p className="terminal-section-title">Project sandbox packages</p>
          <p className="terminal-muted">Packages install into this project sandbox and are available to future runs.</p>
        </div>
        <div className="terminal-package-form">
          <select value={installLanguage} onChange={(event) => setInstallLanguage(event.target.value)} disabled={packageInstalling}>
            <option value="python">Python pip</option>
            <option value="javascript">Node npm</option>
          </select>
          <input
            value={packageName}
            onChange={(event) => setPackageName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                installFromPackageTab();
              }
            }}
            placeholder={installLanguage === 'python' ? 'numpy, pandas, requests' : 'axios, lodash, express'}
            disabled={packageInstalling}
            spellCheck="false"
          />
          <button type="button" className="terminal-run" onClick={installFromPackageTab} disabled={packageInstalling || !packageName.trim()}>
            <Package className="h-3.5 w-3.5" />
            {packageInstalling ? 'Installing' : 'Install package'}
          </button>
        </div>
      </div>

      {packageMessage ? <p className="terminal-command-notice">{packageMessage}</p> : null}

      <div className="terminal-package-list">
        {packagesLoading ? (
          <p className="terminal-empty-state">Loading packages...</p>
        ) : packages.length ? (
          ['python', 'javascript'].map((groupLanguage) => {
            const group = packages.filter((dependency) => dependency.language === groupLanguage);
            if (!group.length) return null;
            return (
              <section key={groupLanguage} className="terminal-package-group">
                <p className="terminal-section-title">{groupLanguage === 'python' ? 'Python packages' : 'Node packages'}</p>
                {group.map((dependency) => (
                  <div key={dependency._id} className="terminal-package-row">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#d7ffe7]">{dependency.packageName}</p>
                      <p className="truncate text-xs text-[#75b798]">{dependency.language === 'python' ? 'python' : 'node'} · installed {formatTime(dependency.installedAt || dependency.createdAt)}</p>
                    </div>
                    {onRemovePackage ? (
                      <button type="button" className="terminal-control danger" onClick={() => onRemovePackage(dependency._id)} title="Remove package" aria-label={`Remove ${dependency.packageName}`}>
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </section>
            );
          })
        ) : (
          <p className="terminal-empty-state">No sandbox packages installed yet.</p>
        )}
      </div>
    </div>
  );

  const renderOutput = () => (
    <div className="execution-panel-body terminal-body">
      <div className="terminal-output">
        {transcript.length ? (
          <div className="terminal-transcript">
            {transcript.map((entry) => (
              <pre key={entry.id} className={`terminal-transcript-line ${entry.type}`}>
                {entry.text}
              </pre>
            ))}
          </div>
        ) : !result && !error && !running ? (
          <div className="terminal-empty-state">
            Run your file or install packages using sandbox commands.
            {'\n'}Examples:
            {'\n'}run
            {'\n'}python main.py
            {'\n'}gcc main.c
          </div>
        ) : null}
        <div className="terminal-command">
          <span className="terminal-prompt">$</span>
          <span>{command}</span>
        </div>

        <div className="terminal-meta">
          <span>Status: {statusLabels[status] || status}</span>
          {Number.isFinite(result?.executionTimeMs) ? <span>Execution time: {result.executionTimeMs}ms</span> : null}
          {result?.exitCode !== undefined && result?.exitCode !== null ? <span>Exit code: {result.exitCode}</span> : null}
          {result?.memory ? <span>Memory: {result.memory}</span> : null}
        </div>

        {isDockerError ? <DockerUnavailable /> : null}
        {!isDockerError && error ? <p className="terminal-inline-error">{error}</p> : null}

        <OutputBlock title="STDOUT" value={result?.stdout} />
        <OutputBlock title="STDERR" value={result?.stderr} tone="danger" />
      </div>

      <label className="terminal-stdin">
        <span>STDIN</span>
        <textarea
          value={stdin}
          onChange={(event) => onStdinChange(event.target.value)}
          maxLength={20 * 1024}
          placeholder="input..."
          spellCheck="false"
        />
      </label>
    </div>
  );

  return (
    <aside className={`execution-panel terminal-shell ${minimized ? 'minimized' : ''}`}>
      <div
        className="execution-panel-header terminal-header"
        onClick={minimized ? onRestore : undefined}
        onKeyDown={(event) => {
          if (minimized && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onRestore?.();
          }
        }}
        role={minimized ? 'button' : undefined}
        tabIndex={minimized ? 0 : undefined}
        aria-label={minimized ? 'Restore terminal panel' : undefined}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="terminal-window-dots" aria-hidden="true">
            <span className="red" />
            <span className="yellow" />
            <span className="green" />
          </div>
          <Terminal className="h-4 w-4 shrink-0 text-[#39ff88]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#d7ffe7]">Sandbox Terminal</p>
            <p className="truncate text-xs font-semibold text-[#75b798]">
              {languageLabel[language] || language || 'Unsupported'} · {activeFile?.filename || activeFile?.path || 'No file'}
            </p>
          </div>
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#00e5ff]" aria-hidden="true" title="Commands run in an isolated Docker sandbox, not on the host machine." />
        </div>

        <div className="terminal-controls">
          <span className={`terminal-status ${status}`}>{statusLabels[status] || status}</span>
          {!minimized ? (
            <>
              <button type="button" className="terminal-run" onClick={onRunAgain} disabled={running || !activeFile || !canRun}>
                <Play className="h-3.5 w-3.5" />
                Run
              </button>
              <button type="button" className="terminal-control" onClick={onClear} aria-label="Clear output" title="Clear output">
                <Trash2 className="h-4 w-4" />
              </button>
              <button type="button" className="terminal-control" onClick={onMinimize} aria-label="Minimize terminal" title="Minimize">
                <Minimize2 className="h-4 w-4" />
              </button>
              <button type="button" className="terminal-control" onClick={canMaximize ? onMaximize : onRestore} aria-label={canMaximize ? 'Maximize terminal' : 'Restore terminal'} title={canMaximize ? 'Maximize' : 'Restore'}>
                {canMaximize ? <Maximize2 className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <button type="button" className="terminal-control" onClick={onRestore} aria-label="Restore terminal" title="Restore">
              <ChevronsUp className="h-4 w-4" />
            </button>
          )}
          <button type="button" className="terminal-control" onClick={onClose} aria-label="Close terminal" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized ? (
        <>
          {!canRun ? (
            <div className="terminal-locked-state">
              <LockKeyhole className="h-8 w-8 text-[var(--accent)]" aria-hidden="true" />
              <div>
                <p className="text-base font-black text-[var(--text-main)]">Terminal access disabled</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Ask the room owner to allow terminal execution.</p>
                {onManageAccess ? (
                  <button type="button" className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--accent)] hover:text-[var(--accent-2)]" onClick={onManageAccess}>
                    Manage terminal access
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="terminal-workspace">
              <div className="terminal-tabs">
                <button type="button" className={activeTab === 'output' ? 'active' : ''} onClick={() => setActiveTab('output')}>
                  <Terminal className="h-3.5 w-3.5" />
                  Output
                </button>
                <button type="button" className={activeTab === 'packages' ? 'active' : ''} onClick={() => setActiveTab('packages')}>
                  <Package className="h-3.5 w-3.5" />
                  Packages
                </button>
                <button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              </div>

              <div className="terminal-tab-content">
                {activeTab === 'output' ? renderOutput() : null}
                {activeTab === 'packages' ? renderPackages() : null}
                {activeTab === 'history' ? renderHistory() : null}
              </div>

              <div className="terminal-command-input">
                <span className="terminal-prompt">codesync:$</span>
                <input
                  value={commandText}
                  onChange={(event) => setCommandText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      runCommandInput();
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      const nextIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
                      if (nextIndex >= 0) {
                        setHistoryIndex(nextIndex);
                        setCommandText(commandHistory[nextIndex] || '');
                      }
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      const nextIndex = Math.max(-1, historyIndex - 1);
                      setHistoryIndex(nextIndex);
                      setCommandText(nextIndex === -1 ? '' : commandHistory[nextIndex] || '');
                    }
                  }}
                  placeholder="run, python main.py, node index.js, gcc main.c, pip install requests, help"
                  spellCheck="false"
                />
                <button type="button" onClick={runCommandInput} disabled={!commandText.trim() || packageInstalling || running}>
                  Enter
                </button>
              </div>
              {commandNotice ? <p className="terminal-command-notice">{commandNotice}</p> : null}
            </div>
          )}
        </>
      ) : null}
    </aside>
  );
};

export default memo(ExecutionPanel);
