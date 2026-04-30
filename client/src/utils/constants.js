const getDevServerOrigin = (port) => {
  if (typeof window === 'undefined') {
    return `http://localhost:${port}`;
  }

  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

const apiPort = import.meta.env.VITE_API_PORT || '5000';
const socketPort = import.meta.env.VITE_SOCKET_PORT || apiPort;

export const API_URL = import.meta.env.VITE_API_URL || `${getDevServerOrigin(apiPort)}/api`;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getDevServerOrigin(socketPort);

export const LANGUAGES = [
  { label: 'JavaScript', value: 'javascript', extension: 'js' },
  { label: 'Python', value: 'python', extension: 'py' },
  { label: 'Java', value: 'java', extension: 'java' },
  { label: 'C++', value: 'cpp', extension: 'cpp' },
  { label: 'C#', value: 'csharp', extension: 'cs' },
  { label: 'Go', value: 'go', extension: 'go' },
  { label: 'Rust', value: 'rust', extension: 'rs' },
  { label: 'HTML', value: 'html', extension: 'html' },
  { label: 'CSS', value: 'css', extension: 'css' },
  { label: 'JSON', value: 'json', extension: 'json' },
  { label: 'Markdown', value: 'markdown', extension: 'md' }
];

export const DEFAULT_CODE = `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('CodeSync'));`;

export const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CS';

export const formatTime = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
