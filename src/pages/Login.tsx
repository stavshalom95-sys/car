import { Car } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isFirebaseConfigured } from '../lib/firebase';
import { Alert, Button } from '../components/ui';
import { useTheme } from '../lib/hooks';

export default function Login() {
  const { signIn, error, useLocalMode } = useAuth();
  useTheme();
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card w-full max-w-sm space-y-5 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-white dark:bg-blue-500 dark:text-slate-950">
          <Car className="h-9 w-9" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">הרכב שלי</h1>
          <p className="mt-1 muted">פיג׳ו 3008 · 2019</p>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {isFirebaseConfigured ? (
          <Button className="w-full py-3 text-base" onClick={signIn}>
            <GoogleIcon /> התחברות עם Google
          </Button>
        ) : (
          <>
            <Alert tone="info">
              <p>Firebase עדיין לא הוגדר, לכן אין סנכרון בין מכשירים.</p>
              <p>ראה את המדריך בקובץ SETUP.md במאגר.</p>
            </Alert>
            <Button variant="secondary" className="w-full" onClick={useLocalMode}>המשך במצב מקומי (ללא סנכרון)</Button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 rounded-full bg-white p-0.5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6c1.9-5.6 7.1-9.8 13.6-9.8z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.5 0-11.7-4.2-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
