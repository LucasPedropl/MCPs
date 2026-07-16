import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  SKILL_FILE_MAX_BYTES,
  collectSkillSidecarFiles,
  materializeSkillFiles,
  estimateFilesJsonBytes,
} from "../src/modules/knowledge/skill-files.js";
import { renderSkillForHost, type SkillRecord } from "../src/modules/knowledge/knowledge-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SKILL = path.join(
  __dirname,
  "fixtures",
  "skill-bundle",
  "demo-bundle",
);

describe("skill bundle files_json", () => {
  it("collectSkillSidecarFiles lê references e scripts", () => {
    const { files_json, warnings } = collectSkillSidecarFiles(FIXTURE_SKILL);
    assert.equal(warnings.length, 0);
    assert.ok(files_json["references/note.md"]);
    assert.ok(files_json["scripts/echo.py"]);
    assert.equal(files_json["references/note.md"]?.encoding, "utf8");
    assert.match(files_json["references/note.md"]?.content ?? "", /Sidecar reference/);
    assert.match(files_json["scripts/echo.py"]?.content ?? "", /demo-bundle-ok/);
    assert.ok(estimateFilesJsonBytes(files_json) > 0);
  });

  it("materializeSkillFiles round-trip preserva conteúdo", () => {
    const { files_json } = collectSkillSidecarFiles(FIXTURE_SKILL);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-bundle-"));
    try {
      const written = materializeSkillFiles(tmp, files_json);
      assert.ok(written.length >= 2);
      const notePath = path.join(tmp, "references", "note.md");
      const scriptPath = path.join(tmp, "scripts", "echo.py");
      assert.equal(fs.existsSync(notePath), true);
      assert.equal(fs.existsSync(scriptPath), true);
      assert.match(fs.readFileSync(notePath, "utf8"), /Sidecar reference/);
      assert.match(fs.readFileSync(scriptPath, "utf8"), /demo-bundle-ok/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejeita arquivo acima do cap por arquivo", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-oversize-"));
    try {
      fs.writeFileSync(path.join(tmp, "SKILL.md"), "# x\n");
      const assets = path.join(tmp, "assets");
      fs.mkdirSync(assets);
      const big = path.join(assets, "big.bin");
      fs.writeFileSync(big, Buffer.alloc(SKILL_FILE_MAX_BYTES + 1, 1));
      const { files_json, warnings } = collectSkillSidecarFiles(tmp);
      assert.equal(Object.keys(files_json).length, 0);
      assert.ok(warnings.some((w) => w.includes("assets/big.bin") && w.includes("skipped")));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("renderSkillForHost claude_code não duplica frontmatter existente", () => {
    const skill: SkillRecord = {
      id: "x",
      name: "demo",
      description: "d",
      version: "1.0.0",
      scope: "global",
      content_md: "---\nname: demo\ndescription: d\n---\n\nBody\n",
      files_json: {},
      workspace_path: null,
    };
    const rendered = renderSkillForHost(skill, "claude_code");
    const matches = rendered.match(/^---$/gm) ?? [];
    assert.equal(matches.length, 2);
    assert.ok(!rendered.includes("---\nname: demo\ndescription: d\n---\n\n---"));
  });
});
