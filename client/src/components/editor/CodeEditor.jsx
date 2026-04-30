import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import useRemoteCursors from './useRemoteCursors.js';

const CodeEditor = ({
  file,
  value,
  onChange,
  onCursorChange,
  socket,
  roomId,
  currentUserId,
  presenceUsers,
  showRemoteCursors = true,
  focusPosition
}) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  useRemoteCursors({
    editorRef,
    monacoRef,
    socket,
    roomId,
    activeFileId: file?._id,
    currentUserId,
    presenceUsers,
    enabled: showRemoteCursors
  });

  const jumpToPosition = (target) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = target?.position;

    if (!editor || !position?.lineNumber || !position?.column) {
      return;
    }

    editor.setPosition(position);
    editor.revealPositionInCenter(position, monaco?.editor?.ScrollType?.Smooth);
    editor.focus();
  };

  useEffect(() => {
    jumpToPosition(focusPosition);
  }, [focusPosition?.fileId, focusPosition?.nonce, focusPosition?.position?.lineNumber, focusPosition?.position?.column]);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('codesync-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8b949e' },
        { token: 'keyword', foreground: '5eead4', fontStyle: 'bold' },
        { token: 'string', foreground: 'fbbf24' }
      ],
      colors: {
        'editor.background': '#060807',
        'editorLineNumber.foreground': '#6b7280',
        'editorCursor.foreground': '#ccfbf1',
        'editor.selectionBackground': '#14b8a633'
      }
    });

    monaco.editor.setTheme('codesync-dark');
    jumpToPosition(focusPosition);

    editor.onDidChangeCursorPosition((event) => {
      const selection = editor.getSelection();
      onCursorChange?.({
        position: event.position,
        selection: selection
          ? {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn
            }
          : null
      });
    });
  };

  return (
    <Editor
      height="100%"
      language={file?.language || 'javascript'}
      theme="codesync-dark"
      value={value}
      onChange={(nextValue) => onChange(nextValue || '')}
      onMount={handleMount}
      options={{
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 14,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        automaticLayout: true,
        wordWrap: 'on',
        renderWhitespace: 'selection'
      }}
    />
  );
};

export default CodeEditor;
