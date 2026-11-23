import { NavLink, Outlet, Link } from 'react-router-dom';
import { CalendarCheck, Car, CircleDot, FileText, Fuel, LayoutGrid, Moon, Receipt, Settings as SettingsIcon, Sun, SunMoon, Wrench } from 'lucide-react';
import { useTheme, type ThemePref } from '../lib/hooks';
import { useData } from '../lib/data';
import { useAuth } from '../lib/auth';
import { cx, IconButton } from './ui';

const NAV = [
  { to: '/', label: 'מה דחוף', icon: Car, end: true },
  { to: '/fuel', label: 'תדלוקים', icon: Fuel },
  { to: '/maintenance', label: 'טיפולים', icon: Wrench },
  { to: '/parts', label: 'חלקים', icon: CircleDot },
  { to: '/test', label: 'טסט', icon: CalendarCheck },
  { to: '/documents', label: 'מסמכים', icon: FileText },
  { to: '/expenses', label: 'הוצאות', icon: Receipt },
];

/** Mobile bottom bar: 4 main sections + "more" */
const MOBILE_NAV = [...NAV.slice(0, 4), { to: '/more', label: 'עוד', icon: LayoutGrid, end: false }];

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'ערכת נושא: לפי המכשיר', light: 'ערכת נושא: בהיר', dark: 'ערכת נושא: כהה' };

export default function Layout() {
  const [theme, setTheme] = useTheme();
  const { settings, lastError } = useData();
  const { user } = useAuth();
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : SunMoon;

  return (
    <div className="min-h-dvh pb-24 sm:pb-8">
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
          <Link to="/" className="flex flex-1 items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white dark:bg-blue-500 dark:text-slate-950"><Car className="h-5 w-5" /></span>
            <span className="truncate">{settings.carName}</span>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cx('rounded-lg px-3 py-1.5 text-sm', isActive ? 'bg-blue-100 font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'muted hover:bg-slate-100 dark:hover:bg-slate-800')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <IconButton label={THEME_LABEL[theme]} onClick={() => setTheme(NEXT_THEME[theme])}><ThemeIcon className="h-5 w-5" /></IconButton>
          <Link to="/settings" aria-label="הגדרות" title="הגדרות" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </div>
        {user?.local && (
          <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            מצב מקומי – הנתונים נשמרים רק במכשיר הזה ולא מסונכרנים
          </div>
        )}
        {lastError && <div className="bg-red-100 px-4 py-1 text-center text-xs text-red-900 dark:bg-red-950 dark:text-red-200">{lastError}</div>}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'font-medium text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400')}>
              <n.icon className="h-6 w-6" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
