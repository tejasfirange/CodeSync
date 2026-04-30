const palette = [
  { cursor: '#22d3ee', selection: 'rgba(34, 211, 238, 0.22)', gradient: 'linear-gradient(135deg, #22d3ee, #14b8a6)' },
  { cursor: '#a78bfa', selection: 'rgba(167, 139, 250, 0.22)', gradient: 'linear-gradient(135deg, #a78bfa, #ec4899)' },
  { cursor: '#34d399', selection: 'rgba(52, 211, 153, 0.22)', gradient: 'linear-gradient(135deg, #34d399, #84cc16)' },
  { cursor: '#fb923c', selection: 'rgba(251, 146, 60, 0.22)', gradient: 'linear-gradient(135deg, #fb923c, #f59e0b)' },
  { cursor: '#f472b6', selection: 'rgba(244, 114, 182, 0.22)', gradient: 'linear-gradient(135deg, #f472b6, #ef4444)' }
];

const hashString = (value) =>
  String(value || 'user').split('').reduce((hash, char) => {
    const nextHash = (hash << 5) - hash + char.charCodeAt(0);
    return nextHash & nextHash;
  }, 0);

export const getUserColor = (userId) => palette[Math.abs(hashString(userId)) % palette.length];

export const getSafeUserClass = (userId) => String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '');
