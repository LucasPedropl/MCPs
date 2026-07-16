'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface LoginResult {
  ok: boolean;
  error?: string;
}

export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (searchParams.get('error') === 'not_configured') {
      return 'Auth não configurada. Verifique Supabase (URL + keys) no .env.local. Credenciais de login ficam no Supabase Auth.';
    }
    return null;
  });

  const login = useCallback(
    async (email: string, password: string, remember: boolean): Promise<LoginResult> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, remember }),
        });
        const data = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok) {
          const message = data.error ?? 'Falha no login';
          setError(message);
          return { ok: false, error: message };
        }
        const next = searchParams.get('next') || '/agent-os';
        router.replace(next.startsWith('/') ? next : '/agent-os');
        router.refresh();
        return { ok: true };
      } catch (err: unknown) {
        console.error('Falha no login:', err);
        const message = 'Falha de rede no login';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsSubmitting(false);
      }
    },
    [router, searchParams],
  );

  return { login, isSubmitting, error, setError };
}

export function useLogout() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch (err: unknown) {
      console.error('Falha no logout:', err);
    } finally {
      setIsLoggingOut(false);
    }
  }, [router]);

  return { logout, isLoggingOut };
}
