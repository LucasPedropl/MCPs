import { NextResponse } from "next/server";
import { parseSwaggerUrl } from "@mcps/openapi-engine/sync";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL inválida fornecida." }, { status: 400 });
    }

    const result = await parseSwaggerUrl(url);

    return NextResponse.json({
      title: result.title,
      baseUrl: result.baseUrl,
      swaggerUrl: result.swaggerUrl,
      tools: result.tools,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno ao processar o Swagger.";
    console.error("Erro no parse Swagger:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
