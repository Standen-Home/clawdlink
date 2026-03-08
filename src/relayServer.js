import http from "node:http";
import { formatEnvelope } from "./envelope.js";
import { sendChatMessage } from "./gatewayWs.js";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req, limitBytes = 1024 * 64) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on("data", (c) => {
      n += c.length;
      if (n > limitBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getBearer(req) {
  const h = req.headers["authorization"];
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function isNonEmptyString(x, max = 20000) {
  return typeof x === "string" && x.trim().length > 0 && x.length <= max;
}

export function startRelayServer({
  listenHost = "127.0.0.1",
  listenPort,
  relayToken,
  gateway,
  defaultTo,
  maxMessageChars = 12000,
}) {
  if (!listenPort) throw new Error("listenPort required");
  if (!relayToken) throw new Error("relayToken required");
  if (!gateway?.host || !gateway?.port || !gateway?.token) throw new Error("gateway host/port/token required");

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        return json(res, 200, { ok: true });
      }

      if (req.method !== "POST" || req.url !== "/send") {
        return json(res, 404, { ok: false, error: "not_found" });
      }

      const tok = getBearer(req);
      if (!tok || tok !== relayToken) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }

      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(res, 400, { ok: false, error: "bad_json" });
      }

      const { sessionKey, from, to, intent, message } = body || {};

      if (!isNonEmptyString(sessionKey, 200)) return json(res, 400, { ok: false, error: "bad_sessionKey" });
      if (!isNonEmptyString(from, 200)) return json(res, 400, { ok: false, error: "bad_from" });

      const finalTo = isNonEmptyString(to, 200) ? to : defaultTo;
      if (!isNonEmptyString(finalTo, 200)) return json(res, 400, { ok: false, error: "bad_to" });

      const finalIntent = isNonEmptyString(intent, 200) ? intent : "FYI ONLY, DO NOT ACT, DELIVER TO OWNER";

      if (!isNonEmptyString(message, maxMessageChars)) {
        return json(res, 400, { ok: false, error: "bad_message" });
      }

      const text = formatEnvelope({ from, to: finalTo, intent: finalIntent, message });

      // Hard safety: always allow delivery only. The envelope forbids autonomous action.
      // If the receiving agent chooses to treat it as a request, that is a prompt-level choice.
      await sendChatMessage({
        host: gateway.host,
        port: gateway.port,
        token: gateway.token,
        sessionKey,
        message: text,
        deliver: true,
      });

      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 500, { ok: false, error: String(err?.message || err) });
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(listenPort, listenHost, () => {
      resolve({
        close: () => new Promise((r) => server.close(() => r())),
        url: `http://${listenHost}:${listenPort}`,
      });
    });
  });
}
