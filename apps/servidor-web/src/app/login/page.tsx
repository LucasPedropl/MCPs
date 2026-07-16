import React, { Suspense } from 'react';
import { Brain } from 'lucide-react';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-11 h-11 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center">
            <Brain className="w-5 h-5 text-white dark:text-black" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Agent OS</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Login do dashboard — sessão via cookie httpOnly.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
          <Suspense fallback={<p className="text-xs text-zinc-500">Carregando…</p>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
          Credenciais no <strong>Supabase Auth</strong>. Marque Lembrar-me para
          ficar logado até clicar em Sair (cookie httpOnly — senha não vai para
          localStorage).
        </p>
      </div>
    </div>
  );
}
