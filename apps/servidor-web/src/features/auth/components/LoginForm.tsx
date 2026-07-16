'use client';

import React, { FormEvent, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useLogin } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LoginForm() {
  const { login, isSubmitting, error } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void login(email, password, remember);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-ink-muted">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@email.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-medium text-ink-muted">
          Senha
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-9 min-w-9 rounded-md text-ink-muted hover:text-ink"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden />
            ) : (
              <Eye className="w-4 h-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer select-none min-h-9">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="rounded border-subtle text-accent focus:ring-accent"
        />
        Lembrar-me neste dispositivo (até sair)
      </label>

      {error && (
        <div
          className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        <LogIn className="w-4 h-4" aria-hidden />
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
