import { z } from 'zod';

export const mcpCategorySchema = z.object({
  id: z.string().uuid(),
  server_id: z.string().uuid(),
  name: z.string().min(1, 'Nome da categoria é obrigatório'),
  custom_prompt: z.string().nullable().optional(),
  created_at: z.string(),
});

export type McpCategoryEntity = z.infer<typeof mcpCategorySchema>;

export const createMcpCategoryInputSchema = mcpCategorySchema.omit({
  id: true,
  created_at: true,
});

export type CreateMcpCategoryInput = z.infer<typeof createMcpCategoryInputSchema>;

export const updateMcpCategoryInputSchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório').optional(),
  custom_prompt: z.string().nullable().optional(),
});

export type UpdateMcpCategoryInput = z.infer<typeof updateMcpCategoryInputSchema>;
