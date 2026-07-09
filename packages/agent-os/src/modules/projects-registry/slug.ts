/** Gera slug URL-safe a partir de título ou path. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Deriva título legível do basename de um workspace path. */
export function titleFromWorkspacePath(workspacePath: string): string {
  const normalized = workspacePath.replace(/\\/g, "/");
  const base = normalized.split("/").filter(Boolean).pop() ?? "project";
  return base.replace(/[-_]/g, " ");
}

/** Garante slug único sugerindo suffixo numérico. */
export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const trimmed = base.slice(0, 44);
  return `${trimmed}-${attempt + 1}`;
}
