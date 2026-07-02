'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toolsBatchFormSchema, ToolsBatchFormData, CreateMcpToolInput } from '../schemas/toolSchema';
import { CreateMcpServerInput } from '@/features/servers/schemas/serverSchema';
import { ToolEditRow } from './ToolEditRow';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CheckCheck, X, Server, Shield } from 'lucide-react';

interface ToolsReviewSectionProps {
  parsedData: {
    title: string;
    baseUrl: string;
    swaggerUrl: string;
    tools: Array<{
      originalName: string;
      customName: string;
      customDescription?: string;
      httpMethod: string;
      endpointPath: string;
      parametersSchema: any;
    }>;
  };
  onCancel: () => void;
  onConfirmSave: (serverInput: CreateMcpServerInput, toolsInput: Omit<CreateMcpToolInput, 'server_id'>[]) => Promise<void>;
  isSaving: boolean;
}

export function ToolsReviewSection({ parsedData, onCancel, onConfirmSave, isSaving }: ToolsReviewSectionProps) {
  const [serverName, setServerName] = useState(parsedData.title || 'Meu Servidor MCP');
  const [authType, setAuthType] = useState<'none' | 'dashboard_login' | 'autonomous'>('none');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ToolsBatchFormData>({
    resolver: zodResolver(toolsBatchFormSchema),
    defaultValues: {
      tools: parsedData.tools.map((t) => ({
        original_name: t.originalName,
        custom_name: t.customName,
        custom_description: t.customDescription || '',
        http_method: t.httpMethod,
        endpoint_path: t.endpointPath,
        parameters_schema: t.parametersSchema,
      })),
    },
  });

  useEffect(() => {
    reset({
      tools: parsedData.tools.map((t) => ({
        original_name: t.originalName,
        custom_name: t.customName,
        custom_description: t.customDescription || '',
        http_method: t.httpMethod,
        endpoint_path: t.endpointPath,
        parameters_schema: t.parametersSchema,
      })),
    });
    setServerName(parsedData.title || 'Meu Servidor MCP');
  }, [parsedData, reset]);

  const handleFormSubmit = async (data: ToolsBatchFormData) => {
    const serverInput: CreateMcpServerInput = {
      name: serverName,
      swagger_url: parsedData.swaggerUrl,
      api_base_url: parsedData.baseUrl,
      auth_type: authType,
      auth_credentials: {},
    };

    const toolsInput = data.tools.map((t) => ({
      original_name: t.original_name,
      custom_name: t.custom_name,
      custom_description: t.custom_description || '',
      http_method: t.http_method,
      endpoint_path: t.endpoint_path,
      parameters_schema: t.parameters_schema,
    }));

    await onConfirmSave(serverInput, toolsInput);
  };

  const authOptions = [
    { value: 'none', label: 'Sem Autenticacao (Aberta)' },
    { value: 'dashboard_login', label: 'Login Gerenciado pelo Painel (Recomendado)' },
    { value: 'autonomous', label: 'IA Autonoma (Gerencia proprio login)' },
  ];

  return (
    <Card className="w-full border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 dark:backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 transition-colors">
      <CardHeader className="border-b border-zinc-200 dark:border-zinc-800/60 pb-6 mb-6 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-zinc-900 dark:text-white flex items-center gap-2 transition-colors">
              <CheckCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              Revisar e Concluir Servidor MCP
            </CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">
              Foram extraidas <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{parsedData.tools.length} ferramentas</strong>. Ajuste os nomes e instrucoes que serao passados para a IA.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit(handleFormSubmit)} isLoading={isSaving}>
              <Server className="w-4 h-4 mr-1" /> Concluir e Salvar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 transition-colors">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5 transition-colors">
              <Server className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" /> Nome do Servidor MCP
            </label>
            <Input
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Ex: Servidor Lojas VLKS"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5 transition-colors">
              <Shield className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" /> Tipo de Autenticacao Base
            </label>
            <SearchableSelect
              options={authOptions}
              value={authType}
              onChange={(val: any) => setAuthType(val)}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white px-1 transition-colors">Ferramentas (Tools) Mapeadas</h4>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {parsedData.tools.map((tool, idx) => (
              <ToolEditRow
                key={idx}
                index={idx}
                originalName={tool.originalName}
                httpMethod={tool.httpMethod}
                endpointPath={tool.endpointPath}
                register={register}
                errors={errors}
              />
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-zinc-200 dark:border-zinc-800/60 pt-6 mt-6 flex justify-end gap-3 transition-colors">
        <Button variant="ghost" size="md" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button variant="primary" size="md" onClick={handleSubmit(handleFormSubmit)} isLoading={isSaving}>
          Salvar Servidor MCP
        </Button>
      </CardFooter>
    </Card>
  );
}
