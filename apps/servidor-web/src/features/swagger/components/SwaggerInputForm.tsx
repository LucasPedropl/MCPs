'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { swaggerInputSchema, SwaggerInputFormData } from '../schemas/swaggerSchema';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Link2 } from 'lucide-react';

interface SwaggerInputFormProps {
  onSubmitUrl: (url: string) => Promise<void>;
  isLoading: boolean;
}

export function SwaggerInputForm({ onSubmitUrl, isLoading }: SwaggerInputFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SwaggerInputFormData>({
    resolver: zodResolver(swaggerInputSchema),
    defaultValues: {
      swaggerUrl: 'https://lojas.vlks.com.br/swagger/v1/swagger.json',
    },
  });

  const handleFormSubmit = async (data: SwaggerInputFormData) => {
    await onSubmitUrl(data.swaggerUrl);
  };

  return (
    <Card className="max-w-2xl w-full mx-auto bg-[#050505]">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2 text-white">
          <Link2 className="w-5 h-5 text-zinc-400" />
          Conectar Especificacao OpenAPI / Swagger
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Insira o link direto do arquivo JSON do Swagger para gerarmos as ferramentas do servidor MCP dinamicamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              {...register('swaggerUrl')}
              placeholder="https://exemplo.com/swagger.json"
              error={errors.swaggerUrl?.message}
              disabled={isLoading}
              icon={<Link2 className="w-4 h-4" />}
            />
          </div>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="sm:w-auto w-full">
            {isLoading ? 'Analisando...' : 'Iniciar Analise'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
