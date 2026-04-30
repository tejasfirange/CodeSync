export const applyTheme = () => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = 'dark';
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'dark';

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('codesync-theme');
  }
};

applyTheme();
