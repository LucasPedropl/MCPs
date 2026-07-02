import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

function generateRandomCPF(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n1 = num(), n2 = num(), n3 = num(), n4 = num(), n5 = num(), n6 = num(), n7 = num(), n8 = num(), n9 = num();
  
  let d1 = n9*2 + n8*3 + n7*4 + n6*5 + n5*6 + n4*7 + n3*8 + n2*9 + n1*10;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = d1*2 + n9*3 + n8*4 + n7*5 + n6*6 + n5*7 + n4*8 + n3*9 + n2*10 + n1*11;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

function generateRandomCNPJ(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n1 = num(), n2 = num(), n3 = num(), n4 = num(), n5 = num(), n6 = num(), n7 = num(), n8 = num();
  const n9 = 0, n10 = 0, n11 = 0, n12 = 1;
  
  let d1 = n12*2 + n11*3 + n10*4 + n9*5 + n8*6 + n7*7 + n6*8 + n5*9 + n4*2 + n3*3 + n2*4 + n1*5;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = d1*2 + n12*3 + n11*4 + n10*5 + n9*6 + n8*7 + n7*8 + n6*9 + n5*2 + n4*3 + n3*4 + n2*5 + n1*6;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${n10}${n11}${n12}${d1}${d2}`;
}

function generateRandomEmail(): string {
  return `test_qa_${Math.floor(100000 + Math.random() * 900000)}@mcp-qa-engine.com`;
}

function generateRandomName(): string {
  const firstNames = ['Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes'];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

function generateRandomPhone(): string {
  const ddd = '11';
  const prefix = '9' + Math.floor(7000 + Math.random() * 2999);
  const suffix = Math.floor(1000 + Math.random() * 8999);
  return `${ddd}${prefix}${suffix}`;
}

function generateRandomUUID(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  try {
    const { serverId, testCaseId, variablesOverride } = await request.json();

    if (!serverId || !testCaseId) {
      return NextResponse.json({ error: 'Parâmetros serverId e testCaseId são obrigatórios.' }, { status: 400 });
    }

    // 1. Carrega o servidor
    const { data: server, error: serverErr } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverErr || !server) {
      return NextResponse.json({ error: 'Servidor não encontrado.' }, { status: 404 });
    }

    // 2. Carrega o caso de teste
    const { data: testCase, error: testCaseErr } = await supabase
      .from('mcp_test_cases')
      .select('*')
      .eq('id', testCaseId)
      .eq('server_id', serverId)
      .single();

    if (testCaseErr || !testCase) {
      return NextResponse.json({ error: 'Caso de teste não encontrado.' }, { status: 404 });
    }

    // 3. Resolve variáveis
    const finalVariables = {
      ...(testCase.variables_schema || {}),
      ...(variablesOverride || {})
    };

    const results: any[] = [];
    const resultsMap = new Map<string, any>();

    for (const [k, v] of Object.entries(finalVariables)) {
      resultsMap.set(k, v);
    }

    function resolvePlaceholders(val: any): any {
      if (typeof val === 'string') {
        let resolved = val
          .replace(/\{\{\s*\$randomCPF\s*\}\}/g, () => generateRandomCPF())
          .replace(/\{\{\s*\$randomCNPJ\s*\}\}/g, () => generateRandomCNPJ())
          .replace(/\{\{\s*\$randomEmail\s*\}\}/g, () => generateRandomEmail())
          .replace(/\{\{\s*\$randomName\s*\}\}/g, () => generateRandomName())
          .replace(/\{\{\s*\$randomPhone\s*\}\}/g, () => generateRandomPhone())
          .replace(/\{\{\s*\$randomUUID\s*\}\}/g, () => generateRandomUUID());

        return resolved.replace(/\{\{([^}]+)\}\}/g, (match, pathStr) => {
          const trimmedPath = pathStr.trim();
          if (trimmedPath.startsWith('$random')) return match;

          const parts = trimmedPath.split('.');
          const sourceId = parts[0];

          if (!resultsMap.has(sourceId)) return match;

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
                if (/id/i.test(key)) idKeys.push(fullKey);
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

            return String(sourceResult);
          }

          let current = sourceResult;
          for (let i = 1; i < parts.length; i++) {
            if (current === null || current === undefined) return match;
            current = current[parts[i]];
          }

          return current !== undefined ? String(current) : match;
        });
      }

      if (Array.isArray(val)) return val.map(resolvePlaceholders);

      if (val && typeof val === 'object') {
        const res: any = {};
        for (const [k, v] of Object.entries(val)) {
          res[k] = resolvePlaceholders(v);
        }
        return res;
      }

      return val;
    }

    const startTime = Date.now();
    let status = 'success';

    for (const step of testCase.steps) {
      const stepStart = Date.now();
      try {
        const resolvedEndpoint = resolvePlaceholders(step.endpoint);
        const resolvedBody = step.body ? resolvePlaceholders(step.body) : undefined;
        const resolvedQuery = step.queryParams ? resolvePlaceholders(step.queryParams) : undefined;

        // Construir URL final
        let url = `${server.api_base_url.replace(/\/$/, '')}/${resolvedEndpoint.replace(/^\//, '')}`;
        if (resolvedQuery && Object.keys(resolvedQuery).length > 0) {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(resolvedQuery)) {
            params.append(k, String(v));
          }
          url += `?${params.toString()}`;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        // Adiciona headers de autenticação se houver perfil ativo
        const profileId = step.authProfileId || 'none';
        if (profileId !== 'none' && server.auth_credentials?.profiles) {
          const prof = server.auth_credentials.profiles.find((p: any) => p.id === profileId);
          if (prof?.token) {
            headers['Authorization'] = `Bearer ${prof.token}`;
          }
        }

        const fetchOptions: RequestInit = {
          method: step.method.toUpperCase(),
          headers,
        };

        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(step.method.toUpperCase()) && resolvedBody) {
          fetchOptions.body = JSON.stringify(resolvedBody);
        }

        const res = await fetch(url, fetchOptions);
        const latency = Date.now() - stepStart;

        let responseData: any = null;
        const text = await res.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }

        const success = res.ok;

        results.push({
          requestId: step.requestId,
          status: res.status,
          success,
          latencyMs: latency,
          data: success ? responseData : null,
          error: success ? null : responseData || `Status ${res.status}`
        });

        resultsMap.set(step.requestId, responseData);

        if (!success) {
          status = 'failed';
          break;
        }
      } catch (err: any) {
        const latency = Date.now() - stepStart;
        results.push({
          requestId: step.requestId,
          status: 500,
          success: false,
          latencyMs: latency,
          data: null,
          error: err.message
        });
        status = 'failed';
        break;
      }
    }

    const totalDuration = Date.now() - startTime;

    // 4. Salva o Test Run no Supabase
    const { data: testRun, error: testRunErr } = await supabase
      .from('mcp_test_runs')
      .insert([{
        test_case_id: testCaseId,
        status,
        duration_ms: totalDuration,
        results
      }])
      .select()
      .single();

    if (testRunErr) {
      console.error('Erro ao registrar histórico de teste:', testRunErr);
    }

    // 5. Atualiza o Test Case com o resultado da última rodada
    await supabase
      .from('mcp_test_cases')
      .update({
        last_run_status: status,
        last_run_at: new Date().toISOString()
      })
      .eq('id', testCaseId);

    return NextResponse.json({
      success: true,
      testCaseId,
      status,
      durationMs: totalDuration,
      steps: results,
      testRun
    });

  } catch (err: any) {
    console.error('Erro na execução do caso de teste no Next:', err);
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
