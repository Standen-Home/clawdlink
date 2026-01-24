import WebSocket from "ws";
import { randomUUID } from "node:crypto";

function buildWsUrl({ host, port, token }) {
  // Gateway WS endpoint uses the same port as Control UI.
  // Token auth is passed as a query param.
  const url = new URL(`ws://${host}:${port}/ws`);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendChatMessage({ host, port, token, sessionKey, message, deliver = true }) {
  const wsUrl = buildWsUrl({ host, port, token });

  const ws = new WebSocket(wsUrl);

  const runId = randomUUID();
  const idem = randomUUID();

  const payload = {
    type: "request",
    id: runId,
    method: "chat.send",
    params: {
      sessionKey,
      message,
      deliver,
      idempotencyKey: idem,
    },
  };

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WS connect timeout")), 5000);
    ws.on("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.on("error", reject);
  });

  ws.send(JSON.stringify(payload));

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No response from gateway")), 10000);
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === "response" && msg?.id === runId) {
          clearTimeout(timeout);
          if (msg.ok) resolve();
          else reject(new Error(msg?.error?.message || "gateway error"));
          ws.close();
        }
      } catch {
        // ignore
      }
    });
    ws.on("error", reject);
  });
}
