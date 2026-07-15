/**
 * gather.ts — Repository inspection for the Platform Status Generator.
 *
 * All functions return deterministic, sorted data derived from the
 * repository filesystem and git history. No timestamps, no working-tree
 * dirt, no environment-specific paths are included in the returned
 * snapshot.
 *
 * Parsers (parseTablesFromContent, parseRoutesFromContent,
 * parseModulesFromContent) are exported separately for unit testing.
 */

import { execSync } from "child_process";
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname_local = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname_local, "../../../");

// ── Utility helpers ───────────────────────────────────────────────────────────

export function gitCmd(cmd: string): string {
  try {
    return execSync(`git --no-optional-locks ${cmd}`, {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "(unavailable)";
  }
}

export function readFile(relPath: string): string {
  try {
    return readFileSync(join(ROOT, relPath), "utf8");
  } catch {
    return "";
  }
}

export function readJsonFile(relPath: string): Record<string, unknown> {
  try {
    return JSON.parse(readFile(relPath));
  } catch {
    return {};
  }
}

export function fileSizeKb(relPath: string): number {
  try {
    return Math.round((statSync(join(ROOT, relPath)).size / 1024) * 10) / 10;
  } catch {
    return 0;
  }
}

/** Recursive directory walk with configurable skip list.
 *
 * @param dir Absolute path OR path relative to the workspace ROOT.
 * @param predicate Filter applied to each filename (not the full path).
 * @param skip Directory entry names to exclude at any depth.
 *
 * Returned paths strip the ROOT prefix when dir is under ROOT; otherwise
 * they are returned as absolute paths (useful in tests using tmp dirs).
 */
export function walk(
  dir: string,
  predicate: (filename: string) => boolean,
  skip = [
    "node_modules",
    "dist",
    ".git",
    "attached_assets",
    "generated",
    ".tsbuildinfo",
  ]
): string[] {
  // Accept both absolute paths (e.g. from tests) and root-relative paths.
  const absDir = dir.startsWith("/") ? dir : join(ROOT, dir);
  const stripPrefix = ROOT + "/";
  const results: string[] = [];

  function recurse(d: string) {
    let entries: string[];
    try {
      entries = readdirSync(d).sort();
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.includes(e)) continue;
      const full = join(d, e);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) recurse(full);
      else if (predicate(e)) {
        results.push(full.startsWith(stripPrefix) ? full.slice(stripPrefix.length) : full);
      }
    }
  }

  recurse(absDir);
  return results.sort();
}

function listDir(relPath: string): string[] {
  try {
    return readdirSync(join(ROOT, relPath)).sort();
  } catch {
    return [];
  }
}

function isDir(relPath: string): boolean {
  try {
    return statSync(join(ROOT, relPath)).isDirectory();
  } catch {
    return false;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitInfo {
  branch: string;
  commitHash: string;
  commitShort: string;
  commitDate: string;
  commitMsg: string;
  commitCount: string;
  remoteUrl: string;
}

export interface Package {
  name: string;
  path: string;
  version: string;
  type: string;
}

export interface SchemaFile {
  file: string;
  tables: string[]; // sorted alphabetically
}

export interface Route {
  file: string;
  method: string;
  path: string;
  admin: boolean;
}

export interface KnowledgeAsset {
  id: string;
  title: string;
  partition: string;
  sensitivity: string;
  verificationState: string;
  status: string;
  suppliedToLlm: boolean;
}

export interface KnowledgeFile {
  name: string;
  lines: number;
  sizeKb: number;
}

export interface RegisteredModule {
  id: string;
  title: string;
  status: string; // 'active' | 'coming_soon' | ...
}

export interface CiInfo {
  present: boolean;
  steps: string[];
}

export interface PlatformSnapshot {
  git: GitInfo;
  packages: Package[];
  schemaTables: SchemaFile[];
  routes: Route[];
  testFiles: string[];
  evalFiles: string[];
  knowledgeAssets: KnowledgeAsset[];
  knowledgeFiles: KnowledgeFile[];
  registeredModules: RegisteredModule[];
  componentFiles: string[];
  services: string[];
  ci: CiInfo;
  evalCaseCount: number;
  retrievalPolicyVersion: string;
  // Last-known runtime metrics (from Phase 2 acceptance; updated by record:build-history)
  lastKnownChunks: number;
  lastKnownTestPass: string;
  lastKnownRecall5: string;
  lastKnownTop1: string;
}

// ── Exported parsers (also used in tests) ─────────────────────────────────────

/**
 * Parse Drizzle pgTable declarations from schema file content.
 * Only matches the form:  pgTable("table_name", ...)
 * Returns table names sorted alphabetically.
 */
export function parseTablesFromContent(
  content: string,
  filename: string
): SchemaFile {
  const tables: string[] = [];
  // Match pgTable( preceded by word boundary to avoid matching inside strings
  const re = /\bpgTable\s*\(\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) tables.push(m[1]);
  return { file: filename, tables: tables.sort() };
}

/**
 * Parse Express router method declarations from route file content.
 * Matches:  router.get|post|put|patch|delete("path", ...)
 * Does NOT match router.use (middleware registrations).
 * Returns routes sorted by path then method.
 */
export function parseRoutesFromContent(
  content: string,
  filename: string
): Route[] {
  const routes: Route[] = [];
  const re =
    /\brouter\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`\n]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const path = m[2];
    routes.push({
      file: filename,
      method: m[1].toUpperCase(),
      path,
      admin: path.startsWith("/admin") || path.startsWith("/development"),
    });
  }
  return routes.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );
}

/**
 * Parse module registry from modules.js content.
 * Extracts id, title and status from flat object literals in the MODULES array.
 */
export function parseModulesFromContent(content: string): RegisteredModule[] {
  const modules: RegisteredModule[] = [];
  // Match non-nested object blocks (each module is a flat object)
  const blockRe = /\{[^{}]+\}/gs;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    const block = m[0];
    const id = block.match(/\bid:\s*['"]([^'"]+)['"]/)?.[1];
    if (!id) continue;
    const title = block.match(/\btitle:\s*['"]([^'"]+)['"]/)?.[1] || id;
    const status = block.match(/\bstatus:\s*['"]([^'"]+)['"]/)?.[1] || "unknown";
    modules.push({ id, title, status });
  }
  return modules.sort((a, b) => a.id.localeCompare(b.id));
}

// ── Gatherers ─────────────────────────────────────────────────────────────────

function gatherGit(): GitInfo {
  const rawRemote = gitCmd("remote get-url origin");
  // Strip embedded credentials from URL
  const remoteUrl = rawRemote.replace(/https?:\/\/[^@]+@/, "https://");
  return {
    branch: gitCmd("branch --show-current") || "unknown",
    commitHash: gitCmd("rev-parse HEAD"),
    commitShort: gitCmd("rev-parse --short HEAD"),
    commitDate: gitCmd("log -1 --format=%ai"),
    commitMsg: gitCmd("log -1 --format=%s"),
    commitCount: gitCmd("rev-list --count HEAD"),
    remoteUrl,
  };
  // NOTE: git status (working-tree dirt) is intentionally omitted — it is
  // transient execution state, not governed platform state.
}

function gatherPackages(): Package[] {
  const pkgDefs = [
    { path: "artifacts/rai", type: "frontend" },
    { path: "artifacts/api-server", type: "api-server" },
    { path: "artifacts/mockup-sandbox", type: "dev-tool" },
    { path: "lib/db", type: "shared-library" },
    { path: "scripts", type: "scripts" },
  ];
  return pkgDefs.map((p) => {
    const pkg = readJsonFile(`${p.path}/package.json`);
    return {
      name: String(pkg.name || p.path),
      path: p.path,
      version: String(pkg.version || "0.0.0"),
      type: p.type,
    };
  });
}

function gatherSchemaTables(): SchemaFile[] {
  // Schema files in stable declaration order; tables within each file are sorted.
  const schemaFiles = [
    "lib/db/src/schema/auth.ts",
    "lib/db/src/schema/conversations.ts",
    "lib/db/src/schema/development.ts",
    "lib/db/src/schema/knowledge-chunks.ts",
    "lib/db/src/schema/retrieval-traces.ts",
    "lib/db/src/schema/runtime.ts",
  ];
  return schemaFiles
    .map((f) =>
      parseTablesFromContent(
        readFile(f),
        f.replace("lib/db/src/schema/", "").replace(".ts", "")
      )
    )
    .filter((s) => s.tables.length > 0);
}

function gatherRoutes(): Route[] {
  const routeFiles = [
    "artifacts/api-server/src/routes/admin.ts",
    "artifacts/api-server/src/routes/auth.ts",
    "artifacts/api-server/src/routes/conversations.ts",
    "artifacts/api-server/src/routes/development.ts",
    "artifacts/api-server/src/routes/health.ts",
    "artifacts/api-server/src/routes/logicgate.ts",
    "artifacts/api-server/src/routes/rfp.ts",
  ];
  const all: Route[] = [];
  for (const f of routeFiles) {
    const filename = f.split("/").pop()!.replace(".ts", "");
    all.push(...parseRoutesFromContent(readFile(f), filename));
  }
  // Sort globally by file, then path, then method
  return all.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.path.localeCompare(b.path) ||
      a.method.localeCompare(b.method)
  );
}

function gatherTests(): { testFiles: string[]; evalFiles: string[] } {
  const testFiles = walk(
    ".",
    (n) =>
      n.endsWith(".test.ts") ||
      n.endsWith(".test.mjs") ||
      n.endsWith(".spec.ts"),
    // Extend skip list: also skip evaluation fixtures, attached assets,
    // generated artefacts and build outputs
    [
      "node_modules",
      "dist",
      ".git",
      "attached_assets",
      "generated",
      "evaluation",
      ".tsbuildinfo",
    ]
  );
  const evalFiles = walk("evaluation", (n) => n.endsWith(".json"), [
    "node_modules",
    "dist",
  ]);
  return { testFiles, evalFiles };
}

function gatherKnowledge(): {
  assets: KnowledgeAsset[];
  knowledgeFiles: KnowledgeFile[];
  retrievalPolicyVersion: string;
} {
  // Parse assets from the governed manifest (authoritative source)
  const manifestContent = readFile(
    "artifacts/api-server/src/lib/knowledge-manifest.ts"
  );
  const blocks = manifestContent.split(/(?=\bid:\s*["'])/);
  const assets: KnowledgeAsset[] = [];
  for (const b of blocks) {
    const id = b.match(/id:\s*["']([^"']+)["']/)?.[1];
    if (!id) continue;
    assets.push({
      id,
      title: b.match(/title:\s*["']([^"']+)["']/)?.[1] || id,
      partition: b.match(/partition:\s*["']([^"']+)["']/)?.[1] || "neutral",
      sensitivity: b.match(/sensitivity:\s*["']([^"']+)["']/)?.[1] || "internal",
      verificationState:
        b.match(/verificationState:\s*["']([^"']+)["']/)?.[1] || "draft",
      status: b.match(/status:\s*["']([^"']+)["']/)?.[1] || "active",
      suppliedToLlm:
        b.match(/suppliedToLlm:\s*(true|false)/)?.[1] === "true",
    });
  }

  // Physical knowledge files — sorted by name
  const knowledgeFiles = listDir("knowledge")
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      name: f,
      lines: readFile(`knowledge/${f}`).split("\n").length,
      sizeKb: fileSizeKb(`knowledge/${f}`),
    }));

  const retrievalPolicyVersion =
    readFile("artifacts/api-server/src/config/retrieval-policy.ts").match(
      /RETRIEVAL_POLICY_VERSION\s*=\s*["']([^"']+)["']/
    )?.[1] || "Unable to verify";

  return {
    assets: assets.sort((a, b) => a.id.localeCompare(b.id)),
    knowledgeFiles,
    retrievalPolicyVersion,
  };
}

function gatherModuleRegistry(): RegisteredModule[] {
  const content = readFile("artifacts/rai/src/config/modules.js");
  if (!content) return [];
  return parseModulesFromContent(content);
}

function gatherFrontend(): { componentFiles: string[] } {
  const componentFiles = listDir("artifacts/rai/src/components")
    .filter((f) => f.endsWith(".jsx") || f.endsWith(".tsx"))
    .sort();
  return { componentFiles };
}

function gatherServices(): string[] {
  return listDir("artifacts/api-server/src/services")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();
}

function gatherCI(): CiInfo {
  const ciContent = readFile(".github/workflows/ci.yml");
  const steps =
    ciContent
      .match(/- name: (.+)/g)
      ?.map((s) => s.replace("- name: ", "").trim()) || [];
  return { present: ciContent.length > 0, steps };
}

function gatherEvalCaseCount(): number {
  try {
    const raw = readFile("evaluation/retrieval-evaluation-v1.json");
    return JSON.parse(raw).cases?.length || 0;
  } catch {
    return 0;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function gatherSnapshot(): PlatformSnapshot {
  const { assets, knowledgeFiles, retrievalPolicyVersion } = gatherKnowledge();
  const { testFiles, evalFiles } = gatherTests();
  const { componentFiles } = gatherFrontend();

  return {
    git: gatherGit(),
    packages: gatherPackages(),
    schemaTables: gatherSchemaTables(),
    routes: gatherRoutes(),
    testFiles,
    evalFiles,
    knowledgeAssets: assets,
    knowledgeFiles,
    registeredModules: gatherModuleRegistry(),
    componentFiles,
    services: gatherServices(),
    ci: gatherCI(),
    evalCaseCount: gatherEvalCaseCount(),
    retrievalPolicyVersion,
    // Last-known runtime metrics from Phase 2 acceptance validation.
    // These are updated by running record:build-history after a new evaluation.
    lastKnownChunks: 186,
    lastKnownTestPass: "19/19",
    lastKnownRecall5: "100.0%",
    lastKnownTop1: "77.4%",
  };
}
