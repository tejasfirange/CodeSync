const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatChatDateGroup = (value) => {
  const date = toDate(value);
  if (!date) {
    return 'Unknown date';
  }

  const today = startOfDay(new Date());
  const messageDay = startOfDay(date);
  const diffDays = Math.round((today - messageDay) / 86400000);

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export const formatMessageTime = (value) => {
  const date = toDate(value);
  if (!date) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

export const groupMessagesByDate = (messages = []) => {
  const groups = new Map();

  messages.forEach((message) => {
    const date = toDate(message.createdAt);
    const key = date ? dateKey(date) : 'unknown';

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatChatDateGroup(date),
        messages: []
      });
    }

    groups.get(key).messages.push(message);
  });

  return Array.from(groups.values());
};
