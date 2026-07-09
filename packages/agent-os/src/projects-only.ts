export {
  listProjects,
  getProjectById,
  getProjectBySlug,
  upsertProject,
  deleteProject,
  uploadProjectCover,
  parseGithubUrl,
} from "./modules/projects-registry/project-store.js";
export type {
  AgentProject,
  UpsertProjectInput,
  ListProjectsFilters,
  ProjectStatus,
  ProjectType,
} from "./modules/projects-registry/project-store.js";
export { syncProjectFromGithub } from "./modules/projects-registry/project-sync-github.js";
export { syncProjectFromVercel } from "./modules/projects-registry/project-sync-vercel.js";
export { assembleProjectDocs } from "./modules/projects-registry/project-docs-assembler.js";
