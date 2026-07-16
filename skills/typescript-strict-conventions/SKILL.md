---
name: typescript-strict-conventions
description: Convenções de TypeScript estrito do Pedro — proibição de any, tipos inferidos do Zod, nomenclatura hiper-descritiva em inglês, tratamento de erros com try/catch e estados error/isLoading, limite de linhas por arquivo, JSDoc em funções complexas. Use ao escrever ou revisar código TypeScript, tipos, DTOs, hooks ou tratamento de erros.
---

# TypeScript Strict Conventions

- **Proibido `any`**: nunca use `any` em responses, inputs, arrays ou hooks.
  Defina interfaces/tipos explícitos, preferencialmente inferidos do Zod
  (`z.infer<typeof schema>`). Se for genuinamente necessário um tipo
  genérico, use `unknown` + type narrowing (nunca `any` como atalho).
- **Tratamento de erros**: toda chamada assíncrona usa try/catch e expõe
  estados `error`/`isLoading` para a UI consumir.
- **Nomenclatura**: nomes hiper-descritivos em inglês (Clean Code) — evite
  abreviações e nomes genéricos (`data`, `temp`, `handleClick2`).
- **Tamanho de arquivo**: máx. 150–200 linhas por arquivo `.ts`/`.tsx`.
  Extraia sub-componentes ou lógica para arquivos próprios quando exceder.
- **Documentação**: JSDoc conciso em funções e hooks complexos — só quando a
  assinatura não fala por si (parâmetro não óbvio, efeito colateral, contrato
  implícito). Não documente o óbvio.
