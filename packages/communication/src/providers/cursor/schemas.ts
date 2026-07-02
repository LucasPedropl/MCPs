import { z } from 'zod';
import { DEFAULT_CURSOR_MODEL } from './types.js';

/**
 * Zod schema for validating Cursor delegation inputs.
 */
export const delegateToCursorInputSchema = z.object({
  prompt: z.string().min(1, { message: 'Prompt is required' }),
  model: z
    .string()
    .optional()
    .default(DEFAULT_CURSOR_MODEL),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional(),
  workspacePath: z
    .string()
    .optional(),
});

/**
 * Inferred type from the input schema.
 * Note: This structurally matches DelegateToCursorInput from types.js.
 */
export type DelegateToCursorInputSchema = z.infer<typeof delegateToCursorInputSchema>;
