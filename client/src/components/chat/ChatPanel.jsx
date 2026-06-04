import { ChevronDown, ChevronUp, Search, Send, X, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { listMessagesRequest, searchMessagesRequest, sendVoiceNoteRequest, editMessageRequest, deleteMessageRequest } from '../../api/chat.api.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import { groupMessagesByDate, formatMessageTime } from '../../utils/chatDate.js';
import { getInitials } from '../../utils/constants.js';
import useRoom from '../../hooks/useRoom.js';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import VoiceMessage from './VoiceMessage.jsx';
import VoiceRecorder from './VoiceRecorder.jsx';

const getSenderName = (message, currentUserId) => (message.sender?._id === currentUserId ? 'You' : message.sender?.name || 'Unknown user');
const matchesQuery = (message, query) => {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return false;
  }

  return (
    message.message?.toLowerCase().includes(cleanQuery) ||
    (message.type === 'voice' && 'voice note'.includes(cleanQuery)) ||
    message.sender?.name?.toLowerCase().includes(cleanQuery)
  );
};

const mergeById = (...messageLists) => {
  const byId = new Map();
  messageLists.flat().forEach((message) => {
    if (message?._id) {
      byId.set(message._id, message);
    }
  });

  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText = ({ text = '', query }) => {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegExp(cleanQuery)})`, 'ig');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    part.toLowerCase() === cleanQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-300/30 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
};

const DateSeparator = ({ label }) => (
  <div className="chat-date-separator my-4 flex items-center gap-3">
    <span className="h-px min-w-0 flex-1 bg-white/10" />
    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
      {label}
    </span>
    <span className="h-px min-w-0 flex-1 bg-white/10" />
  </div>
);

const MessageBubble = memo(({ item, currentUserId, isOwner, query, selected, messageRef, onEdit, onDelete }) => {
  const isMine = item.sender?._id === currentUserId;
  const senderName = getSenderName(item, currentUserId);
  const isVoice = item.type === 'voice';

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.message || '');

  const canEdit = !item.isDeleted && isMine && !isVoice;
  const canDelete = !item.isDeleted && (isMine || isOwner);

  const handleEditSubmit = () => {
    const cleanText = editText.trim();
    if (!cleanText || cleanText === item.message) {
      setIsEditing(false);
      return;
    }
    onEdit(item._id, cleanText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(item.message || '');
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setIsMenuOpen(false);
    if (window.confirm('Delete message for everyone?\nThis message will be deleted for all room members.')) {
      onDelete(item._id);
    }
  };

  return (
    <div
      ref={messageRef}
      className={`chat-message-row group relative flex gap-2 rounded-lg transition ${isMine ? 'justify-end' : 'justify-start'} ${selected ? 'bg-amber-300/10 ring-1 ring-amber-300/30' : ''}`}
    >
      {!isMine ? (
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
          style={{ backgroundColor: item.sender?.avatarColor || '#0f766e' }}
        >
          {getInitials(item.sender?.name)}
        </span>
      ) : null}
      <div
        className={`chat-bubble relative ${isVoice ? 'chat-bubble-voice' : ''} max-w-[75%] rounded-lg px-3 py-2 ${
          item.isDeleted
            ? 'bg-neutral-100 text-neutral-400 italic dark:bg-white/[0.03] dark:text-neutral-500'
            : isMine
              ? 'chat-bubble-mine bg-neutral-950 text-white dark:bg-teal-300 dark:text-neutral-950'
              : 'chat-bubble-other bg-neutral-100 text-neutral-900 dark:bg-white/[0.07] dark:text-neutral-100'
        }`}
      >
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-bold">
              <HighlightedText text={senderName} query={query} />
            </span>
            <span className={`shrink-0 text-[11px] ${isMine ? 'text-neutral-300 dark:text-neutral-700' : 'text-neutral-500 dark:text-neutral-400'}`}>
              {formatMessageTime(item.createdAt)}
            </span>
            {item.isEdited && !item.isDeleted && (
              <span className="text-[10px] italic opacity-60 dark:text-neutral-700 font-medium">(edited)</span>
            )}
          </div>
          {!item.isDeleted && (canEdit || canDelete) && (
            <div className="relative flex shrink-0">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="opacity-0 group-hover:opacity-100 transition rounded p-1 hover:bg-white/10 dark:hover:bg-black/10 flex items-center justify-center text-inherit cursor-pointer"
                aria-label="Message options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute right-0 top-6 z-50 min-w-[120px] rounded border border-white/10 bg-neutral-900 p-1 shadow-xl">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsEditing(true);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold text-white hover:bg-white/10"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteClick}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete for all
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {item.isDeleted ? (
          <p className="text-sm leading-5 italic">This message was deleted</p>
        ) : isEditing ? (
          <div className="space-y-2 mt-1">
            <textarea
              className="w-full min-h-[60px] resize-none rounded border border-white/20 bg-neutral-800 p-2 text-sm text-white outline-none focus:border-teal-300 dark:text-white"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded px-2.5 py-1 text-xs font-bold text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                className="rounded bg-teal-300 px-2.5 py-1 text-xs font-black text-neutral-950 hover:bg-teal-400"
              >
                Save
              </button>
            </div>
          </div>
        ) : isVoice ? (
          <VoiceMessage message={item} isMine={isMine} />
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-5">
            <HighlightedText text={item.message} query={query} />
          </p>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

const ChatPanel = ({ roomId, socket, currentUser }) => {
  const { currentRoom } = useRoom();
  const isOwner = currentRoom?.owner?._id === currentUser?._id || currentRoom?.owner === currentUser?._id;

  const handleEditMessage = async (messageId, text) => {
    try {
      const updated = await editMessageRequest(messageId, text);
      setMessages((current) =>
        current.map((item) => (item._id === messageId ? { ...item, ...updated.message } : item))
      );
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const updated = await deleteMessageRequest(messageId);
      setMessages((current) =>
        current.map((item) => (item._id === messageId ? { ...item, ...updated.message } : item))
      );
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [remoteSearch, setRemoteSearch] = useState({ messages: [], total: 0 });
  const [selectedResult, setSelectedResult] = useState(0);
  const [voiceSending, setVoiceSending] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceRecorderState, setVoiceRecorderState] = useState('idle');
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const searchRequestRef = useRef(0);
  const messageRefs = useRef(new Map());

  const isNearBottom = () => {
    const element = scrollRef.current;
    if (!element) {
      return true;
    }
    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const scrollToBottom = (behavior = 'smooth') => {
    endRef.current?.scrollIntoView({ behavior, block: 'end' });
    setShowNewMessage(false);
    setShowJumpLatest(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let mounted = true;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const { messages: nextMessages } = await listMessagesRequest(roomId);
        if (mounted) {
          setMessages(nextMessages);
          shouldAutoScrollRef.current = true;
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [roomId]);

  useEffect(() => {
    if (!searchOpen || debouncedQuery.length < 2) {
      setRemoteSearch({ messages: [], total: 0 });
      setSearchLoading(false);
      return undefined;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearchLoading(true);

    searchMessagesRequest(roomId, { q: debouncedQuery, limit: 50, page: 1 })
      .then((result) => {
        if (searchRequestRef.current === requestId) {
          setRemoteSearch({ messages: result.messages || [], total: result.total || 0 });
        }
      })
      .catch(() => {
        if (searchRequestRef.current === requestId) {
          setRemoteSearch({ messages: [], total: 0 });
        }
      })
      .finally(() => {
        if (searchRequestRef.current === requestId) {
          setSearchLoading(false);
        }
      });

    return undefined;
  }, [debouncedQuery, roomId, searchOpen]);

  useEffect(() => {
    const handleNewMessage = ({ roomId: incomingRoomId, message: incomingMessage }) => {
      if (incomingRoomId !== roomId) {
        return;
      }

      const shouldStick = isNearBottom();
      shouldAutoScrollRef.current = shouldStick;
      setMessages((current) => {
        if (current.some((item) => item._id === incomingMessage._id)) {
          return current;
        }

        return [...current, incomingMessage];
      });

      if (!shouldStick) {
        setShowNewMessage(true);
      }
    };

    const handleTypingStart = ({ roomId: incomingRoomId, user }) => {
      if (incomingRoomId !== roomId || user?._id === currentUser?._id) {
        return;
      }

      setTypingUsers((current) => new Map(current).set(user._id, user));
    };

    const handleTypingStop = ({ roomId: incomingRoomId, user }) => {
      if (incomingRoomId !== roomId || !user?._id) {
        return;
      }

      setTypingUsers((current) => {
        const next = new Map(current);
        next.delete(user._id);
        return next;
      });
    };

    const handleMessageEdited = ({ messageId, message, isEdited, editedAt }) => {
      setMessages((current) =>
        current.map((item) =>
          item._id === messageId ? { ...item, message, isEdited, editedAt } : item
        )
      );
    };

    const handleMessageDeleted = ({ messageId, isDeleted, deletedAt }) => {
      setMessages((current) =>
        current.map((item) =>
          item._id === messageId ? { ...item, isDeleted, deletedAt } : item
        )
      );
    };

    socket.on(SOCKET_EVENTS.CHAT_NEW, handleNewMessage);
    socket.on(SOCKET_EVENTS.TYPING_START, handleTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);
    socket.on('chat:message-edited', handleMessageEdited);
    socket.on('chat:message-deleted', handleMessageDeleted);

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_NEW, handleNewMessage);
      socket.off(SOCKET_EVENTS.TYPING_START, handleTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);
      socket.off('chat:message-edited', handleMessageEdited);
      socket.off('chat:message-deleted', handleMessageDeleted);
    };
  }, [currentUser?._id, roomId, socket]);

  const searchActive = searchOpen && debouncedQuery.length >= 2;
  const localSearchMatches = useMemo(
    () => (searchActive ? messages.filter((item) => matchesQuery(item, debouncedQuery)) : []),
    [debouncedQuery, messages, searchActive]
  );
  const displayedMessages = useMemo(
    () => (searchActive ? mergeById(remoteSearch.messages, localSearchMatches) : messages),
    [localSearchMatches, messages, remoteSearch.messages, searchActive]
  );
  const groupedMessages = useMemo(() => groupMessagesByDate(displayedMessages), [displayedMessages]);
  const resultIds = useMemo(() => displayedMessages.map((item) => item._id), [displayedMessages]);
  const resultCount = searchActive ? Math.max(remoteSearch.total || 0, displayedMessages.length) : 0;

  useEffect(() => {
    setSelectedResult(0);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!searchActive || !resultIds.length) {
      return;
    }

    const targetId = resultIds[Math.min(selectedResult, resultIds.length - 1)];
    messageRefs.current.get(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [resultIds, searchActive, selectedResult]);

  useEffect(() => {
    if (!searchActive && shouldAutoScrollRef.current) {
      scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
    }
  }, [messages, searchActive]);

  const handleScroll = () => {
    const nearBottom = isNearBottom();
    if (nearBottom) {
      setShowNewMessage(false);
      setShowJumpLatest(false);
      return;
    }

    const element = scrollRef.current;
    setShowJumpLatest(Boolean(element && element.scrollHeight - element.scrollTop - element.clientHeight > 360));
  };

  const stopTypingSoon = () => {
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit(SOCKET_EVENTS.TYPING_STOP, { roomId });
    }, 900);
  };

  const handleChange = (event) => {
    setMessage(event.target.value);
    socket.emit(SOCKET_EVENTS.TYPING_START, { roomId });
    stopTypingSoon();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      return;
    }

    shouldAutoScrollRef.current = true;
    socket.emit(SOCKET_EVENTS.CHAT_SEND, { roomId, message: cleanMessage });
    socket.emit(SOCKET_EVENTS.TYPING_STOP, { roomId });
    setMessage('');
    window.requestAnimationFrame(() => scrollToBottom());
  };

  const handleVoiceSend = async ({ blob, duration }) => {
    setVoiceSending(true);
    setVoiceError('');
    try {
      await sendVoiceNoteRequest(roomId, { blob, duration });
      shouldAutoScrollRef.current = true;
    } catch (uploadError) {
      setVoiceError(uploadError.message || 'Voice note upload failed.');
      throw uploadError;
    } finally {
      setVoiceSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const moveResult = (direction) => {
    if (!resultIds.length) {
      return;
    }

    setSelectedResult((current) => (current + direction + resultIds.length) % resultIds.length);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setDebouncedQuery('');
    setRemoteSearch({ messages: [], total: 0 });
    setSelectedResult(0);
  };

  const typingNames = useMemo(() => Array.from(typingUsers.values()).map((user) => user.name), [typingUsers]);
  const selectedMessageId = searchActive && resultIds.length ? resultIds[Math.min(selectedResult, resultIds.length - 1)] : null;

  return (
    <aside className="chat-container">
      <div className="chat-header">
        <div className="flex h-10 items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-neutral-400">Chat</h2>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-bold text-neutral-400">{messages.length}</span>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 transition hover:bg-white/10 hover:text-white"
            onClick={() => setSearchOpen(true)}
            aria-label="Search messages"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {searchOpen ? (
          <div className="grid gap-2 px-3 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                <input
                  className="h-9 w-full rounded-lg border border-white/10 bg-[#060807] pl-9 pr-8 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search messages..."
                  autoFocus
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-white"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </label>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/10 hover:text-white"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-500">
              <span>{searchActive ? (searchLoading ? 'Searching...' : `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`) : 'Type at least 2 characters'}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-neutral-400 hover:bg-white/10 disabled:opacity-40"
                  onClick={() => moveResult(-1)}
                  disabled={!resultIds.length}
                  aria-label="Previous result"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-neutral-400 hover:bg-white/10 disabled:opacity-40"
                  onClick={() => moveResult(1)}
                  disabled={!resultIds.length}
                  aria-label="Next result"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="messages">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading messages" />
          </div>
        ) : displayedMessages.length ? (
          <div className="messages-list">
            {groupedMessages.map((group) => (
              <section key={group.key} className="space-y-2">
                <DateSeparator label={group.label} />
                 {group.messages.map((item) => (
                  <MessageBubble
                    key={item._id}
                    item={item}
                    currentUserId={currentUser?._id}
                    isOwner={isOwner}
                    query={searchActive ? debouncedQuery : ''}
                    selected={item._id === selectedMessageId}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    messageRef={(node) => {
                      if (node) {
                        messageRefs.current.set(item._id, node);
                      } else {
                        messageRefs.current.delete(item._id);
                      }
                    }}
                  />
                ))}
              </section>
            ))}
            <div ref={endRef} />
          </div>
        ) : searchActive ? (
          <div className="flex h-full items-center justify-center text-center text-sm font-semibold text-neutral-500">
            No messages found
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm font-semibold text-neutral-500">
            No messages yet.
          </div>
        )}

        {showNewMessage && !searchActive ? (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-teal-300/20 bg-teal-300 px-3 py-1 text-xs font-black text-neutral-950 shadow-lg"
            onClick={() => scrollToBottom()}
          >
            New messages
          </button>
        ) : null}

        {showJumpLatest && !showNewMessage && !searchActive ? (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#17201d] px-3 py-1 text-xs font-black text-neutral-100 shadow-lg"
            onClick={() => scrollToBottom()}
          >
            Jump to latest
          </button>
        ) : null}
      </div>

      <div className="chat-typing">
        {typingNames.length ? `${typingNames.join(', ')} typing` : null}
      </div>

      <div className="chat-input">
        {voiceError ? <p className="mb-2 text-xs font-semibold text-rose-300">{voiceError}</p> : null}
        <form className={`voice-input-row flex gap-2 ${voiceRecorderState !== 'idle' ? 'voice-input-row-active' : ''}`} onSubmit={handleSubmit}>
          {voiceRecorderState === 'idle' ? (
            <textarea
              className="max-h-28 min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-[#060807] dark:text-white dark:focus:border-teal-300 dark:focus:ring-teal-300/20"
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              aria-label="Message"
            />
          ) : null}
          <VoiceRecorder
            disabled={voiceSending}
            sending={voiceSending}
            onSend={handleVoiceSend}
            onNotice={(notice) => setVoiceError(notice)}
            onStateChange={setVoiceRecorderState}
          />
          {voiceRecorderState === 'idle' ? (
            <Button type="submit" size="icon" aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          ) : null}
        </form>
      </div>
    </aside>
  );
};

export default ChatPanel;
