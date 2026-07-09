import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runTestCase } from "@mcps/openapi-engine/qa";

export async function POST(request: Request) {
  try {
    const { serverId, testCaseId, variablesOverride } = await request.json();

    if (!serverId || !testCaseId) {
      return NextResponse.json(
        { error: "Parâmetros serverId e testCaseId são obrigatórios." },
        { status: 400 },
      );
    }

    const { data: server, error: serverErr } = await supabase
      .from("mcp_servers")
      .select("*")
      .eq("id", serverId)
      .single();

    if (serverErr || !server) {
      return NextResponse.json({ error: "Servidor não encontrado." }, { status: 404 });
    }

    const { data: testCase, error: testCaseErr } = await supabase
      .from("mcp_test_cases")
      .select("*")
      .eq("id", testCaseId)
      .eq("server_id", serverId)
      .single();

    if (testCaseErr || !testCase) {
      return NextResponse.json({ error: "Caso de teste não encontrado." }, { status: 404 });
    }

    const result = await runTestCase(server, testCase, {
      variablesOverride: variablesOverride ?? {},
      mode: "fetch",
      persist: true,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("Erro na execução do caso de teste:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
