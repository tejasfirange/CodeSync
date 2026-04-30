import { ChevronDown, ChevronUp, Search, Send, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { listMessagesRequest, searchMessagesRequest } from '../../api/chat.api.js';
import { SOCKET_EVENTS } from '../../socket/socketEvents.js';
import { groupMessagesByDate, formatMessageTime } from '../../utils/chatDate.js';
import { getInitials } from '../../utils/constants.js';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';

const getSenderName = (message, currentUserId) => (message.sender?._id === currentUserId ? 'You' : message.sender?.name || 'Unknown user');
const matchesQuery = (message, query) => {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return false;
  }

  return (
    message.message?.toLowerCase().includes(cleanQuery) ||
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
  <div className="sticky top-2 z-10 my-3 flex justify-center">
    <span className="rounded-full border border-white/10 bg-[#17201d]/95 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-neutral-300 shadow-sm">
      {label}
    </span>
  </div>
);

const MessageBubble = memo(({ item, currentUserId, query, selected, messageRef }) => {
  const isMine = item.sender?._id === currentUserId;
  const senderName = getSenderName(item, currentUserId);

  return (
    <div
      ref={messageRef}
      className={`flex gap-2 rounded-lg transition ${isMine ? 'justify-end' : 'justify-start'} ${selected ? 'bg-amber-300/10 ring-1 ring-amber-300/30' : ''}`}
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
        className={`max-w-[84%] rounded-lg px-3 py-2 ${
          isMine
            ? 'bg-neutral-950 text-white dark:bg-teal-300 dark:text-neutral-950'
            : 'bg-neutral-100 text-neutral-900 dark:bg-white/[0.07] dark:text-neutral-100'
        }`}
      >
        <div className="mb-1 flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-bold">
            <HighlightedText text={senderName} query={query} />
          </span>
          <span className={`shrink-0 text-[11px] ${isMine ? 'text-neutral-300 dark:text-neutral-700' : 'text-neutral-500 dark:text-neutral-400'}`}>
            {formatMessageTime(item.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-5">
          <HighlightedText text={item.message} query={query} />
        </p>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

const ChatPanel = ({ roomId, socket, currentUser }) => {
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

    socket.on(SOCKET_EVENTS.CHAT_NEW, handleNewMessage);
    socket.on(SOCKET_EVENTS.TYPING_START, handleTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_NEW, handleNewMessage);
      socket.off(SOCKET_EVENTS.TYPING_START, handleTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);
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
    <aside className="flex h-full min-h-0 flex-col bg-[#0f1413]">
      <div className="shrink-0 border-b border-white/10">
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

      <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading messages" />
          </div>
        ) : displayedMessages.length ? (
          <div className="space-y-2">
            {groupedMessages.map((group) => (
              <section key={group.key} className="space-y-3">
                <DateSeparator label={group.label} />
                {group.messages.map((item) => (
                  <MessageBubble
                    key={item._id}
                    item={item}
                    currentUserId={currentUser?._id}
                    query={searchActive ? debouncedQuery : ''}
                    selected={item._id === selectedMessageId}
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

      <div className="min-h-6 px-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {typingNames.length ? `${typingNames.join(', ')} typing` : null}
      </div>

      <form className="flex gap-2 border-t border-neutral-200 p-3 dark:border-white/10" onSubmit={handleSubmit}>
        <textarea
          className="max-h-28 min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-[#060807] dark:text-white dark:focus:border-teal-300 dark:focus:ring-teal-300/20"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          aria-label="Message"
        />
        <Button type="submit" size="icon" aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </aside>
  );
};

export default ChatPanel;
