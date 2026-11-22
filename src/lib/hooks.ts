import { useEffect, useState } from 'react';
import { useData } from './data';
import { useToast } from '../components/ui';
import type { CollectionName } from './types';

/** Save helper: adds or updates, and reports errors (e.g. blocked sensitive data) as a toast. Returns true on success. */
export function useSave(col: CollectionName) {
  const { add, update } = useData();
  const toast = useToast();
  return async (data: object, id?: string): Promise<boolean> => {
    try {
      if (id) await update(col, id, data);
      else await add(col, data);
      toast(id ? 'עודכן' : 'נשמר');
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    }
  };
}

export type ThemePref = 'light' | 'dark' | 'system';

export function useTheme(): [ThemePref, (t: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem('car-theme') as ThemePref) || 'system');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#1d4ed8');
    };
    apply();
    localStorage.setItem('car-theme', pref);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
  return [pref, setPref];
}
