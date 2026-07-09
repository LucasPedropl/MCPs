'use client';

import React, { useRef, useState } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import {
  EMPTY_PROJECT_FORM,
  formToPayload,
  type ProjectFormState,
} from '@/features/agent-os/types/project';

const TYPE_OPTIONS = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'fullstack', label: 'Fullstack' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Arquivado' },
];

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm';

interface ProjectEditorProps {
  projectId?: string;
  initialForm?: ProjectFormState;
  onSaved?: (id: string) => void;
}

export function ProjectEditor({ projectId, initialForm = EMPTY_PROJECT_FORM, onSaved }: ProjectEditorProps) {
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProjectFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [syncingGh, setSyncingGh] = useState(false);
  const [syncingVc, setSyncingVc] = useState(false);
  const [uploading, setUploading] = useState(false);

  const setField = (key: keyof ProjectFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        projectId ? `/api/agent-os/projects/${projectId}` : '/api/agent-os/projects',
        {
          method: projectId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formToPayload(form)),
        },
      );
      const json = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok) {
        addToast(json.error ?? 'Falha ao salvar', 'error');
        return;
      }
      addToast('Projeto salvo', 'success');
      if (json.project?.id) onSaved?.(json.project.id);
    } catch (err: unknown) {
      console.error('Falha ao salvar projeto:', err);
      addToast('Falha ao salvar projeto', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncGithub = async () => {
    if (!projectId) return;
    setSyncingGh(true);
    try {
      const res = await fetch(`/api/agent-os/projects/${projectId}/sync-github`, { method: 'POST' });
      const json = (await res.json()) as { ok?: boolean; hint?: string; project?: { docs_md?: string } };
      if (json.project?.docs_md) setField('docs_md', json.project.docs_md);
      addToast(json.ok ? 'Sync GitHub concluído' : (json.hint ?? 'Sync parcial'), json.ok ? 'success' : 'info');
    } catch (err: unknown) {
      console.error('Sync GitHub:', err);
      addToast('Falha no sync GitHub', 'error');
    } finally {
      setSyncingGh(false);
    }
  };

  const handleSyncVercel = async () => {
    if (!projectId) return;
    setSyncingVc(true);
    try {
      const res = await fetch(`/api/agent-os/projects/${projectId}/sync-vercel`, { method: 'POST' });
      const json = (await res.json()) as {
        ok?: boolean;
        hint?: string;
        project?: { deploy_url?: string | null; docs_md?: string };
      };
      if (json.project?.deploy_url) setField('deploy_url', json.project.deploy_url);
      if (json.project?.docs_md) setField('docs_md', json.project.docs_md);
      addToast(json.ok ? 'Sync Vercel concluído' : (json.hint ?? 'Sync parcial'), json.ok ? 'success' : 'info');
    } catch (err: unknown) {
      console.error('Sync Vercel:', err);
      addToast('Falha no sync Vercel', 'error');
    } finally {
      setSyncingVc(false);
    }
  };

  const handleUploadCover = async (file: File) => {
    if (!projectId) {
      addToast('Salve o projeto antes de enviar a capa', 'info');
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? '');
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/agent-os/projects/${projectId}/upload-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mime_type: file.type }),
      });
      const json = (await res.json()) as { cover_image_url?: string; error?: string };
      if (!res.ok) {
        addToast(json.error ?? 'Falha no upload', 'error');
        return;
      }
      if (json.cover_image_url) setField('cover_image_url', json.cover_image_url);
      addToast('Capa enviada', 'success');
    } catch (err: unknown) {
      console.error('Upload capa:', err);
      addToast('Falha no upload da capa', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span>Título</span>
          <input className={inputClass} value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Slug</span>
          <input className={inputClass} value={form.slug} onChange={(e) => setField('slug', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Descrição</span>
          <textarea className={`${inputClass} min-h-20`} value={form.description} onChange={(e) => setField('description', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Título EN</span>
          <input className={inputClass} value={form.title_en} onChange={(e) => setField('title_en', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Tags (vírgula)</span>
          <input className={inputClass} value={form.tags} onChange={(e) => setField('tags', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Tipo</span>
          <SearchableSelect options={TYPE_OPTIONS} value={form.type} onChange={(v) => setField('type', v)} placeholder="Tipo" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Status</span>
          <SearchableSelect options={STATUS_OPTIONS} value={form.status} onChange={(v) => setField('status', v)} placeholder="Status" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Workspace path</span>
          <input className={inputClass} value={form.workspace_path} onChange={(e) => setField('workspace_path', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>GitHub URL</span>
          <input className={inputClass} value={form.github_url} onChange={(e) => setField('github_url', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Deploy URL</span>
          <input className={inputClass} value={form.deploy_url} onChange={(e) => setField('deploy_url', e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setField('featured', e.target.checked)} />
          Destaque no portfólio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.portfolio_visible} onChange={(e) => setField('portfolio_visible', e.target.checked)} />
          Visível no portfólio
        </label>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <h2 className="text-sm font-medium">Capa</h2>
        {form.cover_image_url && (
          <img src={form.cover_image_url} alt="Capa" className="w-32 h-32 object-cover rounded-lg border" />
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUploadCover(file);
        }} />
        <Button size="sm" variant="secondary" isLoading={uploading} onClick={() => fileRef.current?.click()}>
          Enviar capa
        </Button>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleSave} isLoading={saving}>Salvar</Button>
          {projectId && (
            <>
              <Button size="sm" variant="secondary" onClick={handleSyncGithub} isLoading={syncingGh}>Sync GitHub</Button>
              <Button size="sm" variant="secondary" onClick={handleSyncVercel} isLoading={syncingVc}>Sync Vercel</Button>
            </>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Documentação (markdown)</h2>
        <textarea className={`${inputClass} min-h-64 font-mono text-xs`} value={form.docs_md} onChange={(e) => setField('docs_md', e.target.value)} />
      </section>
    </div>
  );
}
