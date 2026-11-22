import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User,
} from 'firebase/auth';
import { allowedEmail, auth, isFirebaseConfigured } from './firebase';

export interface AppUser {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  local: boolean;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  useLocalMode: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const LOCAL_KEY = 'car-local-mode';

const toAppUser = (u: User): AppUser => ({
  uid: u.uid, name: u.displayName ?? u.email ?? '', email: u.email ?? undefined, photoURL: u.photoURL ?? undefined, local: false,
});

const LOCAL_USER: AppUser = { uid: 'local', name: 'מצב מקומי', local: true };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(localStorage.getItem(LOCAL_KEY) ? LOCAL_USER : null);
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      if (u && allowedEmail && u.email?.toLowerCase() !== allowedEmail) {
        setError('החשבון הזה אינו מורשה להשתמש באפליקציה.');
        await fbSignOut(auth!);
        setUser(null);
      } else {
        setUser(u ? toAppUser(u) : null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    if (!auth) return;
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('ההתחברות נכשלה. נסה שוב.');
        console.error(e);
      }
    }
  };

  const signOut = async () => {
    if (user?.local) {
      localStorage.removeItem(LOCAL_KEY);
      setUser(null);
      return;
    }
    if (auth) await fbSignOut(auth);
  };

  const useLocalMode = () => {
    localStorage.setItem(LOCAL_KEY, '1');
    setUser(LOCAL_USER);
  };

  return <Ctx.Provider value={{ user, loading, error, signIn, signOut, useLocalMode }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
