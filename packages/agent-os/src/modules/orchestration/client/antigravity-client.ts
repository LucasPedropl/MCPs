import { Agent, request } from "undici";
import type { AntigravityInstance, ConnectError } from "./types.js";

const SERVICE_PATH = "exa.language_server_pb.LanguageServerService";

const insecureAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});
export class AntigravityClient {
  private readonly baseUrl: string;
  private readonly csrfToken: string;

  constructor(instance: AntigravityInstance) {
    const protocol = instance.secure ? "https" : "http";
    this.baseUrl = `${protocol}://127.0.0.1:${instance.port}`;
    this.csrfToken = instance.csrfToken;
  }

  async call<T>(method: string, body: object = {}): Promise<T> {
    const url = `${this.baseUrl}/${SERVICE_PATH}/${method}`;

    const { statusCode, body: responseBody } = await request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "x-codeium-csrf-token": this.csrfToken,
      },
      body: JSON.stringify(body),
      headersTimeout: 120_000,
      bodyTimeout: 120_000,
      ...(this.baseUrl.startsWith("https") ? { dispatcher: insecureAgent } : {}),
    });
    const text = await responseBody.text();

    if (statusCode !== 200) {
      let error: ConnectError;
      try {
        error = JSON.parse(text) as ConnectError;
      } catch {
        error = { code: "unknown", message: text };
      }
      throw new AntigravityApiError(method, statusCode, error);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }

  get url(): string {
    return this.baseUrl;
  }
}

export class AntigravityApiError extends Error {
  constructor(
    public readonly method: string,
    public readonly statusCode: number,
    public readonly error: ConnectError,
  ) {
    super(`API error on ${method} (${statusCode}): ${error.message}`);
    this.name = "AntigravityApiError";
  }
}
