'use client';

import React, { useState } from 'react';
import { useSwaggerIngestion } from '@/features/swagger/hooks/useSwaggerIngestion';
import { useServers, useCreateServer } from '@/features/servers/hooks/useServers';
import { useSaveToolsBatch } from '@/features/tools/hooks/useTools';
import { SwaggerInputForm } from '@/features/swagger/components/SwaggerInputForm';
import { SwaggerIngestionModal } from '@/features/swagger/components/SwaggerIngestionModal';
import { ServersList } from '@/features/servers/components/ServersList';
import { ToolsReviewSection } from '@/features/tools/components/ToolsReviewSection';
import { CreateMcpServerInput } from '@/features/servers/schemas/serverSchema';
import { CreateMcpToolInput } from '@/features/tools/schemas/toolSchema';
import { Server, Cpu } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function McpServersPage() {
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { parsedData: parsedSwagger, isLoading: isIngesting, ingestUrl, reset: resetIngestion } = useSwaggerIngestion();
  const { servers, isLoading: isLoadingServers, removeServer, refetch: refetchServers } = useServers();
  const { createServer, isCreating: isCreatingServer } = useCreateServer();
  const { saveBatch: saveToolsBatch, isSaving: isToolsSaving } = useSaveToolsBatch();

  const onSubmitUrl = async (url: string) => {
    await ingestUrl(url);
    setIsModalOpen(false);
  };

  const handleCancelReview = () => {
    resetIngestion();
  };

  const handleConfirmReview = async (serverInput: CreateMcpServerInput, toolsInput: Omit<CreateMcpToolInput, 'server_id'>[]) => {
    try {
      const newServer = await createServer(serverInput);
      const fullTools: CreateMcpToolInput[] = toolsInput.map((t) => ({
        ...t,
        server_id: newServer.id,
      }));

      await saveToolsBatch(fullTools);
      resetIngestion();
      await refetchServers();
      addToast('Servidor criado. Use register_mcp_servers no agent-os para conectar ao hub.', 'success');
    } catch (err) {
      console.error('Falha ao criar servidor:', err);
      addToast('Falha ao salvar servidor', 'error');
    }
  };

  const handleDeleteServer = async (id: string) => {
    await removeServer(id);
    await refetchServers();
  };

  return (
    <main className="flex-1 flex flex-col gap-8 max-w-7xl w-full mx-auto animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-accent-muted ring-1 ring-accent/30 text-accent">
            <Cpu className="w-6 h-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">APIs OpenAPI → MCP</h1>
            <p className="text-sm text-ink-muted">
              Cadastre Swagger, configure auth e exponha via hub do Agent OS (sem mcp.json por API).
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-fg font-medium text-sm hover:opacity-90 transition-colors shadow-sm self-start md:self-auto"
        >
          <Server className="w-4 h-4" /> Importar Swagger
        </button>
      </header>

      <div className="rounded-lg border border-subtle bg-elevated p-4 text-xs text-ink-muted">
        Após criar um servidor, peça ao agente:{' '}
        <code className="font-mono bg-elevated px-1 rounded">register_mcp_servers</code>{' '}
        ou{' '}
        <code className="font-mono bg-elevated px-1 rounded">sync_openapi_mcp</code>{' '}
        com o server_id.
      </div>

      <SwaggerIngestionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-ink">
            Cole a URL da documentação OpenAPI ou Swagger (JSON/YAML)
          </h4>
          <SwaggerInputForm onSubmitUrl={onSubmitUrl} isLoading={isIngesting} />
        </div>
      </SwaggerIngestionModal>

      {parsedSwagger && (
        <section className="animate-in fade-in duration-300">
          <ToolsReviewSection
            parsedData={parsedSwagger}
            onCancel={handleCancelReview}
            onConfirmSave={handleConfirmReview}
            isSaving={isCreatingServer || isToolsSaving}
          />
        </section>
      )}

      <ServersList
        servers={servers}
        isLoading={isLoadingServers}
        onDeleteServer={handleDeleteServer}
      />
    </main>
  );
}
