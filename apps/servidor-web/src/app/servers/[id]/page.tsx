import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyServerRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/agent-os/mcp-servers/${id}`);
}
