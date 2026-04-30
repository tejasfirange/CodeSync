import { useEffect, useMemo, useRef, useState } from 'react';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import { getSafeUserClass, getUserColor } from '../../utils/userColor.js';

const CURSOR_TTL_MS = 30000;

const ensureRemoteCursorStyle = (cursor) => {
  const userId = cursor.userId || cursor.user?._id || cursor.user?.userId;
  const id = getSafeUserClass(userId);
  if (!id) {
    return null;
  }

  const styleId = `codesync-remote-cursor-${id}`;
  let style = document.getElementById(styleId);
  const colors = getUserColor(userId);
  const label = JSON.stringify(cursor.name || cursor.user?.name || 'User');

  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }

  style.textContent = `
    .remote-cursor-${id} {
      border-left-color: ${colors.cursor};
      box-shadow: 0 0 10px ${colors.cursor}66;
    }

    .remote-cursor-label-${id} {
      border-color: ${colors.cursor};
      background: ${colors.gradient};
    }

    .remote-cursor-label-${id}::after {
      content: ${label};
    }

    .remote-selection-${id} {
      background: ${colors.selection};
      border-radius: 2px;
    }
  `;

  return id;
};

const toCursorEntry = (payload) => ({
  userId: payload.userId || payload.user?._id || payload.user?.userId,
  name: payload.name || payload.user?.name || 'User',
  avatarColor: payload.avatarColor || payload.user?.avatarColor,
  fileId: payload.fileId,
  position: payload.position,
  selection: payload.selection || null,
  updatedAt: Date.now(),
  user: payload.user
});

const selectionHasRange = (selection) =>
  selection &&
  (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn);

const useRemoteCursors = ({ editorRef, monacoRef, socket, roomId, activeFileId, currentUserId, presenceUsers = [], enabled = true }) => {
  const [remoteCursorMap, setRemoteCursorMap] = useState({});
  const decorationsRef = useRef([]);

  const sameFileUserIds = useMemo(
    () =>
      new Set(
        presenceUsers
          .filter((user) => user.activeFileId === activeFileId && user.userId !== currentUserId && user._id !== currentUserId)
          .map((user) => user.userId || user._id)
      ),
    [activeFileId, currentUserId, presenceUsers]
  );

  useEffect(() => {
    if (!socket || !roomId || !enabled) {
      return undefined;
    }

    const handleCursorUpdate = (payload = {}) => {
      if (payload.roomId !== roomId) {
        return;
      }

      const cursor = toCursorEntry(payload);
      if (!cursor.userId || cursor.userId === currentUserId) {
        return;
      }

      setRemoteCursorMap((current) => ({
        ...current,
        [cursor.userId]: cursor
      }));
    };

    const handleUserLeft = ({ roomId: incomingRoomId, userId } = {}) => {
      if (incomingRoomId !== roomId || !userId) {
        return;
      }

      setRemoteCursorMap((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    };

    socket.on(SOCKET_EVENTS.CURSOR_UPDATE, handleCursorUpdate);
    socket.on(SOCKET_EVENTS.ROOM_USER_LEFT, handleUserLeft);

    return () => {
      socket.off(SOCKET_EVENTS.CURSOR_UPDATE, handleCursorUpdate);
      socket.off(SOCKET_EVENTS.ROOM_USER_LEFT, handleUserLeft);
    };
  }, [currentUserId, enabled, roomId, socket]);

  useEffect(() => {
    setRemoteCursorMap((current) => {
      const presentUserIds = new Set(presenceUsers.map((user) => user.userId || user._id));
      const next = {};

      Object.entries(current).forEach(([userId, cursor]) => {
        const stillPresent = presentUserIds.has(userId);
        const stillActive = sameFileUserIds.has(userId);
        const fresh = Date.now() - cursor.updatedAt < CURSOR_TTL_MS;

        if (stillPresent && stillActive && fresh) {
          next[userId] = cursor;
        }
      });

      return next;
    });
  }, [activeFileId, presenceUsers, sameFileUserIds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemoteCursorMap((current) => {
        const next = {};
        Object.entries(current).forEach(([userId, cursor]) => {
          if (Date.now() - cursor.updatedAt < CURSOR_TTL_MS) {
            next[userId] = cursor;
          }
        });
        return next;
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || !activeFileId || !enabled) {
      if (editor) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
      return;
    }

    const decorations = Object.values(remoteCursorMap)
      .filter((cursor) => cursor.fileId === activeFileId && cursor.position && sameFileUserIds.has(cursor.userId))
      .flatMap((cursor) => {
        const id = ensureRemoteCursorStyle(cursor);
        const cursorDecorations = [
          {
            range: new monaco.Range(cursor.position.lineNumber, cursor.position.column, cursor.position.lineNumber, cursor.position.column),
            options: {
              className: id ? `remote-cursor remote-cursor-${id}` : 'remote-cursor',
              afterContentClassName: id ? `remote-cursor-label remote-cursor-label-${id}` : 'remote-cursor-label',
              hoverMessage: { value: cursor.name },
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
          }
        ];

        if (selectionHasRange(cursor.selection) && id) {
          cursorDecorations.unshift({
            range: new monaco.Range(
              cursor.selection.startLineNumber,
              cursor.selection.startColumn,
              cursor.selection.endLineNumber,
              cursor.selection.endColumn
            ),
            options: {
              inlineClassName: `remote-selection remote-selection-${id}`,
              hoverMessage: { value: cursor.name },
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
          });
        }

        return cursorDecorations;
      });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, [activeFileId, editorRef, enabled, monacoRef, remoteCursorMap, sameFileUserIds]);

  useEffect(
    () => () => {
      const editor = editorRef.current;
      if (editor) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
    },
    [editorRef]
  );

  return remoteCursorMap;
};

export default useRemoteCursors;
