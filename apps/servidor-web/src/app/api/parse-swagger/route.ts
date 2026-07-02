import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL invalida fornecida.' }, { status: 400 });
    }

    // Busca o Swagger na URL de destino (Server-side contorna CORS)
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Falha ao buscar Swagger: Destino respondeu com status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Validação básica se é OpenAPI/Swagger
    if (!data.openapi && !data.swagger) {
      return NextResponse.json({ error: 'O JSON retornado nao parece ser um OpenAPI ou Swagger valido.' }, { status: 400 });
    }

    const title = data.info?.title || 'API_Sem_Titulo';
    // Tenta inferir a baseUrl dos servers ou da propria URL do swagger
    let baseUrl = '';
    if (data.servers && data.servers.length > 0) {
      baseUrl = data.servers[0].url;
    } else {
      const urlObj = new URL(url);
      baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    }

    const tools = [];
    const paths = data.paths || {};

    // Percorre caminhos e metodos para montar as ferramentas
    for (const [pathKey, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const [methodKey, operation] of Object.entries(pathItem)) {
        // Ignora chaves que nao sao metodos HTTP
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(methodKey.toLowerCase())) continue;

        const op = operation as any;
        const method = methodKey.toUpperCase();
        
        // Monta um nome limpo se nao houver operationId
        const cleanPath = pathKey.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const originalName = op.operationId ? op.operationId : `${method.toLowerCase()}_${cleanPath}`;

        // Mapeia parametros (Query, Path) e RequestBody para um schema simplificado
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

        tools.push({
          originalName,
          customName: originalName,
          customDescription: op.summary || op.description || `Chamada ${method} para ${pathKey}`,
          httpMethod: method,
          endpointPath: pathKey,
          parametersSchema: paramsSchema
        });
      }
    }

    return NextResponse.json({
      title,
      baseUrl,
      swaggerUrl: url,
      tools
    });

  } catch (err: any) {
    console.error('Erro no proxy de parse do Swagger:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao processar o Swagger.' }, { status: 500 });
  }
}
