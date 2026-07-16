---
name: nextjs-patterns
description: Arquitetura de código Next.js do Pedro — Clean Architecture Smart/Dumb, hooks customizados obrigatórios, estrutura de pastas por feature (DDD), camada de dados UI→Hook→Service→Supabase, RLS/Auth, selects pesquisáveis, proibição de alert(). Use ao criar ou estruturar features, componentes, hooks, services, páginas ou inputs.
---

# Next.js Patterns

## Separação de responsabilidades (Clean Architecture)

Planeje estado, hooks e fluxo de dados ANTES de gerar a UI.

- **Smart & Dumb**: componentes de UI só recebem props e não têm lógica de
  dados; pages/containers gerenciam estado e invocam as camadas inferiores.
- **Hooks obrigatórios**: componentes visuais NUNCA fazem fetch direto ao
  Supabase ou a APIs — toda lógica externa fica isolada em hooks
  (`useTasks()`, `useSupabase()`...).
- **Camadas de dados**: UI → Hook de ação → Service/Repository → Supabase Client.

## Estrutura de diretórios (DDD por feature)

Organize por `src/features/<modulo>/`:

- `/components` — UI local da feature
- `/hooks` — lógica de negócio
- `/services` — repositório de interação com Supabase/API
- `/schemas` — validações Zod e definições de tipos

## Regras de UI

- Forms com react-hook-form + zod.
- Selects sempre pesquisáveis — o usuário deve poder filtrar as opções
  digitando. Refaça os que não forem; crie um componente universal se ajudar.
- Erros na UI via toast/notificação — nunca `alert()`. Log técnico com
  `console.error`/`console.warn`.

## Segurança e dados

- Confie em RLS no Supabase + Auth JWT via client isolado — não reimplemente
  autorização no client.
- Projetos ainda em desenvolvimento: não se preocupe em preservar
  dados/schema do banco — pode resetar quando necessário para testar
  mudanças estruturais (a menos que o Pedro diga que o projeto já está em
  produção).
