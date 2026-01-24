import WebSocket from "ws";
import { randomUUID } from "node:crypto";

function buildWsUrl({ host, port }) {
  // Gateway WS runs on the same port as Control UI.
  // Path does not matter, the server accepts upgrades on any path.
  return `ws://${host}:${port}/`;
}

async function connectWithToken(ws, { token }) {
  // The server sends an initial connect.challenge event. We do not need the nonce
  // for token-auth loopback connections, but we wait for it so we know the socket is alive.
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No connect.challenge from gateway")), 5000);
    const onMessage = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === "event" && msg?.event === "connect.challenge") {
          clearTimeout(timeout);
          ws.off("message", onMessage);
          resolve();
        }
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
    ws.on("error", reject);
  });

  const connectReqId = randomUUID();

  ws.send(
    JSON.stringify({
      type: "req",
      id: connectReqId,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "clawdlink",
          version: "0.1.0",
          platform: "node",
          mode: "cli",
        },
        auth: { token }
      },
    })
  );

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No connect response from gateway")), 5000);
    const onMessage = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === "res" && msg?.id === connectReqId) {
          clearTimeout(timeout);
          ws.off("message", onMessage);
          if (msg.ok) resolve();
          else reject(new Error(msg?.error?.message || "connect failed"));
        }
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
    ws.on("error", reject);
  });
}

export async function sendChatMessage({ host, port, token, sessionKey, message, deliver = true }) {
  const wsUrl = buildWsUrl({ host, port });
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WS connect timeout")), 5000);
    ws.on("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.on("error", reject);
  });

  await connectWithToken(ws, { token });

  const reqId = randomUUID();
  const idem = randomUUID();

  ws.send(
    JSON.stringify({
      type: "req",
      id: reqId,
      method: "chat.send",
      params: {
        sessionKey,
        message,
        deliver,
        idempotencyKey: idem,
      },
    })
  );

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No response from gateway")), 10000);
    const onMessage = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === "res" && msg?.id === reqId) {
          clearTimeout(timeout);
          ws.off("message", onMessage);
          if (msg.ok) resolve();
          else reject(new Error(msg?.error?.message || "gateway error"));
          ws.close();
        }
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
    ws.on("error", reject);
  });
}
