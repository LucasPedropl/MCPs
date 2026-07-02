import { ParsedSwagger } from '../schemas/swaggerSchema';

export async function parseSwaggerUrlService(swaggerUrl: string): Promise<ParsedSwagger> {
  const response = await fetch('/api/parse-swagger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: swaggerUrl }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Falha ao processar a documentacao da API.');
  }

  return data as ParsedSwagger;
}
