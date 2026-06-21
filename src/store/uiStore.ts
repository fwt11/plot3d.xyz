import { create } from 'zustand';
import i18n from '@/i18n';

interface UiStore {
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
  toggleTheme: () => void;
  setLang: (lang: 'zh' | 'en') => void;
}

export const useUiStore = create<UiStore>()((set, get) => ({
  theme: 'dark',
  lang: (i18n.language?.startsWith('en') ? 'en' : 'zh') as 'zh' | 'en',

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    set({ theme: newTheme });
  },

  setLang: (lang) => {
    i18n.changeLanguage(lang);
    set({ lang });
  },
}));

// Sync initial theme to documentElement so cssVar() works on first render
document.documentElement.setAttribute('data-theme', 'dark');
