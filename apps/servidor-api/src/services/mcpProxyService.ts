import fetch from 'node-fetch';
import { updateServerCredentials, getToolsByServerId } from '../repositories/mcpRepository.js';
import type { ServerRecord, ToolRecord } from '../repositories/mcpRepository.js';

const tokenCache = new Map<string, string>();
const tokenAcquiredAtCache = new Map<string, number>();

interface ResolvedAuth {
  currentToken: string | undefined;
  activeProfileId: string;
  allowedProfiles: string[];
}

function resolveActiveAuth(server: ServerRecord, authReqRaw: any, isAutoLogin: boolean, isRetry: boolean): ResolvedAuth {
  const creds = server.auth_credentials;
  const authReqList: string[] = Array.isArray(authReqRaw)
    ? authReqRaw
    : (typeof authReqRaw === 'string' ? [authReqRaw] : ['none']);
  
  const allowedProfiles = authReqList.filter(p => p !== 'none');
  
  if (allowedProfiles.length === 0) {
    return { currentToken: undefined, activeProfileId: 'default', allowedProfiles };
  }

  let currentToken: string | undefined = undefined;
  let activeProfileId = allowedProfiles[0] || 'default';

  for (const profId of allowedProfiles) {
    const cacheKey = `${server.id}:${profId}`;
    let tok = tokenCache.get(cacheKey);

    if (!tok && creds?.profiles && Array.isArray(creds.profiles)) {
      const prof = creds.profiles.find((p: any) => p.id === profId);
      if (prof && prof.token) {
        tok = prof.token as string;
        tokenCache.set(cacheKey, tok);
      }
    }
    if (!tok && creds?.token && profId === 'default') {
      tok = creds.token as string;
      tokenCache.set(cacheKey, tok);
    }

    if (tok && creds?.profiles && Array.isArray(creds.profiles)) {
      const prof = creds.profiles.find((p: any) => p.id === profId);
      if (prof && prof.tokenDurationMinutes) {
        const acquiredAt = tokenAcquiredAtCache.get(cacheKey);
        if (acquiredAt) {
          const elapsedMinutes = (Date.now() - acquiredAt) / (1000 * 60);
          if (elapsedMinutes >= Number(prof.tokenDurationMinutes)) {
            console.error(`[MCP Proxy] Token do perfil ${profId} expirou. Limpando para login...`);
            tokenCache.delete(cacheKey);
            tokenAcquiredAtCache.delete(cacheKey);
            tok = undefined;
          }
        }
      }
    }

    if (tok) {
      currentToken = tok;
      activeProfileId = profId;
      break;
    }
  }

  return { currentToken, activeProfileId, allowedProfiles };
}

async function performAutoLogin(server: ServerRecord, profileId?: string): Promise<{ token: string; profileId: string }> {
  const creds = server.auth_credentials;
  if (!creds || creds.authMode !== 'auto_login') {
    throw new Error('Servidor não está configurado para auto_login.');
  }

  let profile: any = null;
  if (creds.profiles && Array.isArray(creds.profiles)) {
    if (profileId && profileId !== 'none') {
      profile = creds.profiles.find((p: any) => p.id === profileId);
    }
    if (!profile && creds.profiles.length > 0) {
      profile = creds.profiles[0];
    }
  }

  if (!profile) {
    profile = {
      id: 'default',
      name: 'Padrão',
      loginEndpoint: creds.loginEndpoint || '',
      loginMethod: creds.loginMethod || 'POST',
      loginPayload: creds.loginPayload || '',
      tokenPath: creds.tokenPath || 'token'
    };
  }

  const loginUrl = `${server.api_base_url.replace(/\/$/, '')}/${profile.loginEndpoint.replace(/^\//, '')}`;
  const method = (profile.loginMethod || 'POST').toUpperCase();
  
  let bodyPayload: any = null;
  if (profile.loginPayload) {
    try {
      bodyPayload = typeof profile.loginPayload === 'string' ? JSON.parse(profile.loginPayload) : profile.loginPayload;
    } catch (e) {
      throw new Error(`Falha ao fazer parse do JSON de loginPayload do perfil ${profile.name}.`);
    }
  }

  console.error(`[MCP Proxy AutoLogin] Disparando ${method} para ${loginUrl} (Perfil: ${profile.name})...`);

  const res = await fetch(loginUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: bodyPayload ? JSON.stringify(bodyPayload) : null,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha no AutoLogin (${res.status} ${res.statusText}): ${errText}`);
  }

  const data = await res.json();

  const pathParts = (profile.tokenPath || 'token').split('.');
  let token: any = data;
  for (const part of pathParts) {
    if (token && typeof token === 'object') {
      token = token[part];
    } else {
      token = null;
      break;
    }
  }

  if (!token || typeof token !== 'string') {
    throw new Error(`Token não encontrado no caminho "${profile.tokenPath}" da resposta de login: ${JSON.stringify(data)}`);
  }

  console.error(`[MCP Proxy AutoLogin] Token obtido com sucesso para o servidor ${server.name} (Perfil: ${profile.name})!`);
  const cacheKey = `${server.id}:${profile.id}`;
  tokenCache.set(cacheKey, token);
  tokenCache.set(server.id, token); // fallback legacy
  tokenAcquiredAtCache.set(cacheKey, Date.now());
  return { token, profileId: profile.id };
}

export async function executeMcpToolProxy(server: ServerRecord, tool: ToolRecord, args: any, isRetry = false): Promise<any> {
  try {
    let url = `${server.api_base_url.replace(/\/$/, '')}/${tool.endpoint_path.replace(/^\//, '')}`;
    const method = tool.http_method.toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const creds = server.auth_credentials;
    const isAutoLogin = creds && creds.authMode === 'auto_login';
    const authReqRaw = tool.parameters_schema?.authRequirement || 'none';
    const authRes = resolveActiveAuth(server, authReqRaw, isAutoLogin, isRetry);
    let { currentToken, activeProfileId, allowedProfiles } = authRes;

    if (allowedProfiles.length > 0) {
      if (isAutoLogin && !currentToken && !isRetry) {
        console.error(`[MCP Proxy] Nenhum token em cache para ${server.name} (Perfis: ${allowedProfiles.join(', ')}). Realizando login inicial para ${activeProfileId}...`);
        const loginRes = await performAutoLogin(server, activeProfileId);
        currentToken = loginRes.token;
        activeProfileId = loginRes.profileId;
      }

      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      } else if (server.auth_type === 'dashboard_login' && creds?.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      }
    } else {
      console.error(`[MCP Proxy] Endpoint ${tool.endpoint_path} configurado como Público (Sem Auth). Omitindo header Authorization.`);
      delete headers['Authorization'];
    }

    const queryParams = new URLSearchParams();
    let bodyPayload: any = undefined;

    for (const [key, val] of Object.entries(args)) {
      if (key === 'body') {
        bodyPayload = val;
        continue;
      }
      if (url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(val)));
      } else {
        queryParams.append(key, String(val));
      }
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    const expectedContentType = tool.parameters_schema?.contentType || 'application/json';
    let fetchBody: any = null;
    if (bodyPayload) {
      if (expectedContentType === 'multipart/form-data') {
        const { FormData } = await import('node-fetch');
        const form = new FormData();
        for (const [k, v] of Object.entries(bodyPayload)) {
          if (v !== undefined && v !== null) {
            form.append(k, String(v));
          }
        }
        fetchBody = form;
        delete headers['Content-Type'];
      } else if (expectedContentType === 'application/x-www-form-urlencoded') {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(bodyPayload)) {
          if (v !== undefined && v !== null) {
            qs.append(k, String(v));
          }
        }
        fetchBody = qs.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        fetchBody = JSON.stringify(bodyPayload);
        headers['Content-Type'] = 'application/json';
      }
    }

    console.error(`[MCP Proxy] Disparando ${method} para ${url}...`);

    const response = await fetch(url, {
      method,
      headers,
      body: fetchBody,
    });

    if (response.status === 401 && isAutoLogin && allowedProfiles.length > 0 && !isRetry) {
      console.error(`[MCP Proxy AVISO] Recebido 401 Unauthorized de ${url}. Renovando token do perfil ${activeProfileId} via AutoLogin...`);
      await performAutoLogin(server, activeProfileId);
      return await executeMcpToolProxy(server, tool, args, true);
    }

    return processResponse(response, server, activeProfileId);
  } catch (err: any) {
    console.error(`[MCP Proxy Fatal Error] ${tool.custom_name}:`, err);
    return handleError(err);
  }
}

export async function executeGenericMcpProxy(
  server: ServerRecord,
  endpoint: string,
  method: string,
  body?: any,
  queryParams?: Record<string, any>,
  isRetry = false,
  forcedProfileId?: string
): Promise<any> {
  try {
    let url = `${server.api_base_url.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const creds = server.auth_credentials;
    const isAutoLogin = creds && creds.authMode === 'auto_login';

    const tools = await getToolsByServerId(server.id);
    const matchedTool = tools.find(t => t.http_method.toUpperCase() === method.toUpperCase() && t.endpoint_path === endpoint);
    
    let authReqRaw = matchedTool?.parameters_schema?.authRequirement || 'none';
    if (forcedProfileId) {
      if (forcedProfileId === 'none') {
        authReqRaw = 'none';
      } else {
        authReqRaw = [forcedProfileId];
      }
    }

    const expectedContentType = matchedTool?.parameters_schema?.contentType || 'application/json';

    const authRes = resolveActiveAuth(server, authReqRaw, isAutoLogin, isRetry);
    let { currentToken, activeProfileId, allowedProfiles } = authRes;

    if (allowedProfiles.length > 0) {
      if (isAutoLogin && !currentToken && !isRetry) {
        console.error(`[MCP Proxy Genérico] Nenhum token em cache para ${server.name} (Perfis: ${allowedProfiles.join(', ')}). Realizando login inicial para ${activeProfileId}...`);
        const loginRes = await performAutoLogin(server, activeProfileId);
        currentToken = loginRes.token;
        activeProfileId = loginRes.profileId;
      }

      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      } else if (server.auth_type === 'dashboard_login' && creds?.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      }
    } else {
      console.error(`[MCP Proxy Genérico] Endpoint ${endpoint} configurado como Público (Sem Auth). Omitindo header Authorization.`);
      delete headers['Authorization'];
    }

    if (queryParams && Object.keys(queryParams).length > 0) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(queryParams)) {
        qs.append(k, String(v));
      }
      url += (url.includes('?') ? '&' : '?') + qs.toString();
    }

    let fetchBody: any = null;
    if (body) {
      if (expectedContentType === 'multipart/form-data') {
        const { FormData } = await import('node-fetch');
        const form = new FormData();
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined && v !== null) {
            form.append(k, String(v));
          }
        }
        fetchBody = form;
        delete headers['Content-Type'];
      } else if (expectedContentType === 'application/x-www-form-urlencoded') {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined && v !== null) {
            qs.append(k, String(v));
          }
        }
        fetchBody = qs.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        fetchBody = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
      }
    }

    console.error(`[MCP Proxy Genérico] Disparando ${method.toUpperCase()} para ${url} (ContentType: ${expectedContentType})...`);
    console.error(`[MCP Proxy Debug] Headers enviados para a API:`, JSON.stringify(headers));

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: fetchBody,
    });

    // Se falhar com 401 e o perfil tiver Auto-Login, tenta renovar o token e repetir
    if (response.status === 401 && isAutoLogin && allowedProfiles.length > 0 && !isRetry) {
      console.error(`[MCP Proxy AVISO] Recebido 401 Unauthorized de ${url}. Renovando token do perfil ${activeProfileId} via AutoLogin...`);
      await performAutoLogin(server, activeProfileId);
      return await executeGenericMcpProxy(server, endpoint, method, body, queryParams, true, forcedProfileId);
    }

    // Se falhar com 401/403, e a chamada era pública (sem override explicitado) tenta todos os perfis ativos do servidor
    if ((response.status === 401 || response.status === 403) && !forcedProfileId && allowedProfiles.length === 0) {
      const allProfiles = creds?.profiles && Array.isArray(creds.profiles) ? creds.profiles : [];
      console.error(`[MCP Proxy Fallback] Endpoint público retornou ${response.status}. Iniciando varredura por ${allProfiles.length} perfis alternativos...`);

      for (const profile of allProfiles) {
        try {
          const cacheKey = `${server.id}:${profile.id}`;
          let token = tokenCache.get(cacheKey) || profile.token;

          if (!token && isAutoLogin) {
            const loginRes = await performAutoLogin(server, profile.id);
            token = loginRes.token;
          }

          if (token) {
            const fallbackHeaders = { ...headers, 'Authorization': `Bearer ${token}` };
            console.error(`[MCP Proxy Fallback] Testando perfil "${profile.name}" (ID: ${profile.id})...`);
            
            const fallbackResponse = await fetch(url, {
              method: method.toUpperCase(),
              headers: fallbackHeaders,
              body: fetchBody,
            });

            if (fallbackResponse.ok) {
              console.error(`[MCP Proxy Fallback] SUCESSO com o perfil "${profile.name}"!`);
              const processed = await processResponse(fallbackResponse, server, profile.id);
              if (!processed.isError && processed.content && processed.content[0]) {
                processed.content[0].text = `[AVISO DO SERVIDOR MCP: Este endpoint não possui autenticação cadastrada (público), mas a requisição retornou status ${response.status}. O servidor tentou autenticar automaticamente e obteve SUCESSO utilizando o perfil "${profile.name}" (ID: ${profile.id}). Por favor, informe ao usuário para atualizar as configurações de autenticação desta ferramenta no dashboard.]\n\nResposta da API:\n${processed.content[0].text}`;
              }
              return processed;
            } else {
              console.error(`[MCP Proxy Fallback] Perfil "${profile.name}" falhou com status ${fallbackResponse.status}.`);
            }
          }
        } catch (e: any) {
          console.error(`[MCP Proxy Fallback] Erro ao testar perfil "${profile.name}":`, e.message);
        }
      }
    }

    return processResponse(response, server, activeProfileId);
  } catch (err: any) {
    console.error(`[MCP Proxy Fatal Error] generico:`, err);
    return handleError(err);
  }
}

async function processResponse(response: any, server: ServerRecord, profileId = 'default') {
  const contentType = response.headers.get('content-type') || '';
  let responseData: any;

  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (response.ok && responseData && typeof responseData === 'object') {
    const possibleToken = responseData.token || responseData.accessToken || responseData.access_token || responseData.jwt;
    if (possibleToken && typeof possibleToken === 'string') {
      console.error(`[MCP Proxy Interceptor] Token JWT identificado na resposta! Salvando no tokenCache para o servidor ${server.name} (Perfil: ${profileId})...`);
      tokenCache.set(`${server.id}:${profileId}`, possibleToken);
      tokenCache.set(server.id, possibleToken); // fallback
      tokenAcquiredAtCache.set(`${server.id}:${profileId}`, Date.now());

      const creds = server.auth_credentials || {};
      let updatedProfiles = creds.profiles;
      if (updatedProfiles && Array.isArray(updatedProfiles)) {
        updatedProfiles = updatedProfiles.map((p: any) => p.id === profileId ? { ...p, token: possibleToken } : p);
      }
      const newCreds = { ...creds, token: possibleToken, profiles: updatedProfiles };
      await updateServerCredentials(server.id, 'dashboard_login', newCreds);
      console.error(`[MCP Proxy Interceptor] Token persistido no Supabase com sucesso para o servidor ${server.name}!`);
    }
  }

  if (!response.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `Erro na API Destino (${response.status} ${response.statusText}): ${typeof responseData === 'object' ? JSON.stringify(responseData) : responseData}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData,
      },
    ],
  };
}

function handleError(err: any) {
  return {
    content: [{ type: 'text', text: `Falha interna no proxy MCP: ${err.message}` }],
    isError: true,
  };
}
