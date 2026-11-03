// Follows the phone's setting until the user picks light or dark with the header button.

export type Theme = 'light' | 'dark';

export function applyTheme(theme: Theme | undefined) {
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
}

export function effectiveTheme(theme: Theme | undefined): Theme {
  return theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
