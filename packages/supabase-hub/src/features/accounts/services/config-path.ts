import { homedir } from "node:os";
import { join } from "node:path";

export function getConfigPath(): string {
  const custom = process.env["SUPABASE_HUB_CONFIG_DIR"];
  if (custom) {
    return join(custom, "config.json");
  }
  return join(homedir(), ".supabase-mcp-hub", "config.json");
}
