# @mcps/openapi-engine

Engine OpenAPI → MCP: parse Swagger, sync, proxy HTTP, meta-tools runtime e gateway SSE.

## Uso CLI

```bash
node packages/openapi-engine/dist/index.js --serverId <uuid>
node packages/openapi-engine/dist/index.js --sse
```

## Import programático

```typescript
import { runOpenApiSync, parseSwaggerUrl } from "@mcps/openapi-engine/sync";
import { createMcpServerInstance } from "@mcps/openapi-engine";
```

Playbooks usam tabela canônica `agent_playbooks`.
