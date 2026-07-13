import { NextRequest, NextResponse } from 'next/server';
import { getAgentOsDb } from '@/lib/agent-os-db';

export async function GET() {
	const db = getAgentOsDb();
	if (!db) return NextResponse.json({ configured: false, items: [] });

	const { data, error } = await db
		.from('agent_decisions')
		.select('*')
		.order('created_at', { ascending: false });

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ configured: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
	const db = getAgentOsDb();
	if (!db)
		return NextResponse.json(
			{ error: 'Supabase não configurado' },
			{ status: 503 },
		);

	const body = (await request.json()) as Record<string, unknown>;
	const row = {
		project: (body.project as string | null) ?? null,
		topic: String(body.topic ?? ''),
		problem: (body.problem as string | null) ?? null,
		chosen_option: String(body.chosen_option ?? ''),
		rationale: (body.rationale as string | null) ?? null,
		workspace_path: (body.workspace_path as string | null) ?? null,
	};

	if (!row.topic || !row.chosen_option) {
		return NextResponse.json(
			{ error: 'topic e chosen_option são obrigatórios' },
			{ status: 400 },
		);
	}

	const { data, error } = await db
		.from('agent_decisions')
		.insert(row)
		.select()
		.single();
	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
	const db = getAgentOsDb();
	if (!db)
		return NextResponse.json(
			{ error: 'Supabase não configurado' },
			{ status: 503 },
		);

	const body = (await request.json()) as Record<string, unknown>;
	const id = body.id as string | undefined;
	if (!id)
		return NextResponse.json(
			{ error: 'id é obrigatório' },
			{ status: 400 },
		);

	const updates: Record<string, unknown> = {};
	if (body.topic !== undefined) updates.topic = String(body.topic);
	if (body.chosen_option !== undefined)
		updates.chosen_option = String(body.chosen_option);
	if (body.project !== undefined)
		updates.project = (body.project as string | null) || null;
	if (body.problem !== undefined)
		updates.problem = (body.problem as string | null) ?? null;
	if (body.rationale !== undefined)
		updates.rationale = (body.rationale as string | null) ?? null;
	if (body.workspace_path !== undefined)
		updates.workspace_path = (body.workspace_path as string | null) ?? null;

	const { data, error } = await db
		.from('agent_decisions')
		.update(updates)
		.eq('id', id)
		.select()
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
	const db = getAgentOsDb();
	if (!db)
		return NextResponse.json(
			{ error: 'Supabase não configurado' },
			{ status: 503 },
		);

	const id = request.nextUrl.searchParams.get('id');
	if (!id)
		return NextResponse.json(
			{ error: 'id é obrigatório' },
			{ status: 400 },
		);

	const { error } = await db.from('agent_decisions').delete().eq('id', id);
	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ ok: true });
}
