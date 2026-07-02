import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { startMcpEngine, createMcpServerInstance } from './services/mcpEngineService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapa para manter os transportes SSE ativos por ID de sessão
const activeTransports: Record<string, SSEServerTransport> = {};

async function startSseServer() {
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  // Rota SSE para estabelecer o canal de comunicação do MCP
  app.get('/mcp/:serverId', async (req, res) => {
    const { serverId } = req.params;
    console.error(`[MCP SSE] Recebida conexão GET para o servidor: ${serverId}`);

    try {
      // Cria a instância do servidor MCP dinamicamente para o ID solicitado
      const { mcpServer, serverRecord } = await createMcpServerInstance(serverId);
      
      const serverName = serverRecord?.name || 'Welcome Server';
      console.error(`[MCP SSE] Conectando cliente ao servidor: "${serverName}" (${serverId || 'Welcome'})`);

      // Configura o transporte SSE apontando para a rota de recebimento de mensagens
      const transport = new SSEServerTransport(`/mcp/${serverId}/message`, res);
      const sessionId = transport.sessionId;
      activeTransports[sessionId] = transport;

      transport.onclose = () => {
        console.error(`[MCP SSE] Conexão encerrada para a sessão: ${sessionId}`);
        delete activeTransports[sessionId];
      };

      res.on('close', () => {
        console.error(`[MCP SSE] Conexão física fechada pelo cliente (Sessão: ${sessionId})`);
        delete activeTransports[sessionId];
      });

      await mcpServer.connect(transport);
      console.error(`[MCP SSE] Canal SSE estabelecido com sucesso! SessionID: ${sessionId}`);
    } catch (err: any) {
      console.error('[MCP SSE Erro]: Falha ao estabelecer conexão SSE:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Falha ao estabelecer conexão SSE', details: err.message });
      }
    }
  });

  // Rota HTTP POST para receber comandos/mensagens do cliente de IA
  app.post('/mcp/:serverId/message', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).send('Session ID ausente na requisição.');
      return;
    }

    const transport = activeTransports[sessionId];
    if (!transport) {
      res.status(404).send('Sessão MCP não encontrada ou já expirada.');
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (err: any) {
      console.error(`[MCP SSE Erro] Falha ao processar mensagem na sessão ${sessionId}:`, err);
      if (!res.headersSent) {
        res.status(500).send('Erro interno ao processar mensagem.');
      }
    }
  });

  app.listen(PORT, () => {
    console.error(`[MCP Server] Servidor Gateway SSE escutando na porta ${PORT}`);
    console.error(`[MCP Server] Endpoints disponíveis:`);
    console.error(`  - GET  http://localhost:${PORT}/mcp/:serverId       (Canal SSE)`);
    console.error(`  - POST http://localhost:${PORT}/mcp/:serverId/message (Envio de mensagens)`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  // Log de depuração opcional (não bloqueia o boot)
  try {
    const debugPath = path.resolve(__dirname, '../mcp_debug.log');
    fs.writeFileSync(
      debugPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          argv: process.argv,
          env: {
            TARGET_SERVER_ID: process.env.TARGET_SERVER_ID,
            RELOAD_TIMESTAMP: process.env.RELOAD_TIMESTAMP,
          },
        },
        null,
        2,
      ),
    );
  } catch {
    // ignora falha de escrita do log de debug
  }

  let serverId: string | undefined = undefined;

  // Busca argumento --serverId <uuid>
  const idIndex = args.indexOf('--serverId');
  if (idIndex !== -1 && args[idIndex + 1]) {
    serverId = args[idIndex + 1];
  }

  // Fallback para variável de ambiente TARGET_SERVER_ID
  if (!serverId) {
    serverId = process.env.TARGET_SERVER_ID;
  }

  const isSseMode = args.includes('--sse') || args.includes('--gateway');

  // Se não estiver explicitamente no modo SSE, a definição do serverId é obrigatória
  if (!isSseMode && !serverId) {
    console.error('========================================================================');
    console.error('ERRO DE INICIALIZAÇÃO:');
    console.error('O identificador do servidor (--serverId <UUID> ou TARGET_SERVER_ID)');
    console.error('é OBRIGATÓRIO para execução no modo Stdio.');
    console.error('========================================================================');
    process.exit(1);
  }

  if (isSseMode) {
    // Modo SSE Express Gateway (para conexões remotas via URL e Deploy)
    await startSseServer();
  } else {
    // Modo Stdio tradicional (usado por integradores locais como Claude Desktop/Gemini/etc.)
    await startMcpEngine(serverId!);
  }
}

main().catch((err) => {
  console.error('[MCP Fatal Boot Error]:', err);
  process.exit(1);
});
