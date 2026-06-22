import { create } from 'zustand';
import i18n from '@/i18n';

interface UiStore {
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLang: (lang: 'zh' | 'en') => void;
}

const THEME_KEY = 'plot3d-theme';
const LANG_KEY = 'plot3d-lang';

function readStoredTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage may be unavailable (private mode, SSR, etc.)
  }
  return 'dark';
}

function readStoredLang(): 'zh' | 'en' {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    // fall through to detector
  }
  return (i18n.language?.startsWith('en') ? 'en' : 'zh') as 'zh' | 'en';
}

export const useUiStore = create<UiStore>()((set, get) => ({
  theme: readStoredTheme(),
  lang: readStoredLang(),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
    set({ theme });
  },

  setLang: (lang) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore storage errors
    }
    set({ lang });
  },
}));

// Sync initial theme to documentElement so cssVar() works on first render
document.documentElement.setAttribute('data-theme', readStoredTheme());
