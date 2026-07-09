import type { AgentProject } from "./project-store.js";

/** Monta documentação markdown completa do projeto. */
export function assembleProjectDocs(
  project: AgentProject,
  extras?: { githubReadme?: string; vercelNote?: string },
): string {
  const lines: string[] = [
    `# ${project.title}`,
    "",
    project.title_en ? `**EN:** ${project.title_en}` : "",
    project.title_en ? "" : "",
    "## Descrição",
    project.description || "_Sem descrição._",
    "",
  ];

  if (project.description_en) {
    lines.push("## Description (EN)", project.description_en, "");
  }

  lines.push(
    "## Metadados",
    `- **Slug:** \`${project.slug}\``,
    `- **Status:** ${project.status}`,
    `- **Tipo:** ${project.type}`,
    `- **Featured:** ${project.featured ? "sim" : "não"}`,
    `- **Tags:** ${project.tags.length ? project.tags.join(", ") : "—"}`,
    "",
  );

  if (project.workspace_path) {
    lines.push("## Workspace", `\`${project.workspace_path}\``, "");
  }

  lines.push("## Links");
  if (project.github_url) lines.push(`- **GitHub:** ${project.github_url}`);
  if (project.deploy_url) lines.push(`- **Deploy:** ${project.deploy_url}`);
  if (project.cover_image_url) lines.push(`- **Capa:** ${project.cover_image_url}`);
  lines.push("");

  if (Object.keys(project.stack_json).length > 0) {
    lines.push("## Stack detectada", "```json", JSON.stringify(project.stack_json, null, 2), "```", "");
  }

  if (extras?.vercelNote) {
    lines.push("## Vercel", extras.vercelNote, "");
  }

  const readme = extras?.githubReadme ?? project.docs_md;
  if (readme.trim()) {
    lines.push("## README", readme.trim(), "");
  }

  if (project.readme_synced_at) {
    lines.push(`_README sincronizado em ${project.readme_synced_at}_`, "");
  }

  return lines.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n");
}
