import { z } from "zod";
import { DEFAULT_COPILOT_MODEL } from "./types.js";

/**
 * Zod schema for validating Copilot delegation inputs.
 */
export const delegateToCopilotInputSchema = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  model: z
    .string()
    .optional()
    .default(DEFAULT_COPILOT_MODEL),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional(),
  workspacePath: z
    .string()
    .optional(),
  agenticMode: z
    .boolean()
    .optional(),
});

/**
 * Inferred type from the input schema.
 * Note: This structurally matches DelegateToCopilotInput from types.js.
 */
export type DelegateToCopilotInputSchema = z.infer<typeof delegateToCopilotInputSchema>;
