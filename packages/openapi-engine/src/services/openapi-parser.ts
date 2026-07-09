export interface ParsedTool {
  originalName: string;
  customName: string;
  customDescription: string;
  httpMethod: string;
  endpointPath: string;
  parametersSchema: Record<string, unknown>;
}

export interface ParsedSwaggerResult {
  title: string;
  baseUrl: string;
  swaggerUrl: string;
  tools: ParsedTool[];
}

/** Parse OpenAPI/Swagger JSON into tool definitions (single source of truth). */
export function parseOpenApiPaths(data: Record<string, unknown>): ParsedTool[] {
  const freshTools: ParsedTool[] = [];
  const paths = (data["paths"] as Record<string, unknown>) ?? {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const [methodKey, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "delete", "patch"].includes(methodKey.toLowerCase())) {
        continue;
      }

      const op = operation as Record<string, unknown>;
      const method = methodKey.toUpperCase();
      const cleanPath = pathKey
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      const originalName = op["operationId"]
        ? String(op["operationId"])
        : `${method.toLowerCase()}_${cleanPath}`;

      const paramsSchema: Record<string, unknown> = {
        type: "object",
        properties: {},
        required: [],
      };
      const properties = paramsSchema["properties"] as Record<string, unknown>;
      const required = paramsSchema["required"] as string[];

      const parameters = op["parameters"];
      if (Array.isArray(parameters)) {
        for (const param of parameters) {
          const p = param as Record<string, unknown>;
          const name = p["name"];
          if (typeof name !== "string") {
            continue;
          }
          const schema = p["schema"] as Record<string, unknown> | undefined;
          properties[name] = {
            type: schema?.["type"] ?? "string",
            description: p["description"] ?? "",
            in: p["in"],
          };
          if (p["required"]) {
            required.push(name);
          }
        }
      }

      const requestBody = op["requestBody"] as Record<string, unknown> | undefined;
      const content = requestBody?.["content"] as Record<string, unknown> | undefined;
      if (content) {
        const jsonContent = content["application/json"] as Record<string, unknown> | undefined;
        const multipartContent = content["multipart/form-data"] as
          | Record<string, unknown>
          | undefined;
        const formUrlContent = content["application/x-www-form-urlencoded"] as
          | Record<string, unknown>
          | undefined;
        const bodyContent = jsonContent ?? multipartContent ?? formUrlContent;
        const bodySchema = bodyContent?.["schema"];
        if (bodySchema) {
          properties["body"] = bodySchema;
          required.push("body");
          if (multipartContent) {
            paramsSchema["contentType"] = "multipart/form-data";
          } else if (formUrlContent) {
            paramsSchema["contentType"] = "application/x-www-form-urlencoded";
          } else {
            paramsSchema["contentType"] = "application/json";
          }
        }
      }

      freshTools.push({
        originalName,
        customName: originalName,
        customDescription: String(
          op["summary"] ?? op["description"] ?? `Chamada ${method} para ${pathKey}`,
        ),
        httpMethod: method,
        endpointPath: pathKey,
        parametersSchema: paramsSchema,
      });
    }
  }

  return freshTools;
}

/** Fetch and parse a Swagger/OpenAPI URL. */
export async function parseSwaggerUrl(url: string): Promise<ParsedSwaggerResult> {
  const { fetch } = await import("undici");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar Swagger (status ${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (!data["openapi"] && !data["swagger"]) {
    throw new Error("JSON retornado não parece OpenAPI/Swagger válido.");
  }

  const info = data["info"] as Record<string, unknown> | undefined;
  const title = String(info?.["title"] ?? "API_Sem_Titulo");

  let baseUrl = "";
  const servers = data["servers"] as Array<Record<string, unknown>> | undefined;
  if (servers && servers.length > 0 && typeof servers[0]?.["url"] === "string") {
    baseUrl = servers[0]["url"];
  } else {
    const urlObj = new URL(url);
    baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  }

  return {
    title,
    baseUrl,
    swaggerUrl: url,
    tools: parseOpenApiPaths(data),
  };
}
