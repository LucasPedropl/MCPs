import { z } from 'zod';

export const mcpToolSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  server_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  category_ids: z.array(z.string().uuid()).nullable().optional(),
  original_name: z.string(),
  custom_name: z.string().min(1, 'Nome da ferramenta é obrigatório'),
  custom_description: z.string().optional(),
  http_method: z.string(),
  endpoint_path: z.string(),
  parameters_schema: z.record(z.string(), z.any()).default({}),
});

export type McpToolEntity = z.infer<typeof mcpToolSchema>;

export const createMcpToolInputSchema = mcpToolSchema.omit({
  id: true,
  created_at: true,
});

export type CreateMcpToolInput = z.infer<typeof createMcpToolInputSchema>;

export const toolsBatchFormSchema = z.object({
  tools: z.array(
    z.object({
      original_name: z.string(),
      custom_name: z.string().min(1, 'Nome é obrigatório'),
      custom_description: z.string().optional(),
      http_method: z.string(),
      endpoint_path: z.string(),
      parameters_schema: z.record(z.string(), z.any()),
    })
  ),
});

export type ToolsBatchFormData = z.infer<typeof toolsBatchFormSchema>;
