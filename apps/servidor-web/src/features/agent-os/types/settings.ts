export interface SettingFlag {
  key: string;
  value: boolean;
  description: string;
}

export interface SettingsData {
  configured: boolean;
  supabase: { url: string | null; serviceRoleKey: string | null; anonKey: string | null };
  env: Record<string, boolean>;
  hubCount: number;
  flags: SettingFlag[];
  configPaths?: { cursor: string; antigravity: string };
  mcpSnippet: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
  antigravitySnippet?: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
}
