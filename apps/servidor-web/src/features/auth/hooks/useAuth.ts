'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface LoginResult {
  ok: boolean;
  error?: string;
}

export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/auth/me')
      .then(async (response) => {
        const data = (await response.json()) as {
          configured?: boolean;
          authenticated?: boolean;
        };
        if (cancelled) return;

        if (data.authenticated) {
          router.replace('/agent-os');
          return;
        }

        if (data.configured) {
          // Limpa erro falso vindo de ?error=not_configured (URL antiga / restart).
          setError(null);
          if (searchParams.get('error') === 'not_configured') {
            const next = searchParams.get('next');
            const url = next ? `/login?next=${encodeURIComponent(next)}` : '/login';
            router.replace(url);
          }
          return;
        }

        setError(
          'Auth não configurada. Verifique NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local (e reinicie o next dev).',
        );
      })
      .catch((err: unknown) => {
        console.error('Falha ao checar auth:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

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
