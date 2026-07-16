import * as fs from "node:fs";
import * as path from "node:path";

export type SkillFileEncoding = "utf8" | "base64";

export interface SkillFileEntry {
  encoding: SkillFileEncoding;
  content: string;
  size: number;
}

/** Paths POSIX relativos ao root da skill → conteúdo empacotado. */
export type SkillFilesJson = Record<string, SkillFileEntry>;

export interface SkillFileManifestEntry {
  path: string;
  encoding: SkillFileEncoding;
  size: number;
}

export const SKILL_FILE_MAX_BYTES = 100 * 1024;
export const SKILL_FILES_MAX_TOTAL_BYTES = 500 * 1024;
export const SKILL_FILES_MAX_COUNT = 40;

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".sh",
  ".ps1",
  ".sql",
  ".toml",
  ".xml",
  ".csv",
  ".d.ts",
]);

const SIDECAR_DIRS = new Set(["scripts", "references", "assets"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

function toPosixRelative(fromDir: string, absolutePath: string): string {
  return path.relative(fromDir, absolutePath).split(path.sep).join("/");
}

function isTextPath(relativePosix: string): boolean {
  const lower = relativePosix.toLowerCase();
  if (lower.endsWith(".d.ts")) {
    return true;
  }
  const ext = path.posix.extname(lower);
  return TEXT_EXTENSIONS.has(ext);
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name);
}

function shouldSkipFile(name: string, relativePosix: string): boolean {
  if (name === "SKILL.md") {
    return true;
  }
  if (name.endsWith(".map")) {
    return true;
  }
  // Arquivos ocultos na raiz ou em subpastas, exceto nomes úteis explícitos.
  if (name.startsWith(".") && name !== ".gitignore" && name !== ".env.example") {
    return true;
  }
  void relativePosix;
  return false;
}

/**
 * Decide se um path relativo (POSIX) deve ser incluído no bundle.
 * Inclui: scripts/**, references/**, assets/** e arquivos soltos na raiz
 * (exceto SKILL.md).
 */
export function isSkillSidecarPath(relativePosix: string): boolean {
  if (!relativePosix || relativePosix === "SKILL.md") {
    return false;
  }
  const parts = relativePosix.split("/");
  const top = parts[0];
  if (parts.length === 1) {
    return top !== "SKILL.md";
  }
  return SIDECAR_DIRS.has(top ?? "");
}

function walkFiles(dir: string, onFile: (absolutePath: string) => void): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue;
      }
      walkFiles(path.join(dir, entry.name), onFile);
      continue;
    }
    if (entry.isFile()) {
      onFile(path.join(dir, entry.name));
    }
  }
}

export function estimateFilesJsonBytes(files: SkillFilesJson): number {
  let total = 0;
  for (const entry of Object.values(files)) {
    total += entry.size;
  }
  return total;
}

export function filesJsonManifest(files: SkillFilesJson): SkillFileManifestEntry[] {
  return Object.entries(files)
    .map(([filePath, entry]) => ({
      path: filePath,
      encoding: entry.encoding,
      size: entry.size,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function normalizeFilesJson(raw: unknown): SkillFilesJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const result: SkillFilesJson = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const encoding = entry.encoding === "base64" ? "base64" : "utf8";
    const content = typeof entry.content === "string" ? entry.content : "";
    const size =
      typeof entry.size === "number" && Number.isFinite(entry.size)
        ? entry.size
        : Buffer.byteLength(content, encoding === "utf8" ? "utf8" : "base64");
    result[key.split(path.sep).join("/")] = { encoding, content, size };
  }
  return result;
}

export function collectSkillSidecarFiles(skillDir: string): {
  files_json: SkillFilesJson;
  warnings: string[];
} {
  const files_json: SkillFilesJson = {};
  const warnings: string[] = [];
  const root = path.resolve(skillDir);
  let totalBytes = 0;

  const candidates: string[] = [];

  // Arquivos soltos na raiz (não SKILL.md).
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      const absolute = path.join(root, entry.name);
      const relative = toPosixRelative(root, absolute);
      if (isSkillSidecarPath(relative) && !shouldSkipFile(entry.name, relative)) {
        candidates.push(absolute);
      }
    }
  }

  // Subpastas scripts/references/assets
  for (const dirName of SIDECAR_DIRS) {
    const sub = path.join(root, dirName);
    walkFiles(sub, (absolute) => {
      const relative = toPosixRelative(root, absolute);
      const base = path.basename(absolute);
      if (!shouldSkipFile(base, relative)) {
        candidates.push(absolute);
      }
    });
  }

  candidates.sort((a, b) => a.localeCompare(b));

  for (const absolute of candidates) {
    const relative = toPosixRelative(root, absolute);
    if (!isSkillSidecarPath(relative)) {
      continue;
    }

    if (Object.keys(files_json).length >= SKILL_FILES_MAX_COUNT) {
      warnings.push(
        `${relative}: skipped (max ${SKILL_FILES_MAX_COUNT} files per skill)`,
      );
      continue;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(absolute);
    } catch {
      warnings.push(`${relative}: skipped (stat failed)`);
      continue;
    }

    if (stat.size > SKILL_FILE_MAX_BYTES) {
      warnings.push(
        `${relative}: skipped (size ${stat.size} > max ${SKILL_FILE_MAX_BYTES})`,
      );
      continue;
    }

    if (totalBytes + stat.size > SKILL_FILES_MAX_TOTAL_BYTES) {
      warnings.push(
        `${relative}: skipped (would exceed total cap ${SKILL_FILES_MAX_TOTAL_BYTES})`,
      );
      continue;
    }

    const encoding: SkillFileEncoding = isTextPath(relative) ? "utf8" : "base64";
    try {
      if (encoding === "utf8") {
        const content = fs.readFileSync(absolute, "utf8");
        files_json[relative] = { encoding, content, size: stat.size };
      } else {
        const content = fs.readFileSync(absolute).toString("base64");
        files_json[relative] = { encoding, content, size: stat.size };
      }
      totalBytes += stat.size;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${relative}: skipped (${message})`);
    }
  }

  return { files_json, warnings };
}

/** Escreve sidecars sob skillDir (overwrite por path). Retorna paths absolutos escritos. */
export function materializeSkillFiles(
  skillDir: string,
  filesJson: SkillFilesJson,
): string[] {
  const written: string[] = [];
  const root = path.resolve(skillDir);
  fs.mkdirSync(root, { recursive: true });

  for (const [relativePosix, entry] of Object.entries(filesJson)) {
    if (!relativePosix || relativePosix.includes("..")) {
      continue;
    }
    const absolute = path.resolve(root, ...relativePosix.split("/"));
    if (!absolute.startsWith(root)) {
      continue;
    }
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    if (entry.encoding === "base64") {
      fs.writeFileSync(absolute, Buffer.from(entry.content, "base64"));
    } else {
      fs.writeFileSync(absolute, entry.content, "utf8");
    }
    written.push(absolute);
  }

  return written;
}
