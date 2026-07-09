import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(120),
  email: z.string().email().optional(),
  createdAt: z.string().datetime(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  ref: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  organizationSlug: z.string().optional(),
  anonKey: z.string().optional(),
  syncedAt: z.string().datetime().optional(),
});

export const keepAliveEntrySchema = z.object({
  projectRef: z.string().min(1),
  accountId: z.string().uuid(),
  url: z.string().url(),
  anonKey: z.string().min(1),
  enabled: z.boolean().default(true),
  lastPingAt: z.string().datetime().optional(),
  lastStatus: z.enum(["ok", "failed", "paused"]).optional(),
  lastLatencyMs: z.number().int().nonnegative().optional(),
  lastError: z.string().optional(),
});

export const activeContextSchema = z.object({
  accountId: z.string().uuid(),
  projectRef: z.string().min(1),
  projectName: z.string().optional(),
  switchedAt: z.string().datetime(),
});

export const hubConfigSchema = z.object({
  version: z.literal(1),
  accounts: z.array(accountSchema),
  projects: z.array(projectSchema),
  keepAlive: z.array(keepAliveEntrySchema),
  activeContext: activeContextSchema.nullable(),
  settings: z.object({
    keepAliveCron: z.string().default("0 0 */3 * *"),
    readOnly: z.boolean().default(false),
  }),
});

export type Account = z.infer<typeof accountSchema>;
export type Project = z.infer<typeof projectSchema>;
export type KeepAliveEntry = z.infer<typeof keepAliveEntrySchema>;
export type ActiveContext = z.infer<typeof activeContextSchema>;
export type HubConfig = z.infer<typeof hubConfigSchema>;

export const addAccountInputSchema = z.object({
  label: z.string().min(1).max(120),
  pat: z.string().min(10),
  email: z.string().email().optional(),
});

export const switchProjectInputSchema = z.object({
  accountId: z
    .string()
    .uuid()
    .optional()
    .describe("UUID da conta. Alternativa: accountLabel."),
  accountLabel: z
    .string()
    .optional()
    .describe("Label da conta (ex: 'minha-org'). Obtenha via list_accounts."),
  projectRef: z
    .string()
    .min(1)
    .describe("ID do projeto Supabase (ex: enqpcrvqmzuyzglgwnrk). Obtenha via list_projects."),
});

export const createProjectInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  organizationSlug: z.string().min(1),
  dbPass: z.string().min(8),
  regionCode: z.string().default("americas"),
});

export type AddAccountInput = z.infer<typeof addAccountInputSchema>;
export type SwitchProjectInput = z.infer<typeof switchProjectInputSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
