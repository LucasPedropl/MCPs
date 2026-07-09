import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServerInstance } from "../services/engine-service.js";

const activeTransports: Record<string, SSEServerTransport> = {};

/** Start Express SSE gateway for remote MCP connections. */
export async function startSseGateway(port = Number(process.env["PORT"] ?? 3001)): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/mcp/:serverId", async (req, res) => {
    const { serverId } = req.params;
    console.error(`[openapi-engine SSE] GET /mcp/${serverId}`);

    try {
      const { mcpServer, serverRecord } = await createMcpServerInstance(serverId);
      const serverName = serverRecord?.name ?? "Welcome Server";
      console.error(`[openapi-engine SSE] Conectando: "${serverName}"`);

      const transport = new SSEServerTransport(`/mcp/${serverId}/message`, res);
      const sessionId = transport.sessionId;
      activeTransports[sessionId] = transport;

      transport.onclose = () => {
        delete activeTransports[sessionId];
      };

      res.on("close", () => {
        delete activeTransports[sessionId];
      });

      await mcpServer.connect(transport);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[openapi-engine SSE] Erro:", message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Falha ao estabelecer conexão SSE", details: message });
      }
    }
  });

  app.post("/mcp/:serverId/message", async (req, res) => {
    const sessionId = req.query["sessionId"] as string;
    if (!sessionId) {
      res.status(400).send("Session ID ausente.");
      return;
    }

    const transport = activeTransports[sessionId];
    if (!transport) {
      res.status(404).send("Sessão MCP não encontrada.");
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[openapi-engine SSE] Erro mensagem ${sessionId}:`, message);
      if (!res.headersSent) {
        res.status(500).send("Erro interno.");
      }
    }
  });

  app.listen(port, () => {
    console.error(`[openapi-engine] SSE gateway na porta ${port}`);
  });
}
