'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { ProjectEditor } from '@/features/agent-os/components/ProjectEditor';

export default function NewProjectPage() {
  const router = useRouter();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/agent-os/projects" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar aos projetos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="w-6 h-6" /> Novo projeto
        </h1>
      </header>
      <ProjectEditor onSaved={(id) => router.push(`/agent-os/projects/${id}`)} />
    </div>
  );
}
