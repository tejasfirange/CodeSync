const extensionMap = new Map([
  ['js', 'javascript'],
  ['py', 'python'],
  ['cpp', 'cpp'],
  ['cc', 'cpp'],
  ['cxx', 'cpp'],
  ['c', 'c']
]);

const normalizedLanguageMap = new Map([
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['node', 'javascript'],
  ['python', 'python'],
  ['py', 'python'],
  ['cpp', 'cpp'],
  ['c++', 'cpp'],
  ['cc', 'cpp'],
  ['cxx', 'cpp'],
  ['c', 'c']
]);

export const detectLanguageFromFile = (path = '') => {
  const extension = String(path).split('.').pop()?.toLowerCase();
  return extensionMap.get(extension) || null;
};

export const normalizeExecutableLanguage = (language) => normalizedLanguageMap.get(String(language || '').toLowerCase()) || null;

export const isExecutableLanguage = (language, path = '') => {
  const detected = detectLanguageFromFile(path);
  const normalized = normalizeExecutableLanguage(language);
  return Boolean(detected || normalized);
};
