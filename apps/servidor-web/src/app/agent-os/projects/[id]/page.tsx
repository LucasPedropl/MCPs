'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FolderKanban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ProjectEditor } from '@/features/agent-os/components/ProjectEditor';
import { projectToForm, type AgentProject } from '@/features/agent-os/types/project';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const projectId = params?.id as string;
  const [project, setProject] = useState<AgentProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void fetch(`/api/agent-os/projects/${projectId}`)
      .then((r) => r.json())
      .then((data: { project?: AgentProject; error?: string }) => setProject(data.project ?? null))
      .catch((err: unknown) => console.error('Falha ao carregar projeto:', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDelete = async () => {
    if (!projectId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agent-os/projects/${projectId}?remove_cover=true`, { method: 'DELETE' });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(json.error ?? 'Falha ao excluir', 'error');
        return;
      }
      addToast('Projeto excluído', 'success');
      router.push('/agent-os/projects');
    } catch (err: unknown) {
      console.error('Falha ao excluir:', err);
      addToast('Falha ao excluir projeto', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/agent-os/projects" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar aos projetos
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6" /> {project?.title ?? 'Projeto'}
          </h1>
          {projectId && (
            <Button size="sm" variant="danger" isLoading={deleting} onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          )}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : !project ? (
        <p className="text-sm text-zinc-500">Projeto não encontrado.</p>
      ) : (
        <ProjectEditor projectId={projectId} initialForm={projectToForm(project)} />
      )}
    </div>
  );
}
