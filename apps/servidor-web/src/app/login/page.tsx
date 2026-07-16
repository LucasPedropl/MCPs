import React, { Suspense } from 'react';
import { Brain } from 'lucide-react';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="relative min-h-full flex items-center justify-center px-4 py-12 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, var(--accent-muted), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, var(--accent-muted), transparent)',
        }}
      />

      <div className="relative w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-11 h-11 rounded-md bg-accent-muted ring-1 ring-accent/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Agent OS
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Acesse o painel — sessão via cookie httpOnly.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-subtle bg-panel p-6 shadow-[var(--shadow-panel)]">
          <Suspense
            fallback={<p className="text-xs text-ink-muted">Carregando…</p>}
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-[11px] text-center text-ink-muted leading-relaxed">
          Credenciais no Supabase Auth. Marque Lembrar-me para ficar logado até
          clicar em Sair.
        </p>
      </div>
    </div>
  );
}
