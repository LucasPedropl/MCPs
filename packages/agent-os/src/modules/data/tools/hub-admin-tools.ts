import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addAccount,
  getAccountPat,
  loadConfig,
  registerAllKeepAlive,
  registerKeepAlive,
  removeAccount,
  syncAllProjects,
  syncProjectsForAccount,
  updateHubSettings,
} from "../features/accounts/services/account-store.js";
import {
  createProject,
  listOrganizations,
  restoreProject,
  testPat,
} from "../features/accounts/services/management-api.js";
import {
  ensureKeepAliveRegistered,
  pingAllProjects,
} from "../features/projects/services/keepalive-service.js";
import { importFromLegacySupabase } from "../features/accounts/services/legacy-import.js";
import { describeAgentTool } from "../../../tools/tool-docs.js";
import { errorText, jsonText } from "./hub-tools-core.js";
import { buildKeepAliveStatusPayload, sanitizeKeepAliveEntry } from "../hub-sanitize.js";

type HubAdminArgs = {
  action:
    | "add_account"
    | "remove_account"
    | "test_account"
    | "sync_projects"
    | "list_organizations"
    | "create_project"
    | "restore_project"
    | "update_settings"
    | "import_legacy";
  accountId?: string;
  label?: string;
  pat?: string;
  email?: string;
  projectRef?: string;
  name?: string;
  organizationSlug?: string;
  dbPass?: string;
  regionCode?: string;
  readOnly?: boolean;
  keepAliveCron?: string;
};

async function handleHubAdmin(args: HubAdminArgs) {
  switch (args.action) {
    case "add_account": {
      if (!args.label || !args.pat) {
        return errorText("action=add_account exige 'label' e 'pat'.");
      }
      const account = await addAccount({
        label: args.label,
        pat: args.pat,
        email: args.email,
      });
      return jsonText({ success: true, account });
    }
    case "remove_account": {
      if (!args.accountId) return errorText("action=remove_account exige 'accountId'.");
      await removeAccount(args.accountId);
      return jsonText({ success: true, accountId: args.accountId });
    }
    case "test_account": {
      if (!args.accountId) return errorText("action=test_account exige 'accountId'.");
      const pat = await getAccountPat(args.accountId);
      return jsonText({ accountId: args.accountId, valid: await testPat(pat) });
    }
    case "sync_projects": {
      const projects = args.accountId
        ? await syncProjectsForAccount(args.accountId)
        : await syncAllProjects();
      await ensureKeepAliveRegistered();
      return jsonText({ success: true, count: projects.length, projects });
    }
    case "list_organizations": {
      if (!args.accountId) return errorText("action=list_organizations exige 'accountId'.");
      const pat = await getAccountPat(args.accountId);
      return jsonText({
        accountId: args.accountId,
        organizations: await listOrganizations(pat),
      });
    }
    case "create_project": {
      if (!args.accountId || !args.name || !args.organizationSlug || !args.dbPass) {
        return errorText(
          "action=create_project exige 'accountId', 'name', 'organizationSlug' e 'dbPass'.",
        );
      }
      const pat = await getAccountPat(args.accountId);
      const created = await createProject(pat, {
        name: args.name,
        organizationSlug: args.organizationSlug,
        dbPass: args.dbPass,
        regionCode: args.regionCode ?? "americas",
      });
      await syncProjectsForAccount(args.accountId);
      await registerKeepAlive(args.accountId, created.ref);
      return jsonText({ success: true, project: created });
    }
    case "restore_project": {
      if (!args.accountId || !args.projectRef) {
        return errorText("action=restore_project exige 'accountId' e 'projectRef'.");
      }
      const pat = await getAccountPat(args.accountId);
      await restoreProject(pat, args.projectRef);
      return jsonText({ success: true, projectRef: args.projectRef });
    }
    case "update_settings": {
      const settings = await updateHubSettings({
        readOnly: args.readOnly,
        keepAliveCron: args.keepAliveCron,
      });
      return jsonText({ success: true, settings });
    }
    case "import_legacy": {
      const result = await importFromLegacySupabase({
        pat: args.pat,
        label: args.label ?? "default",
        projectRef: args.projectRef,
      });
      return jsonText({ success: true, ...result });
    }
  }
}

type KeepaliveArgs = {
  action: "register" | "register_all" | "ping_all" | "status";
  accountId?: string;
  projectRef?: string;
};

async function handleKeepalive(args: KeepaliveArgs) {
  switch (args.action) {
    case "register": {
      if (!args.accountId || !args.projectRef) {
        return errorText("action=register exige 'accountId' e 'projectRef'.");
      }
      const entry = await registerKeepAlive(args.accountId, args.projectRef);
      return jsonText({ success: true, entry: sanitizeKeepAliveEntry(entry) });
    }
    case "register_all": {
      const entries = await registerAllKeepAlive();
      return jsonText({
        success: true,
        count: entries.length,
        entries: entries.map(sanitizeKeepAliveEntry),
      });
    }
    case "ping_all": {
      const results = await pingAllProjects();
      return jsonText({ success: true, results });
    }
    case "status": {
      const config = await loadConfig();
      return jsonText(buildKeepAliveStatusPayload(config.keepAlive));
    }
  }
}

export function registerHubAdminTools(server: McpServer): void {
  server.registerTool(
    "hub_admin",
    {
      description: describeAgentTool("hub_admin"),
      inputSchema: {
        action: z.enum([
          "add_account",
          "remove_account",
          "test_account",
          "sync_projects",
          "list_organizations",
          "create_project",
          "restore_project",
          "update_settings",
          "import_legacy",
        ]),
        accountId: z.string().uuid().optional(),
        label: z.string().optional(),
        pat: z.string().optional(),
        email: z.string().email().optional(),
        projectRef: z.string().optional(),
        name: z.string().optional(),
        organizationSlug: z.string().optional(),
        dbPass: z.string().optional(),
        regionCode: z.string().optional(),
        readOnly: z.boolean().optional(),
        keepAliveCron: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return await handleHubAdmin(args as HubAdminArgs);
      } catch (error) {
        return errorText(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "keepalive",
    {
      description: describeAgentTool("keepalive"),
      inputSchema: {
        action: z.enum(["register", "register_all", "ping_all", "status"]),
        accountId: z.string().uuid().optional(),
        projectRef: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return await handleKeepalive(args as KeepaliveArgs);
      } catch (error) {
        return errorText(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
