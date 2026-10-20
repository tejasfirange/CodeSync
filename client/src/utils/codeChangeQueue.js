const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const metadataKeys = ['filename', 'path', 'language'];
const isValidMetadata = (value) => value !== undefined && value !== null && value !== '';

const mergePayload = (current, next) => {
  const merged = { ...current };

  metadataKeys.forEach((key) => {
    if (hasOwn(next, key) && isValidMetadata(next[key])) {
      merged[key] = next[key];
    }
  });

  if (hasOwn(next, 'content')) {
    // An empty string is a real edit and must not be treated as a missing patch.
    merged.content = next.content;
  }

  if (hasOwn(next, 'version') && next.version !== undefined && next.version !== null) {
    merged.version = next.version;
  }

  return merged;
};

export const createCodeChangeQueue = ({
  delay = 120,
  send,
  isConnected = () => true,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout
} = {}) => {
  if (typeof send !== 'function') {
    throw new TypeError('createCodeChangeQueue requires a send function');
  }

  const pending = new Map();

  const flush = (fileId) => {
    const entry = pending.get(fileId);
    if (!entry) {
      return;
    }

    pending.delete(fileId);

    // Dropping here is intentional: disconnected edits must not be replayed by
    // Socket.IO's manager buffer when the connection comes back.
    if (!isConnected()) {
      return;
    }

    send({ ...entry.payload });
  };

  const enqueue = (payload) => {
    const fileId = payload?.fileId;
    if (!fileId) {
      return false;
    }

    if (!isConnected()) {
      cancelFile(fileId);
      return false;
    }

    const current = pending.get(fileId);
    if (current) {
      cancel(current.timer);
    }

    const entry = {
      payload: current ? mergePayload(current.payload, payload) : { ...payload },
      timer: schedule(() => flush(fileId), delay)
    };
    pending.set(fileId, entry);
    return true;
  };

  const cancelFile = (fileId) => {
    const entry = pending.get(fileId);
    if (!entry) {
      return false;
    }

    cancel(entry.timer);
    pending.delete(fileId);
    return true;
  };

  const cancelAll = () => {
    pending.forEach((entry) => cancel(entry.timer));
    pending.clear();
  };

  const updateMetadata = (fileId, metadata) => {
    const entry = pending.get(fileId);
    if (!entry) {
      return false;
    }

    entry.payload = mergePayload(entry.payload, metadata);
    return true;
  };

  const getPending = (fileId) => {
    const entry = pending.get(fileId);
    return entry ? { ...entry.payload } : null;
  };

  return {
    enqueue,
    cancelFile,
    cancelAll,
    updateMetadata,
    getPending,
    hasPending: (fileId) => pending.has(fileId)
  };
};
