'use client';

import React, { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useLogin } from '../hooks/useAuth';

export function LoginForm() {
  const { login, isSubmitting, error } = useLogin();
  const [email, setEmail] = useState('pedrolucasmota2005@gmail.com');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void login(email, password, remember);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-zinc-500">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
          placeholder="voce@email.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-medium text-zinc-500">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
          placeholder="••••••••"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="rounded border-zinc-300 dark:border-zinc-700"
        />
        Lembrar-me neste dispositivo (30 dias)
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-60"
      >
        <LogIn className="w-4 h-4" />
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
