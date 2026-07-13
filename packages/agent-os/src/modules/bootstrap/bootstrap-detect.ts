import * as fs from "node:fs";
import * as path from "node:path";
import picomatch from "picomatch";

const DEP_MAP = {
  next: "next",
  react: "react",
  typescript: "typescript",
  tailwind: "tailwindcss",
  supabase: "@supabase/supabase-js",
  zod: "zod",
} as const;

function readPackageJson(workspacePath: string): Record<string, unknown> | null {
  const pkgPath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listChildPackageDirs(parentDir: string): string[] {
  if (!fs.existsSync(parentDir)) {
    return [];
  }

  return fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name))
    .filter((childPath) => fs.existsSync(path.join(childPath, "package.json")));
}

function expandWorkspaceGlobs(root: string, patterns: string[]): string[] {
  const resolved = new Set<string>();

  for (const pattern of patterns) {
    const normalized = pattern.replace(/\\/g, "/");
    if (!normalized.includes("*")) {
      const candidate = path.resolve(root, normalized);
      if (fs.existsSync(path.join(candidate, "package.json"))) {
        resolved.add(candidate);
      }
      continue;
    }

    const [parentPattern] = normalized.split("*");
    const parentDir = path.resolve(root, parentPattern.replace(/\/$/, ""));
    if (!fs.existsSync(parentDir)) {
      continue;
    }

    const matcher = picomatch(normalized, { dot: false });
    for (const childPath of listChildPackageDirs(parentDir)) {
      const relative = path.relative(root, childPath).replace(/\\/g, "/");
      if (matcher(relative)) {
        resolved.add(childPath);
      }
    }
  }

  return [...resolved];
}

/** Coleta paths de package.json em workspaces npm (root + filhos). */
export function collectWorkspacePackagePaths(root: string): string[] {
  const resolvedRoot = path.resolve(root);
  const paths = new Set<string>([resolvedRoot]);
  const rootPkg = readPackageJson(resolvedRoot);

  const workspacePatterns = Array.isArray(rootPkg?.workspaces)
    ? (rootPkg.workspaces as string[])
    : [];

  for (const childPath of expandWorkspaceGlobs(resolvedRoot, workspacePatterns)) {
    paths.add(childPath);
  }

  for (const fallbackDir of ["packages", "apps"]) {
    for (const childPath of listChildPackageDirs(path.join(resolvedRoot, fallbackDir))) {
      paths.add(childPath);
    }
  }

  return [...paths];
}

function mergeDependencies(packagePaths: string[]): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const packagePath of packagePaths) {
    const pkg = readPackageJson(packagePath);
    const deps = {
      ...(pkg?.dependencies as Record<string, string> | undefined),
      ...(pkg?.devDependencies as Record<string, string> | undefined),
    };

    for (const [name, version] of Object.entries(deps)) {
      merged[name] = version;
    }
  }

  return merged;
}

function isMonorepo(workspacePath: string, rootPkg: Record<string, unknown> | null): boolean {
  const workspaces = rootPkg?.workspaces;
  if (Array.isArray(workspaces) && workspaces.length > 0) {
    return true;
  }

  return (
    fs.existsSync(path.join(workspacePath, "packages")) ||
    fs.existsSync(path.join(workspacePath, "apps")) ||
    fs.existsSync(path.join(workspacePath, "pnpm-workspace.yaml"))
  );
}

/** Detecta stack agregando dependências de todos os workspaces. */
export function detectStack(workspacePath: string): Record<string, unknown> {
  const resolved = path.resolve(workspacePath);
  const packagePaths = collectWorkspacePackagePaths(resolved);
  const deps = mergeDependencies(packagePaths);
  const rootPkg = readPackageJson(resolved);
  const hasDep = (name: string): boolean => Boolean(deps[name]);

  const byWorkspace: Record<string, Record<string, boolean>> = {};
  for (const packagePath of packagePaths) {
    const relative = path.relative(resolved, packagePath) || ".";
    const pkg = readPackageJson(packagePath);
    const localDeps = {
      ...(pkg?.dependencies as Record<string, string> | undefined),
      ...(pkg?.devDependencies as Record<string, string> | undefined),
    };
    byWorkspace[relative] = {
      next: Boolean(localDeps.next),
      react: Boolean(localDeps.react),
      typescript: Boolean(localDeps.typescript),
      tailwind: Boolean(localDeps.tailwindcss),
      supabase: Boolean(localDeps["@supabase/supabase-js"]),
      zod: Boolean(localDeps.zod),
    };
  }

  return {
    hasPackageJson: rootPkg !== null,
    next: hasDep(DEP_MAP.next),
    react: hasDep(DEP_MAP.react),
    typescript: hasDep(DEP_MAP.typescript),
    tailwind: hasDep(DEP_MAP.tailwind),
    supabase: hasDep(DEP_MAP.supabase),
    zod: hasDep(DEP_MAP.zod),
    monorepo: isMonorepo(resolved, rootPkg),
    workspaces_scanned: packagePaths.map((p) => path.relative(resolved, p) || "."),
    by_workspace: byWorkspace,
    markers: {
      git: fs.existsSync(path.join(resolved, ".git")),
      cursor: fs.existsSync(path.join(resolved, ".cursor")),
    },
  };
}
