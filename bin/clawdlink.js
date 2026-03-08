#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import http from "node:http";
import { sendChatMessage } from "../src/gatewayWs.js";
import { formatEnvelope } from "../src/envelope.js";
import { startRelayServer } from "../src/relayServer.js";
import { readGatewayFromClawdbotConfig } from "../src/config.js";

function postJson({ url, token, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(text);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

const argv = yargs(hideBin(process.argv))
  .command(
    "send",
    "Send an incoming-message envelope to a remote Clawdbot gateway session via WS (requires gateway token)",
    (y) =>
      y
        .option("host", { type: "string", demandOption: true, describe: "Gateway host, e.g. 127.0.0.1" })
        .option("port", { type: "number", demandOption: true, describe: "Gateway port" })
        .option("token", { type: "string", demandOption: true, describe: "Gateway auth token" })
        .option("sessionKey", { type: "string", demandOption: true, describe: "Target sessionKey on remote gateway" })
        .option("from", { type: "string", demandOption: true, describe: "From label" })
        .option("to", { type: "string", demandOption: true, describe: "To label" })
        .option("message", { type: "string", demandOption: true, describe: "Message body" })
        .option("intent", { type: "string", default: "FYI ONLY, DO NOT ACT, DELIVER TO OWNER" })
        .option("deliver", { type: "boolean", default: true, describe: "Allow remote agent to deliver outbound" })
  )
  .command(
    "post",
    "Send a message to a remote clawdlink relay server (recommended; does NOT require gateway token)",
    (y) =>
      y
        .option("url", { type: "string", demandOption: true, describe: "Relay base URL, e.g. http://127.0.0.1:18888/send" })
        .option("token", { type: "string", demandOption: true, describe: "Relay token" })
        .option("sessionKey", { type: "string", demandOption: true, describe: "Target sessionKey on the receiving gateway" })
        .option("from", { type: "string", demandOption: true, describe: "From label" })
        .option("to", { type: "string", demandOption: true, describe: "To label" })
        .option("message", { type: "string", demandOption: true, describe: "Message body" })
        .option("intent", { type: "string", default: "FYI ONLY, DO NOT ACT, DELIVER TO OWNER" })
  )
  .command(
    "serve",
    "Run a local relay server that forwards safe envelopes into your local gateway",
    (y) =>
      y
        .option("listenPort", { type: "number", demandOption: true, describe: "Relay listen port" })
        .option("listenHost", { type: "string", default: "127.0.0.1" })
        .option("relayToken", { type: "string", demandOption: true, describe: "Shared secret for the relay" })
        .option("clawdbotConfig", {
          type: "string",
          demandOption: true,
          describe: "Path to local clawdbot.json (used to read gateway.port + gateway.auth.token)",
        })
        .option("defaultTo", { type: "string", default: "Clawd" })
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();

const cmd = argv._[0];

if (cmd === "send") {
  const text = formatEnvelope({
    from: argv.from,
    to: argv.to,
    intent: argv.intent,
    message: argv.message,
  });

  await sendChatMessage({
    host: argv.host,
    port: argv.port,
    token: argv.token,
    sessionKey: argv.sessionKey,
    message: text,
    deliver: argv.deliver,
  });
}

if (cmd === "post") {
  await postJson({
    url: argv.url,
    token: argv.token,
    body: {
      sessionKey: argv.sessionKey,
      from: argv.from,
      to: argv.to,
      intent: argv.intent,
      message: argv.message,
    },
  });
}

if (cmd === "serve") {
  const gateway = readGatewayFromClawdbotConfig(argv.clawdbotConfig);
  const running = await startRelayServer({
    listenHost: argv.listenHost,
    listenPort: argv.listenPort,
    relayToken: argv.relayToken,
    gateway,
    defaultTo: argv.defaultTo,
  });

  // eslint-disable-next-line no-console
  console.log(`clawdlink relay listening at ${running.url} (POST /send, GET /health)`);

  // Keep process alive.
  await new Promise(() => {});
}
