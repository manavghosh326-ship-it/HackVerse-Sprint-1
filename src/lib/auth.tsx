import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { RiskProfile } from './types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  riskProfile: RiskProfile;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, riskProfile: RiskProfile) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRiskProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('moderate');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      const meta = s?.user?.user_metadata?.risk_profile as RiskProfile | undefined;
      if (meta) setRiskProfile(meta);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      (async () => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        const meta = s?.user?.user_metadata?.risk_profile as RiskProfile | undefined;
        if (meta) setRiskProfile(meta);
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, profile: RiskProfile) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { risk_profile: profile },
      },
    });
    if (error) return { error: error.message };
    // Set the risk profile from signup
    if (data.user) {
      setRiskProfile(profile);
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRiskProfile('moderate');
  }, []);

  const refreshRiskProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.auth.getUser();
    const meta = data.user?.user_metadata?.risk_profile as RiskProfile | undefined;
    if (meta) setRiskProfile(meta);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, loading, riskProfile, signIn, signUp, signOut, refreshRiskProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
