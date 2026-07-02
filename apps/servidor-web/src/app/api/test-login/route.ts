import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { loginUrl, method, payload, tokenPath } = body;

    if (!loginUrl) {
      return NextResponse.json({ error: 'URL de login é obrigatória.' }, { status: 400 });
    }

    let parsedPayload: any = null;
    if (payload) {
      try {
        parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch (e) {
        return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
      }
    }

    const res = await fetch(loginUrl, {
      method: (method || 'POST').toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: parsedPayload ? JSON.stringify(parsedPayload) : null,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Falha no Login (${res.status} ${res.statusText}): ${errText}` }, { status: res.status });
    }

    const data = await res.json();

    const pathParts = (tokenPath || 'token').split('.');
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
      return NextResponse.json({ 
        error: `Token não encontrado no caminho "${tokenPath}". Resposta da API: ${JSON.stringify(data)}`,
        rawResponse: data 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, token, rawResponse: data });
  } catch (err: any) {
    return NextResponse.json({ error: `Erro interno no servidor: ${err.message}` }, { status: 500 });
  }
}
