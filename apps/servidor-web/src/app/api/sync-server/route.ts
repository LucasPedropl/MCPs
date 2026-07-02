import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serverId } = body;

    if (!serverId) {
      return NextResponse.json({ error: 'ID do servidor é obrigatório.' }, { status: 400 });
    }

    // 1. Busca o servidor
    const { data: server, error: serverErr } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverErr || !server) {
      return NextResponse.json({ error: 'Servidor não encontrado no Supabase.' }, { status: 404 });
    }

    if (!server.swagger_url) {
      return NextResponse.json({ error: 'Servidor não possui URL de Swagger configurada.' }, { status: 400 });
    }

    // 2. Busca o Swagger
    const res = await fetch(server.swagger_url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Falha ao buscar Swagger: Destino respondeu com status ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    if (!data.openapi && !data.swagger) {
      return NextResponse.json({ error: 'O JSON retornado não parece ser um OpenAPI ou Swagger válido.' }, { status: 400 });
    }

    const freshTools: any[] = [];
    const paths = data.paths || {};

    for (const [pathKey, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const [methodKey, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(methodKey.toLowerCase())) continue;

        const op = operation as any;
        const method = methodKey.toUpperCase();
        const cleanPath = pathKey.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const originalName = op.operationId ? op.operationId : `${method.toLowerCase()}_${cleanPath}`;

        const paramsSchema: Record<string, any> = { type: 'object', properties: {}, required: [] };
        if (op.parameters && Array.isArray(op.parameters)) {
          op.parameters.forEach((param: any) => {
            if (param.name) {
              paramsSchema.properties[param.name] = {
                type: param.schema?.type || 'string',
                description: param.description || '',
                in: param.in
              };
              if (param.required) paramsSchema.required.push(param.name);
            }
          });
        }

        if (op.requestBody?.content?.['application/json']?.schema) {
          paramsSchema.properties['body'] = op.requestBody.content['application/json'].schema;
          paramsSchema.required.push('body');
        }

        freshTools.push({
          originalName,
          customName: originalName,
          customDescription: op.summary || op.description || `Chamada ${method} para ${pathKey}`,
          httpMethod: method,
          endpointPath: pathKey,
          parametersSchema: paramsSchema
        });
      }
    }

    // 3. Busca ferramentas existentes
    const { data: existingTools, error: toolsErr } = await supabase
      .from('mcp_tools')
      .select('*')
      .eq('server_id', server.id);

    if (toolsErr) {
      return NextResponse.json({ error: `Erro ao buscar ferramentas existentes: ${toolsErr.message}` }, { status: 500 });
    }

    const existingMap = new Map<string, any>();
    (existingTools || []).forEach(t => {
      existingMap.set(`${t.http_method.toUpperCase()}_${t.endpoint_path}`, t);
    });

    const addedEndpoints: any[] = [];
    const modifiedEndpoints: any[] = [];
    const freshKeys = new Set<string>();
    const newToolsToInsert: any[] = [];

    freshTools.forEach(ft => {
      const key = `${ft.httpMethod.toUpperCase()}_${ft.endpointPath}`;
      freshKeys.add(key);

      if (!existingMap.has(key)) {
        addedEndpoints.push({
          method: ft.httpMethod,
          path: ft.endpointPath,
          name: ft.customName,
          description: ft.customDescription
        });
        newToolsToInsert.push({
          server_id: server.id,
          original_name: ft.originalName,
          custom_name: ft.customName,
          custom_description: ft.customDescription,
          http_method: ft.httpMethod,
          endpoint_path: ft.endpointPath,
          parameters_schema: ft.parametersSchema,
          category_id: null
        });
      } else {
        const existing = existingMap.get(key);
        const oldProps = Object.keys(existing.parameters_schema?.properties || {}).sort().join(',');
        const newProps = Object.keys(ft.parametersSchema?.properties || {}).sort().join(',');
        if (oldProps !== newProps) {
          modifiedEndpoints.push({
            method: ft.httpMethod,
            path: ft.endpointPath,
            old_params: oldProps,
            new_params: newProps
          });
        }
      }
    });

    const removedEndpoints: any[] = [];
    (existingTools || []).forEach(t => {
      const key = `${t.http_method.toUpperCase()}_${t.endpoint_path}`;
      if (!freshKeys.has(key)) {
        removedEndpoints.push({
          method: t.http_method,
          path: t.endpoint_path,
          name: t.custom_name
        });
      }
    });

    // 4. Insere novas ferramentas no banco
    let insertedTools: any[] = [];
    if (newToolsToInsert.length > 0) {
      const { data: insData, error: insErr } = await supabase
        .from('mcp_tools')
        .insert(newToolsToInsert)
        .select();
      
      if (insErr) {
        return NextResponse.json({ error: `Erro ao inserir novas ferramentas: ${insErr.message}` }, { status: 500 });
      }
      insertedTools = insData || [];
    }

    // 5. Monta o resumo em texto
    let summaryText = `Relatório de Sincronização - Servidor: ${server.name}\nData: ${new Date().toISOString()}\n\n`;
    summaryText += `Total de Endpoints no Swagger: ${freshTools.length}\n`;
    summaryText += `Endpoints Adicionados: ${addedEndpoints.length}\n`;
    summaryText += `Endpoints Modificados: ${modifiedEndpoints.length}\n`;
    summaryText += `Endpoints Removidos/Descontinuados: ${removedEndpoints.length}\n\n`;

    if (addedEndpoints.length > 0) {
      summaryText += `--- ADICIONADOS ---\n`;
      addedEndpoints.forEach(a => summaryText += `[${a.method}] ${a.path} (${a.name})\n`);
      summaryText += `\n`;
    }

    if (modifiedEndpoints.length > 0) {
      summaryText += `--- MODIFICADOS ---\n`;
      modifiedEndpoints.forEach(m => summaryText += `[${m.method}] ${m.path} (Parâmetros mudaram de [${m.old_params}] para [${m.new_params}])\n`);
      summaryText += `\n`;
    }

    if (removedEndpoints.length > 0) {
      summaryText += `--- REMOVIDOS ---\n`;
      removedEndpoints.forEach(r => summaryText += `[${r.method}] ${r.path} (${r.name})\n`);
      summaryText += `\n`;
    }

    // 6. Salva no banco de dados
    const { data: reportData, error: reportErr } = await supabase
      .from('mcp_sync_reports')
      .insert([{
        server_id: server.id,
        report_summary: summaryText,
        added_endpoints: addedEndpoints,
        modified_endpoints: modifiedEndpoints,
        removed_endpoints: removedEndpoints
      }])
      .select()
      .single();

    if (reportErr) {
      console.error('Erro ao salvar relatório no Supabase:', reportErr);
    }

    return NextResponse.json({
      success: true,
      report: reportData || {
        report_summary: summaryText,
        added_endpoints: addedEndpoints,
        modified_endpoints: modifiedEndpoints,
        removed_endpoints: removedEndpoints
      },
      insertedTools
    });

  } catch (err: any) {
    console.error('Erro na rota de sincronização:', err);
    return NextResponse.json({ error: err.message || 'Erro interno na sincronização.' }, { status: 500 });
  }
}
