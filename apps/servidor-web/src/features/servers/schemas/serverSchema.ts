import { z } from 'zod';

export const mcpServerSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  name: z.string().min(1, 'Nome do servidor é obrigatório'),
  swagger_url: z.string().url(),
  api_base_url: z.string().url(),
  auth_type: z.enum(['none', 'dashboard_login', 'autonomous']).default('none'),
  auth_credentials: z.record(z.string(), z.any()).default({}),
});

export type McpServerEntity = z.infer<typeof mcpServerSchema>;

export const createMcpServerInputSchema = mcpServerSchema.omit({
  id: true,
  created_at: true,
});

export type CreateMcpServerInput = z.infer<typeof createMcpServerInputSchema>;
