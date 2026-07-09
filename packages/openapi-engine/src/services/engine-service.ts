import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  getServerById,
  getToolsByServerId,
  getCategoriesByServerId,
  getFirstServer,
  getLatestSyncReport,
  getSyncReports,
  getLatestPlaybook,
  savePlaybookVersion,
  createCategory,
  updateCategory,
  deleteCategory,
  updateToolConfig,
  saveTestCase,
  deleteTestCase,
  getTestCases,
  getTestCaseByName,
  saveTestRun,
  getTestRuns
} from "../repositories/mcp-repository.js";
import type {
  ServerRecord,
  ToolRecord,
  CategoryRecord,
  TestCaseRecord,
  TestRunRecord,
} from "../repositories/mcp-repository.js";
import { executeGenericMcpProxy } from "./proxy-service.js";
import { runOpenApiSync } from "./sync-service.js";
import { runTestCase, generateRandomCPF, generateRandomCNPJ, generateRandomEmail, generateRandomName, generateRandomPhone, generateRandomUUID } from "./qa-runner.js";
import { z } from 'zod';

export async function createMcpServerInstance(targetServerId?: string): Promise<{ mcpServer: McpServer; serverRecord: ServerRecord | null }> {
  let serverRecord: ServerRecord | null = null;

  if (targetServerId) {
    serverRecord = await getServerById(targetServerId);
  } else {
    serverRecord = null;
  }

  if (!serverRecord) {
    const mcp = new McpServer({
      name: 'MCP_Generator_Welcome_Server',
      version: '1.0.0',
    });

    mcp.tool(
      'verificar_status_mcp',
      'Retorna o status atual do gerador MCP e instrucoes de como conectar uma API OpenAPI/Swagger',
      {},
      async () => {
        return {
          content: [
            {
              type: 'text',
              text: 'Nenhum servidor OpenAPI conectado ainda. Acesse o painel web em http://localhost:3000, insira a URL do seu arquivo swagger.json e clique em "Salvar Servidor MCP". Em seguida, reinicie o MCP Core.',
            },
          ],
        };
      }
    );

    return { mcpServer: mcp, serverRecord: null };
  }

  const mcp = new McpServer({
    name: serverRecord.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64) || 'MCP_Server',
    version: '1.0.0',
  });

  // Ferramenta 0.5: Listar Categorias Cadastradas
  mcp.tool(
    'listar_categorias_api',
    `Retorna a lista de todas as categorias cadastradas na API do ${serverRecord.name}, incluindo instruções/prompts personalizados. Use esta ferramenta para descobrir quais módulos existem.`,
    {},
    async () => {
      console.error(`[MCP Tool Executada] IA chamou "listar_categorias_api"`);
      const categories = await getCategoriesByServerId(serverRecord!.id);
      if (categories.length === 0) {
        return {
          content: [{ type: 'text', text: 'Nenhuma categoria cadastrada para este servidor.' }]
        };
      }
      const listagem = categories.map(c => `Nome: ${c.name}${c.custom_prompt ? `\nInstruções: ${c.custom_prompt}` : ''}\n-----------------------------------------`).join('\n\n');
      return {
        content: [{ type: 'text', text: `Categorias cadastradas:\n\n${listagem}` }]
      };
    }
  );

  // Ferramenta 1: Listar Rotas Resumidas (Visão de Catálogo Limpo com Filtros por Nome)
  mcp.tool(
    'listar_rotas_resumidas',
    `Retorna o catálogo de rotas da API do ${serverRecord.name}, organizado por categorias, com suporte a filtros opcionais de método HTTP e nome de categoria para economizar tokens.`,
    {
      category: z.string().optional().describe('Nome da categoria para filtrar as rotas (ex: Administrador ou WhatsApps)'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('Filtrar pelo verbo HTTP específico (ex: GET ou POST)')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "listar_rotas_resumidas" com args:`, JSON.stringify(args));
      
      let tools = await getToolsByServerId(serverRecord!.id);
      const categories = await getCategoriesByServerId(serverRecord!.id);

      // Aplicar filtros
      if (args.method) {
        tools = tools.filter(t => t.http_method.toUpperCase() === args.method!.toUpperCase());
      }
      
      let matchedCategory: CategoryRecord | undefined = undefined;
      if (args.category) {
        matchedCategory = categories.find(cat => cat.name.toLowerCase() === args.category!.toLowerCase());
        if (matchedCategory) {
          tools = tools.filter(t => t.category_id === matchedCategory!.id);
        } else if (args.category.toLowerCase() === 'outros' || args.category.toLowerCase() === 'none') {
          tools = tools.filter(t => !t.category_id);
        } else {
          tools = [];
        }
      }

      const catMap = new Map<string, CategoryRecord>();
      for (const cat of categories) {
        catMap.set(cat.id, cat);
      }

      const grupos = new Map<string, ToolRecord[]>();
      const semCategoria: ToolRecord[] = [];

      for (const t of tools) {
        if (t.category_id && catMap.has(t.category_id)) {
          const list = grupos.get(t.category_id) || [];
          list.push(t);
          grupos.set(t.category_id, list);
        } else {
          semCategoria.push(t);
        }
      }

      let sumario = `Catálogo Resumido da API - Total de rotas filtradas: ${tools.length}\n\n`;

      for (const cat of categories) {
        if (args.category && cat.id !== matchedCategory?.id) continue;
        const catTools = grupos.get(cat.id) || [];
        if (catTools.length === 0) continue;

        sumario += `=========================================\n`;
        sumario += `📂 CATEGORIA: ${cat.name}\n`;
        if (cat.custom_prompt) {
          sumario += `📝 INSTRUÇÕES DA CATEGORIA: ${cat.custom_prompt}\n`;
        }
        sumario += `=========================================\n\n`;

        const rotas = catTools.map(t => {
          return `[${t.http_method.toUpperCase()}] ${t.endpoint_path} - ${t.custom_description || 'Sem descrição'}`;
        });

        sumario += rotas.join('\n') + `\n\n\n`;
      }

      if (semCategoria.length > 0 && (!args.category || args.category.toLowerCase() === 'outros' || args.category.toLowerCase() === 'none')) {
        sumario += `=========================================\n`;
        sumario += `📂 CATEGORIA: Outros / Não Categorizados\n`;
        sumario += `=========================================\n\n`;

        const rotas = semCategoria.map(t => {
          return `[${t.http_method.toUpperCase()}] ${t.endpoint_path} - ${t.custom_description || 'Sem descrição'}`;
        });

        sumario += rotas.join('\n') + `\n\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: sumario,
          },
        ],
      };
    }
  );

  // Ferramenta 1.5: Detalhar Endpoint Específico (Inspeção Profunda)
  mcp.tool(
    'detalhar_endpoint_api',
    `Retorna o contrato detalhado (JSON Schema, campos obrigatórios, contentType e parâmetros) de um endpoint específico da API do ${serverRecord.name}. Use isso após escolher a rota no listar_rotas_resumidas para saber exatamente quais campos enviar no chamar_api_dinamica.`,
    {
      endpoint: z.string().describe('O caminho exato ou base do endpoint para inspecionar. Ex: /api/v1/Plano ou /api/v1/Empresa'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('O verbo HTTP do endpoint.')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "detalhar_endpoint_api" para [${args.method}] ${args.endpoint}`);
      const tools = await getToolsByServerId(serverRecord!.id);
      
      // Busca flexível: tenta match exato ou parcial (ignorando chaves de path se necessário)
      const cleanTarget = args.endpoint.replace(/\{[^}]+\}/g, '').replace(/\/+$/, '');
      const matched = tools.find(t => {
        if (t.http_method.toUpperCase() !== args.method.toUpperCase()) return false;
        if (t.endpoint_path === args.endpoint) return true;
        const cleanPath = t.endpoint_path.replace(/\{[^}]+\}/g, '').replace(/\/+$/, '');
        return cleanPath === cleanTarget || t.endpoint_path.includes(cleanTarget) || cleanTarget.includes(cleanPath);
      });

      if (!matched) {
        const rotasDoMetodo = tools.filter(t => t.http_method.toUpperCase() === args.method.toUpperCase()).map(t => t.endpoint_path);
        return {
          content: [{
            type: 'text',
            text: `Endpoint "[${args.method}] ${args.endpoint}" não encontrado.\nRotas disponíveis para o método ${args.method}:\n${rotasDoMetodo.join('\n')}`
          }]
        };
      }

      const detalhes = `Detalhes do Endpoint: [${matched.http_method.toUpperCase()}] ${matched.endpoint_path}\n` +
        `Descrição: ${matched.custom_description || 'Sem descrição'}\n` +
        `ContentType Esperado: ${matched.parameters_schema?.contentType || 'application/json'}\n\n` +
        `Schema de Parâmetros e Body:\n${JSON.stringify(matched.parameters_schema || {}, null, 2)}`;

      return {
        content: [{ type: 'text', text: detalhes }]
      };
    }
  );

  // Ferramenta 2: Chamar API Genérica
  mcp.tool(
    'chamar_api_dinamica',
    `Executa uma requisição HTTP dinâmica contra a API do ${serverRecord.name}. Use a rota exata descoberta no listar_rotas_resumidas e inspecionada no detalhar_endpoint_api. Você DEVE substituir os parâmetros de rota na string (ex: altere /users/{id} para /users/123).`,
    {
      endpoint: z.string().describe('O caminho do endpoint para chamar. Ex: /api/v1/Assinatura ou /api/v1/Empresa/123'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('O verbo HTTP para a requisição.'),
      body: z.record(z.string(), z.any()).optional().describe('Um objeto JSON contendo o payload do body, se aplicável.'),
      queryParams: z.record(z.string(), z.any()).optional().describe('Um objeto JSON contendo os parâmetros de query string, se aplicável.'),
      authProfileId: z.string().optional().describe('ID opcional de perfil de autenticação para forçar o uso de um token específico.')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "chamar_api_dinamica" com args:`, JSON.stringify(args));
      const freshServer = await getServerById(serverRecord!.id);
      return await executeGenericMcpProxy(freshServer, args.endpoint, args.method, args.body, args.queryParams, false, args.authProfileId);
    }
  );

  // Ferramenta 3: Sincronizar Endpoints (Swagger Sync Autônomo)
  mcp.tool(
    'sincronizar_endpoints_api',
    `Sincroniza a lista de endpoints da API com a última versão do Swagger/OpenAPI do ${serverRecord.name}, cadastrando novas rotas e gerando um relatório de mudanças (Changelog). Use isso para atualizar a API de forma autônoma.`,
    {},
    async () => {
      console.error(`[MCP Tool Executada] IA chamou "sincronizar_endpoints_api"`);
      try {
        const report = await runOpenApiSync(serverRecord!.id);
        return {
          content: [{ type: 'text', text: report }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao sincronizar API: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 4: Consultar Relatório de Sincronização
  mcp.tool(
    'consultar_relatorio_sincronizacao',
    `Consulta os relatórios de sincronização (Changelog) da API do ${serverRecord.name} para entender quais rotas foram adicionadas, modificadas ou removidas. Por padrão retorna o mais recente, mas você pode especificar o parâmetro 'limit' para ver o histórico dos últimos N relatórios.`,
    {
      limit: z.number().optional().describe('Número de relatórios antigos para buscar (padrão: 1, máximo: 10).')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "consultar_relatorio_sincronizacao" com args:`, JSON.stringify(args));
      try {
        const count = args.limit ? Math.min(args.limit, 10) : 1;
        const reports = await getSyncReports(serverRecord!.id, count);
        
        if (reports.length === 0) {
          return {
            content: [{ type: 'text', text: 'Nenhum relatório de sincronização encontrado para este servidor ainda.' }]
          };
        }

        if (reports.length === 1) {
          return {
            content: [{ type: 'text', text: reports[0]!.report_summary }]
          };
        }

        let fullText = `=== HISTÓRICO DOS ÚLTIMOS ${reports.length} RELATÓRIOS DE SINCRONIZAÇÃO ===\n\n`;
        reports.forEach((rep, idx) => {
          fullText += `[Relatório #${idx + 1} - Gerado em: ${new Date(rep.created_at).toLocaleString()}]\n`;
          fullText += `${rep.report_summary}\n`;
          fullText += `===================================================================\n\n`;
        });

        return {
          content: [{ type: 'text', text: fullText }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao consultar relatórios: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 5: Listar Perfis de Autenticação
  mcp.tool(
    'listar_perfis_autenticacao',
    `Retorna todos os perfis de autenticação cadastrados no servidor (nome e ID). Use para saber quais IDs de perfis você pode forçar/configurar nos endpoints.`,
    {},
    async () => {
      console.error(`[MCP Tool Executada] IA chamou "listar_perfis_autenticacao"`);
      const creds = serverRecord.auth_credentials;
      const profiles = creds?.profiles && Array.isArray(creds.profiles) ? creds.profiles : [];
      if (profiles.length === 0) {
        return {
          content: [{ type: 'text', text: 'Nenhum perfil de autenticação configurado para este servidor.' }]
        };
      }
      const listagem = profiles.map((p: any) => `Nome: ${p.name}\nID: ${p.id}\n-----------------------------------------`).join('\n\n');
      return {
        content: [{ type: 'text', text: `Perfis de autenticação disponíveis:\n\n${listagem}` }]
      };
    }
  );

  // Ferramenta 6: Configurar Categoria
  mcp.tool(
    'configurar_mcp_categoria',
    `Permite criar, atualizar ou deletar categorias de ferramentas no servidor MCP.`,
    {
      action: z.enum(['create', 'update', 'delete']).describe('Ação a ser executada'),
      categoryId: z.string().optional().describe('ID da categoria (obrigatório para update e delete)'),
      name: z.string().optional().describe('Nome da categoria (obrigatório para create, opcional para update)'),
      customPrompt: z.string().optional().describe('Prompt/instruções personalizadas para a categoria')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "configurar_mcp_categoria" com args:`, JSON.stringify(args));
      try {
        if (args.action === 'create') {
          if (!args.name) {
            throw new Error('O parâmetro "name" é obrigatório para a criação de categorias.');
          }
          const cat = await createCategory(serverRecord!.id, args.name, args.customPrompt);
          return {
            content: [{ type: 'text', text: `Categoria "${cat.name}" criada com sucesso! ID: ${cat.id}` }]
          };
        }

        if (args.action === 'update') {
          if (!args.categoryId) {
            throw new Error('O parâmetro "categoryId" é obrigatório para a atualização.');
          }
          const updates: { name?: string; custom_prompt?: string | null } = {};
          if (args.name !== undefined) updates.name = args.name;
          if (args.customPrompt !== undefined) updates.custom_prompt = args.customPrompt ?? null;
          
          const cat = await updateCategory(args.categoryId, updates);
          return {
            content: [{ type: 'text', text: `Categoria "${cat.name}" (ID: ${cat.id}) atualizada com sucesso!` }]
          };
        }

        if (args.action === 'delete') {
          if (!args.categoryId) {
            throw new Error('O parâmetro "categoryId" é obrigatório para a exclusão.');
          }
          await deleteCategory(args.categoryId);
          return {
            content: [{ type: 'text', text: `Categoria (ID: ${args.categoryId}) removida com sucesso!` }]
          };
        }

        throw new Error('Ação inválida.');
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 7: Configurar Endpoint
  mcp.tool(
    'configurar_mcp_endpoint',
    `Permite atualizar o prompt/descrição, categorias associadas (múltiplas) e perfil de autenticação padrão de um endpoint específico.`,
    {
      endpoint: z.string().describe('O caminho do endpoint (ex: /api/v1/User)'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('O método HTTP do endpoint'),
      customName: z.string().optional().describe('Novo nome amigável para a ferramenta'),
      customDescription: z.string().optional().describe('Novo prompt/descrição explicativa para a ferramenta'),
      categoryIds: z.array(z.string()).optional().describe('Array com os IDs de categorias às quais associar o endpoint. Mande array vazio para desassociar tudo.'),
      authProfileId: z.string().optional().describe('ID do perfil de autenticação necessário para o endpoint (ou "none" para público)'),
      contentType: z.string().optional().describe('Content-Type esperado pelo endpoint (ex: application/json, multipart/form-data, application/x-www-form-urlencoded)')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "configurar_mcp_endpoint" com args:`, JSON.stringify(args));
      try {
        const tools = await getToolsByServerId(serverRecord!.id);
        const matched = tools.find(t => t.endpoint_path === args.endpoint && t.http_method.toUpperCase() === args.method.toUpperCase());
        if (!matched) {
          throw new Error(`Endpoint [${args.method}] ${args.endpoint} não encontrado neste servidor.`);
        }

        const updates: any = {};
        if (args.customName !== undefined) updates.custom_name = args.customName;
        if (args.customDescription !== undefined) updates.custom_description = args.customDescription;
        if (args.contentType !== undefined) updates.contentType = args.contentType;
        
        if (args.categoryIds !== undefined) {
          updates.category_ids = args.categoryIds;
          updates.category_id = args.categoryIds.length > 0 ? args.categoryIds[0] : null;
        }

        if (args.authProfileId !== undefined) {
          updates.authRequirement = args.authProfileId === 'none' ? 'none' : [args.authProfileId];
        }

        await updateToolConfig(matched.id, updates);
        return {
          content: [{ type: 'text', text: `Endpoint [${args.method}] ${args.endpoint} configurado com sucesso!` }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 8: Chamar Endpoints em Lote
  mcp.tool(
    'chamar_endpoints_lote',
    `Executa uma lista de requisições HTTP de forma sequencial ou paralela (com concorrência limitada) permitindo a passagem inteligente de variáveis de respostas anteriores via sintaxe {{requestId}} ou {{requestId.data.campo}}.`,
    {
      requests: z.array(z.object({
        requestId: z.string().describe('ID único para identificar este passo no fluxo (ex: criar_cliente)'),
        endpoint: z.string().describe('Caminho da API (ex: /api/v1/User)'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('Método HTTP'),
        body: z.record(z.string(), z.any()).optional().describe('Corpo da requisição'),
        queryParams: z.record(z.string(), z.any()).optional().describe('Query params'),
        authProfileId: z.string().optional().describe('ID opcional de perfil de autenticação para forçar')
      })).describe('Lista de requisições do lote'),
      stopOnError: z.boolean().optional().describe('Interromper todo o lote caso alguma requisição retorne erro (padrão: true)'),
      maxConcurrency: z.number().optional().describe('Concorrência máxima para processamento paralelo (padrão: 3). Caso use referências {{requestId}}, o lote rodará em concorrência 1 (sequencial) automaticamente.')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "chamar_endpoints_lote" com ${args.requests.length} requisições`);
      const stopOnError = args.stopOnError !== false;
      let maxConcurrency = args.maxConcurrency || 3;

      // Se houver qualquer referência a outro requestId no body, endpoint ou queryParams, força concorrência = 1 (sequencial)
      const hasDependencies = args.requests.some((req) => {
        const strBody = req.body ? JSON.stringify(req.body) : '';
        const strQuery = req.queryParams ? JSON.stringify(req.queryParams) : '';
        const hasDep = /\{\{([^}]+)\}\}/.test(req.endpoint) || /\{\{([^}]+)\}\}/.test(strBody) || /\{\{([^}]+)\}\}/.test(strQuery);
        return hasDep;
      });

      if (hasDependencies) {
        console.error(`[MCP Lote] Dependências detectadas. Forçando execução sequencial (maxConcurrency = 1)`);
        maxConcurrency = 1;
      }

      const results: any[] = [];
      const resultsMap = new Map<string, any>();

      // Helper para resolver placeholders
      function resolvePlaceholders(val: any): any {
        if (typeof val === 'string') {
          // Substituir primeiro os placeholders randômicos
          let resolved = val
            .replace(/\{\{\s*\$randomCPF\s*\}\}/g, () => generateRandomCPF())
            .replace(/\{\{\s*\$randomCNPJ\s*\}\}/g, () => generateRandomCNPJ())
            .replace(/\{\{\s*\$randomEmail\s*\}\}/g, () => generateRandomEmail())
            .replace(/\{\{\s*\$randomName\s*\}\}/g, () => generateRandomName())
            .replace(/\{\{\s*\$randomPhone\s*\}\}/g, () => generateRandomPhone())
            .replace(/\{\{\s*\$randomUUID\s*\}\}/g, () => generateRandomUUID());

          return resolved.replace(/\{\{([^}]+)\}\}/g, (match, pathStr) => {
            const trimmedPath = pathStr.trim();

            if (trimmedPath.startsWith('$random')) {
              return match;
            }

            const parts = trimmedPath.split('.');
            const sourceId = parts[0];

            if (!resultsMap.has(sourceId)) {
              throw new Error(`Placeholder de requisição inválido: "${sourceId}" não foi executada ainda no lote.`);
            }

            const sourceResult = resultsMap.get(sourceId);

            if (parts.length === 1) {
              if (sourceResult === null || sourceResult === undefined || typeof sourceResult !== 'object') {
                return String(sourceResult);
              }

              const idKeys: string[] = [];
              const scanKeys = (obj: any, prefix = '') => {
                if (!obj || typeof obj !== 'object') return;
                for (const key of Object.keys(obj)) {
                  const fullKey = prefix ? `${prefix}.${key}` : key;
                  if (/id/i.test(key)) {
                    idKeys.push(fullKey);
                  }
                  if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && prefix === '') {
                    scanKeys(obj[key], key);
                  }
                }
              };

              scanKeys(sourceResult);

              if (idKeys.length === 1 && idKeys[0]) {
                let cur = sourceResult;
                const pathParts = idKeys[0].split('.');
                for (const p of pathParts) {
                  cur = cur?.[p];
                }
                return String(cur);
              }

              if (idKeys.length > 1) {
                throw new Error(`Ambiguidade de ID na resposta de "${sourceId}": Foram encontradas múltiplas propriedades que contêm "id" (${idKeys.join(', ')}). Por favor, declare o caminho exato desejado (ex: {{${sourceId}.${idKeys[0] || 'id'}}}).`);
              }

              throw new Error(`Nenhum ID detectado automaticamente na resposta de "${sourceId}". Propriedades disponíveis: [${Object.keys(sourceResult).join(', ')}].`);
            }

            let current = sourceResult;
            for (let i = 1; i < parts.length; i++) {
              if (current === null || current === undefined) {
                throw new Error(`Caminho inválido "${trimmedPath}": propriedade "${parts[i]}" inexistente.`);
              }
              current = current[parts[i]];
            }

            return current !== undefined ? String(current) : match;
          });
        }

        if (Array.isArray(val)) {
          return val.map(resolvePlaceholders);
        }

        if (val && typeof val === 'object') {
          const res: any = {};
          for (const [k, v] of Object.entries(val)) {
            res[k] = resolvePlaceholders(v);
          }
          return res;
        }

        return val;
      }

      const freshServer = await getServerById(serverRecord!.id);

      if (maxConcurrency === 1) {
        for (const req of args.requests) {
          try {
            const resolvedEndpoint = resolvePlaceholders(req.endpoint);
            const resolvedBody = req.body ? resolvePlaceholders(req.body) : undefined;
            const resolvedQuery = req.queryParams ? resolvePlaceholders(req.queryParams) : undefined;

            const res = await executeGenericMcpProxy(freshServer, resolvedEndpoint, req.method, resolvedBody, resolvedQuery, false, req.authProfileId);

            const isError = res.isError || (res.content && res.content[0] && res.content[0].text && res.content[0].text.startsWith('Error'));
            let data: any = null;

            if (!isError && res.content && res.content[0]) {
              try {
                const text = res.content[0].text;
                const jsonText = text.replace(/^\[AVISO DO SERVIDOR MCP:[^\]]+\]\n\nResposta da API:\n/, '');
                data = JSON.parse(jsonText);
              } catch {
                data = res.content[0].text;
              }
            }

            results.push({
              requestId: req.requestId,
              status: isError ? 400 : 200,
              success: !isError,
              data: isError ? null : data,
              error: isError ? res.content?.[0]?.text || 'Erro desconhecido' : null
            });

            resultsMap.set(req.requestId, data);

            if (isError && stopOnError) {
              console.error(`[MCP Lote] Interrompendo lote por erro no passo "${req.requestId}"`);
              break;
            }
          } catch (err: any) {
            results.push({
              requestId: req.requestId,
              status: 500,
              success: false,
              data: null,
              error: err.message
            });
            if (stopOnError) break;
          }
        }
      } else {
        const chunks: typeof args.requests[] = [];
        for (let i = 0; i < args.requests.length; i += maxConcurrency) {
          chunks.push(args.requests.slice(i, i + maxConcurrency));
        }

        let stopExecution = false;

        for (const chunk of chunks) {
          if (stopExecution) break;

          const promises = chunk.map(async (req) => {
            try {
              const res = await executeGenericMcpProxy(freshServer, req.endpoint, req.method, req.body, req.queryParams, false, req.authProfileId);
              const isError = res.isError;
              let data: any = null;

              if (!isError && res.content && res.content[0]) {
                try {
                  data = JSON.parse(res.content[0].text);
                } catch {
                  data = res.content[0].text;
                }
              }

              return {
                requestId: req.requestId,
                status: isError ? 400 : 200,
                success: !isError,
                data: isError ? null : data,
                error: isError ? res.content?.[0]?.text || 'Erro desconhecido' : null
              };
            } catch (err: any) {
              return {
                requestId: req.requestId,
                status: 500,
                success: false,
                data: null,
                error: err.message
              };
            }
          });

          const chunkRes = await Promise.all(promises);
          results.push(...chunkRes);

          if (stopOnError && chunkRes.some(r => !r.success)) {
            stopExecution = true;
          }
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }]
      };
    }
  );

  // Ferramenta 9: Consultar Guia de Fluxos (Playbook)
  mcp.tool(
    'consultar_guia_fluxos',
    `Retorna o Playbook (Guia de Fluxos Funcionais e Notas de Integração) atual para o servidor MCP do ${serverRecord.name}. Contém lições aprendidas e exemplos de fluxos descritos por outras IAs.`,
    {},
    async () => {
      console.error(`[MCP Tool Executada] IA chamou "consultar_guia_fluxos"`);
      try {
        const playbook = await getLatestPlaybook(serverRecord!.id);
        return {
          content: [{
            type: 'text',
            text: playbook || 'Nenhum guia de fluxo (Playbook) foi escrito para este servidor ainda. Sinta-se livre para iniciar e escrever o primeiro playbook usando atualizar_guia_fluxos para orientar futuras IAs.'
          }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao buscar playbook: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 10: Atualizar Guia de Fluxos (Playbook)
  mcp.tool(
    'atualizar_guia_fluxos',
    `Permite atualizar o Playbook (Guia de Integração e Lições Aprendidas) de IAs para a API do ${serverRecord.name}. A atualização criará uma nova versão versionada no banco, salvando as dicas funcionais, tratamentos de bugs e exemplos de lote.`,
    {
      content: z.string().describe('Conteúdo completo em formato Markdown contendo o Playbook de Integração da API atualizado.')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "atualizar_guia_fluxos"`);
      try {
        await savePlaybookVersion(serverRecord!.id, args.content, 'ai');
        return {
          content: [{ type: 'text', text: `Playbook de Integração da API atualizado e versionado com sucesso!` }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao atualizar playbook: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 11: Gerar Dados de Teste
  mcp.tool(
    'gerar_dados_teste',
    'Gera dados cadastrais válidos e dinâmicos para testes, como CPF ou CNPJ válidos (com cálculo correto de dígitos verificadores) para evitar erros de validação da API.',
    {
      cpf: z.boolean().optional().describe('Gera um CPF válido'),
      cnpj: z.boolean().optional().describe('Gera um CNPJ válido'),
      email: z.boolean().optional().describe('Gera um e-mail randômico único'),
      name: z.boolean().optional().describe('Gera um nome completo brasileiro'),
      phone: z.boolean().optional().describe('Gera um número de celular brasileiro no formato DDD + 9 dígitos'),
      uuid: z.boolean().optional().describe('Gera um UUID v4')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "gerar_dados_teste"`);
      const response: any = {};
      if (args.cpf) response.cpf = generateRandomCPF();
      if (args.cnpj) response.cnpj = generateRandomCNPJ();
      if (args.email) response.email = generateRandomEmail();
      if (args.name) response.name = generateRandomName();
      if (args.phone) response.phone = generateRandomPhone();
      if (args.uuid) response.uuid = generateRandomUUID();
      
      if (Object.keys(response).length === 0) {
        response.nome = generateRandomName();
        response.email = generateRandomEmail();
        response.cpf = generateRandomCPF();
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
      };
    }
  );

  // Ferramenta 12: Teste de Carga / Estresse
  mcp.tool(
    'stress_test_endpoint',
    'Executa testes de concorrência controlada (estresse) contra um endpoint específico para medir tempos de resposta, resiliência do servidor e identificar race conditions.',
    {
      endpoint: z.string().describe('O caminho do endpoint para chamar. Ex: /api/v1/Assinatura'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('O método HTTP'),
      body: z.record(z.string(), z.any()).optional().describe('JSON Payload para o body'),
      queryParams: z.record(z.string(), z.any()).optional().describe('Parâmetros de query string'),
      concurrency: z.number().optional().describe('Concorrência simultânea de requisições (padrão: 5, máximo: 20)'),
      count: z.number().optional().describe('Total de requisições a serem disparadas (padrão: 10, máximo: 50)'),
      authProfileId: z.string().optional().describe('ID do perfil de autenticação para as chamadas')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "stress_test_endpoint" no endpoint ${args.endpoint}`);
      const freshServer = await getServerById(serverRecord!.id);
      const concurrency = Math.min(args.concurrency || 5, 20);
      const total = Math.min(args.count || 10, 50);

      const durations: number[] = [];
      let successCount = 0;
      let failureCount = 0;
      const errorSummary = new Map<string, number>();

      const runRequest = async () => {
        const start = Date.now();
        try {
          const resolvedBody = args.body ? resolvePlaceholdersInObject(args.body) : undefined;
          const resolvedQuery = args.queryParams ? resolvePlaceholdersInObject(args.queryParams) : undefined;
          
          const res = await executeGenericMcpProxy(
            freshServer,
            args.endpoint,
            args.method,
            resolvedBody,
            resolvedQuery,
            false,
            args.authProfileId
          );
          const duration = Date.now() - start;
          durations.push(duration);

          const isError = res.isError || (res.content && res.content[0] && res.content[0].text && res.content[0].text.startsWith('Error'));
          if (isError) {
            failureCount++;
            const errMsg = res.content?.[0]?.text?.substring(0, 100) || 'Erro desconhecido';
            errorSummary.set(errMsg, (errorSummary.get(errMsg) || 0) + 1);
          } else {
            successCount++;
          }
        } catch (err: any) {
          const duration = Date.now() - start;
          durations.push(duration);
          failureCount++;
          errorSummary.set(err.message, (errorSummary.get(err.message) || 0) + 1);
        }
      };

      function resolvePlaceholdersInObject(obj: any): any {
        if (typeof obj === 'string') {
          return obj
            .replace(/\{\{\s*\$randomCPF\s*\}\}/g, () => generateRandomCPF())
            .replace(/\{\{\s*\$randomCNPJ\s*\}\}/g, () => generateRandomCNPJ())
            .replace(/\{\{\s*\$randomEmail\s*\}\}/g, () => generateRandomEmail())
            .replace(/\{\{\s*\$randomName\s*\}\}/g, () => generateRandomName())
            .replace(/\{\{\s*\$randomPhone\s*\}\}/g, () => generateRandomPhone())
            .replace(/\{\{\s*\$randomUUID\s*\}\}/g, () => generateRandomUUID());
        }
        if (Array.isArray(obj)) return obj.map(resolvePlaceholdersInObject);
        if (obj && typeof obj === 'object') {
          const res: any = {};
          for (const [k, v] of Object.entries(obj)) {
            res[k] = resolvePlaceholdersInObject(v);
          }
          return res;
        }
        return obj;
      }

      for (let i = 0; i < total; i += concurrency) {
        const batch = [];
        for (let j = 0; j < concurrency && (i + j) < total; j++) {
          batch.push(runRequest());
        }
        await Promise.all(batch);
      }

      durations.sort((a, b) => a - b);
      const min = durations[0] || 0;
      const max = durations[durations.length - 1] || 0;
      const avg = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
      
      const getPercentile = (p: number) => {
        if (durations.length === 0) return 0;
        const index = Math.ceil((p / 100) * durations.length) - 1;
        return durations[index];
      };

      const report = {
        totalRequests: total,
        concurrency,
        successRate: `${((successCount / total) * 100).toFixed(1)}%`,
        successCount,
        failureCount,
        responseTimeMs: {
          min,
          max,
          avg: Math.round(avg),
          p50: getPercentile(50),
          p90: getPercentile(90),
          p99: getPercentile(99)
        },
        errorsBreakdown: Object.fromEntries(errorSummary.entries())
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }]
      };
    }
  );

  // Ferramenta 13: Salvar Caso de Teste
  mcp.tool(
    'salvar_caso_teste',
    'Cria ou atualiza um fluxo/caso de teste de regressão persistido no banco de dados. O caso de teste executa uma lista ordenada de passos de chamadas de endpoint.',
    {
      name: z.string().describe('Nome único do caso de teste (ex: Fluxo_Cadastro_Empresa)'),
      description: z.string().optional().describe('Descrição do propósito do caso de teste'),
      steps: z.array(z.object({
        requestId: z.string().describe('Identificador único do passo dentro do caso de teste (ex: criar_empresa)'),
        endpoint: z.string().describe('Endpoint a ser chamado (pode incluir placeholders {{passo_anterior.campo}} ou {{$randomCPF}})'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('Método HTTP'),
        body: z.record(z.string(), z.any()).optional().describe('Payload opcional para o body'),
        queryParams: z.record(z.string(), z.any()).optional().describe('Parâmetros de query string opcionais'),
        authProfileId: z.string().optional().describe('ID do perfil de autenticação para este passo')
      })).describe('Array ordenado de chamadas HTTP'),
      variablesSchema: z.record(z.string(), z.any()).optional().describe('Dicionário de variáveis padrão e seus valores')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "salvar_caso_teste" para "${args.name}"`);
      try {
        const testCase = await saveTestCase(serverRecord!.id, {
          name: args.name,
          description: args.description || null,
          steps: args.steps,
          variables_schema: args.variablesSchema || {}
        });

        return {
          content: [{ type: 'text', text: `Caso de teste "${testCase.name}" persistido com sucesso! ID: ${testCase.id}` }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao salvar caso de teste: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 14: Listar Casos de Teste
  mcp.tool(
    'listar_casos_teste',
    'Retorna todos os casos de teste salvos para este servidor no banco de dados, incluindo a data e status da última execução.',
    {},
    async () => {
      console.error(`[MCP Tool Executada] IA chamou "listar_casos_teste"`);
      try {
        const testCases = await getTestCases(serverRecord!.id);
        if (testCases.length === 0) {
          return {
            content: [{ type: 'text', text: 'Nenhum caso de teste cadastrado para este servidor.' }]
          };
        }

        const list = testCases.map(tc => {
          return `- **Nome**: ${tc.name}\n  Descrição: ${tc.description || 'Sem descrição'}\n  Passos: ${tc.steps.length}\n  Último Status: ${tc.last_run_status || 'Nunca executado'}\n  Última Rodada: ${tc.last_run_at ? new Date(tc.last_run_at).toLocaleString() : 'N/A'}`;
        }).join('\n\n');

        return {
          content: [{ type: 'text', text: `Casos de Teste cadastrados:\n\n${list}` }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao listar casos de teste: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 15: Deletar Caso de Teste
  mcp.tool(
    'deletar_caso_teste',
    'Exclui um caso de teste pelo nome ou pelo ID.',
    {
      nameOrId: z.string().describe('Nome ou ID do caso de teste a ser removido')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "deletar_caso_teste" para: ${args.nameOrId}`);
      try {
        await deleteTestCase(serverRecord!.id, args.nameOrId);
        return {
          content: [{ type: 'text', text: `Caso de teste deletado com sucesso.` }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao deletar caso de teste: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 16: Executar Caso de Teste
  mcp.tool(
    'executar_caso_teste',
    'Executa um caso de teste salvo, resolvendo placeholders de dados dinamicamente, salvando o histórico da execução e retornando os dados finais.',
    {
      nameOrId: z.string().describe('Nome ou ID do caso de teste a ser executado'),
      variablesOverride: z.record(z.string(), z.any()).optional().describe('Valores de variáveis para sobrescrever as padrão do caso de teste')
    },
    async (args) => {
      console.error(`[MCP Tool Executada] IA chamou "executar_caso_teste" para: ${args.nameOrId}`);
      try {
        let testCase: TestCaseRecord | null = null;
        if (args.nameOrId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
          const cases = await getTestCases(serverRecord!.id);
          testCase = cases.find(c => c.id === args.nameOrId) || null;
        } else {
          testCase = await getTestCaseByName(serverRecord!.id, args.nameOrId);
        }

        if (!testCase) {
          return {
            content: [{ type: 'text', text: `Caso de teste "${args.nameOrId}" não encontrado.` }]
          };
        }

        const result = await runTestCase(serverRecord!, testCase, {
          variablesOverride: args.variablesOverride ?? {},
          mode: 'proxy',
          persist: true,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro na execucao do caso de teste: ${err.message}` }]
        };
      }
    }
  );

  // Ferramenta 17: Cobertura de Testes
  mcp.tool(
    'gerar_relatorio_cobertura',
    'Retorna um relatório de cobertura de testes da API, mostrando quais endpoints já possuem casos de teste salvos associados e quais estão órfãos (não testados).',
    {},
    async () => {
      console.error(`[MCP Tool Executada] IA chamou "gerar_relatorio_cobertura"`);
      try {
        const tools = await getToolsByServerId(serverRecord!.id);
        const testCases = await getTestCases(serverRecord!.id);

        if (tools.length === 0) {
          return {
            content: [{ type: 'text', text: 'Nenhum endpoint cadastrado para esta API.' }]
          };
        }

        const covered = new Set<string>();
        
        for (const tc of testCases) {
          for (const step of tc.steps) {
            const method = step.method.toUpperCase();
            let pathNormalized = step.endpoint.split('?')[0];
            pathNormalized = pathNormalized.replace(/\{\{([^}]+)\}\}/g, '{$1}');
            covered.add(`${method} ${pathNormalized}`);
          }
        }

        const totalCount = tools.length;
        const missingList: string[] = [];
        let coveredCount = 0;

        for (const t of tools) {
          const method = t.http_method.toUpperCase();
          const path = t.endpoint_path;
          const identifier = `${method} ${path}`;

          let isCovered = false;
          if (covered.has(identifier)) {
            isCovered = true;
          } else {
            const pathRegexStr = '^' + path.replace(/\{[^}]+\}/g, '[^/]+') + '$';
            const pathRegex = new RegExp(pathRegexStr, 'i');
            
            for (const cov of covered) {
              const [covMethod, covPath] = cov.split(' ');
              if (covMethod === method && covPath && pathRegex.test(covPath)) {
                isCovered = true;
                break;
              }
            }
          }

          if (isCovered) {
            coveredCount++;
          } else {
            missingList.push(`- **${method}** ${path} (${t.custom_name || 'Sem nome'})`);
          }
        }

        const coveragePercent = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;

        const reportText = [
          `# Relatório de Cobertura de Testes da API`,
          `**Total de Endpoints**: ${totalCount}`,
          `**Endpoints Testados**: ${coveredCount}`,
          `**Porcentagem de Cobertura**: ${coveragePercent.toFixed(1)}%`,
          `\n## Endpoints Não Cobertos (${missingList.length}):`,
          missingList.length > 0 ? missingList.join('\n') : '🎉 Todos os endpoints possuem cobertura de teste!'
        ].join('\n');

        return {
          content: [{ type: 'text', text: reportText }]
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Erro ao gerar relatorio de cobertura: ${err.message}` }]
        };
      }
    }
  );

  return { mcpServer: mcp, serverRecord };
}

export async function startMcpEngine(targetServerId?: string) {
  console.error('[MCP Engine] Inicializando motor de busca de servidores...');

  const { mcpServer, serverRecord } = await createMcpServerInstance(targetServerId);

  if (!serverRecord) {
    console.error('[MCP Engine AVISO] Nenhum servidor MCP configurado no banco Supabase ainda.');
    console.error('[MCP Engine] Inicializando Servidor MCP de Boas-Vindas (Welcome Server) no modo Stdio...');
    console.error('[MCP Engine] Conectando transporte Stdio (Modo Boas-Vindas)...');
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('[MCP Engine] Servidor de Boas-Vindas rodando perfeitamente no Stdio. Acesse http://localhost:3000 no navegador para cadastrar sua API!');
    return;
  }

  console.error(`[MCP Engine] Servidor "${serverRecord.name}" identificado. Inicializando SDK...`);
  console.error('[MCP Engine] Conectando transporte Stdio...');
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error(`[MCP Engine] Servidor "${serverRecord.name}" rodando perfeitamente no Stdio com suporte a categorias dinâmicas.`);
}


