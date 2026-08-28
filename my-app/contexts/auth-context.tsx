import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as authStore from '@/lib/auth/store';
import { AuthUser, LoginInput, RegisterInput } from '@/lib/auth/types';

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthContextType = {
  status: Status;
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    (async () => {
      const restored = await authStore.restoreSession();
      setUser(restored);
      setStatus(restored ? 'signedIn' : 'signedOut');
    })();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const loggedIn = await authStore.login(input);
    setUser(loggedIn);
    setStatus('signedIn');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const created = await authStore.register(input);
    setUser(created);
    setStatus('signedIn');
  }, []);

  const logout = useCallback(async () => {
    await authStore.logout();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isLoading: status === 'loading',
      login,
      register,
      logout,
    }),
    [status, user, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}