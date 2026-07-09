'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { HubModal } from './HubModal';
import type { CachedTool, HubConnection } from '../types/hub';

interface ToolsExplorerModalProps {
  connection: HubConnection | null;
  onClose: () => void;
}

function ToolRow({ tool }: { tool: CachedTool }) {
  const [expanded, setExpanded] = useState(false);
  const extraKeys = Object.keys(tool).filter((k) => !['name', 'description'].includes(k));

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-2 p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium">{tool.name}</p>
          {tool.description && <p className="text-xs text-zinc-500 mt-0.5">{tool.description}</p>}
        </div>
      </button>
      {expanded && (
        <pre className="text-xs overflow-x-auto bg-zinc-100 dark:bg-black p-3 border-t border-zinc-200 dark:border-zinc-800">
          {JSON.stringify(extraKeys.length > 0 ? tool : { name: tool.name, description: tool.description }, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function ToolsExplorerModal({ connection, onClose }: ToolsExplorerModalProps) {
  const tools = connection?.tool_cache_json ?? [];

  return (
    <HubModal
      isOpen={Boolean(connection)}
      onClose={onClose}
      title={`Tools — ${connection?.alias ?? ''}`}
      description={`${tools.length} tool(s) em cache`}
      maxWidth="xl"
    >
      {tools.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma tool em cache. Use refresh_mcp_health no agent-os.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {tools.map((tool) => (
            <ToolRow key={tool.name} tool={tool} />
          ))}
        </div>
      )}
    </HubModal>
  );
}
