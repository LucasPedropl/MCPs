import { execSync } from "node:child_process";
import * as http from "node:http";
import * as https from "node:https";
import type { AntigravityInstance } from "./types.js";

const LS_SERVICE = "exa.language_server_pb.LanguageServerService";

export function probePort(
  port: number,
  csrfToken: string,
  secure: boolean,
  timeoutMs = 2_000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const bodyBuf = Buffer.from("{}", "utf8");
    const requestOptions = {
      hostname: "127.0.0.1",
      port,
      path: `/${LS_SERVICE}/Heartbeat`,
      method: "POST",
      headers: {
        "x-codeium-csrf-token": csrfToken,
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "Content-Length": bodyBuf.length,
      },
      rejectUnauthorized: false,
    };

    const requestFactory = secure ? https.request : http.request;
    const req = requestFactory(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text.trim().startsWith("{") || (res.statusCode ?? 0) === 200);
      });
      res.on("error", () => resolve(false));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
    req.write(bodyBuf);
    req.end();
  });
}

function parseListeningPortsFromNetstat(output: string, pid: number): number[] {
  const ports = new Set<number>();
  const pidSuffix = new RegExp(`\\s${pid}\\s*$`);

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("LISTENING") || !pidSuffix.test(line.trimEnd())) {
      continue;
    }

    const match = line.match(/127\.0\.0\.1:(\d+)/);
    if (match?.[1]) {
      ports.add(Number.parseInt(match[1], 10));
    }
  }

  return [...ports].sort((a, b) => a - b);
}

export function getListeningPortsForPid(pid: number): number[] {
  if (!Number.isFinite(pid) || pid <= 0) {
    return [];
  }

  try {
    if (process.platform === "win32") {
      const output = execSync("netstat -ano", {
        encoding: "utf8",
        timeout: 5_000,
        windowsHide: true,
      });
      return parseListeningPortsFromNetstat(output, pid);
    }

    const output = execSync(`lsof -Pan -p ${pid} -iTCP -sTCP:LISTEN`, {
      encoding: "utf8",
      timeout: 5_000,
    });

    const ports = new Set<number>();
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/127\.0\.0\.1:(\d+)/) ?? line.match(/:\d+->.*?:(\d+)/);
      if (match?.[1]) {
        ports.add(Number.parseInt(match[1], 10));
      }
    }
    return [...ports].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function buildPortCandidates(
  raw: Omit<AntigravityInstance, "port" | "secure">,
): Array<{ port: number; secure: boolean }> {
  const seen = new Set<string>();
  const candidates: Array<{ port: number; secure: boolean }> = [];

  const add = (port: number, secure: boolean) => {
    const key = `${port}:${secure ? "s" : "h"}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ port, secure });
    }
  };

  for (const port of getListeningPortsForPid(raw.pid)) {
    add(port, false);
    add(port, true);
  }

  if (raw.httpsServerPort) {
    add(raw.httpsServerPort, true);
  }

  for (let delta = 1; delta <= 20; delta += 1) {
    add(raw.extensionServerPort + delta, true);
    add(raw.extensionServerPort + delta, false);
  }

  return candidates;
}

export async function resolveLanguageServerPort(
  raw: Omit<AntigravityInstance, "port" | "secure">,
): Promise<{ port: number; secure: boolean }> {
  for (const candidate of buildPortCandidates(raw)) {
    const ok = await probePort(candidate.port, raw.csrfToken, candidate.secure);
    if (ok) {
      return candidate;
    }
  }

  const boundPorts = getListeningPortsForPid(raw.pid);
  throw new Error(
    `Language server pid ${raw.pid} sem porta HTTP respondendo. ` +
      `extension_port=${raw.extensionServerPort}, portas locais=${boundPorts.join(", ") || "nenhuma"}.`,
  );
}
