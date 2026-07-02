import { z } from 'zod';

// Validação do formulário de input da URL
export const swaggerInputSchema = z.object({
  swaggerUrl: z
    .string()
    .min(1, 'A URL é obrigatória')
    .url('Insira uma URL válida (ex: https://.../swagger.json)'),
});

export type SwaggerInputFormData = z.infer<typeof swaggerInputSchema>;

// Estrutura de uma Tool parseada do Swagger
export const parsedToolSchema = z.object({
  originalName: z.string(),
  customName: z.string(),
  customDescription: z.string().optional(),
  httpMethod: z.string(),
  endpointPath: z.string(),
  parametersSchema: z.record(z.string(), z.any()).default({}),
});

export type ParsedTool = z.infer<typeof parsedToolSchema>;

// Estrutura completa do retorno do parse
export const parsedSwaggerSchema = z.object({
  title: z.string(),
  baseUrl: z.string(),
  swaggerUrl: z.string(),
  tools: z.array(parsedToolSchema),
});

export type ParsedSwagger = z.infer<typeof parsedSwaggerSchema>;
