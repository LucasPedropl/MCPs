'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { AgentProject } from '@/features/agent-os/types/project';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AgentProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/agent-os/projects')
      .then((r) => r.json())
      .then((data: { items?: AgentProject[] }) => setProjects(data.items ?? []))
      .catch((err: unknown) => console.error('Falha ao carregar projetos:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2">
            <FolderKanban className="w-6 h-6" /> Projetos
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Registry unificado — portfólio, workspace e documentação.
          </p>
        </div>
        <Link href="/agent-os/projects/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> Novo projeto
          </Button>
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum projeto cadastrado.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/agent-os/projects/${project.id}`}
              className="rounded-lg border border-subtle p-4 hover:border-strong transition-colors space-y-3"
            >
              <div className="flex gap-3">
                {project.cover_image_url ? (
                  <img
                    src={project.cover_image_url}
                    alt={project.title}
                    className="w-16 h-16 rounded-lg object-cover border border-subtle"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-elevated border border-subtle" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{project.title}</p>
                    {project.featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-ink-muted font-mono truncate">{project.slug}</p>
                  <p className="text-xs mt-1 capitalize">{project.status}</p>
                </div>
              </div>
              <p className="text-sm text-ink-muted line-clamp-2">
                {project.description || 'Sem descrição'}
              </p>
              <div className="flex flex-wrap gap-1">
                {project.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-elevated">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
