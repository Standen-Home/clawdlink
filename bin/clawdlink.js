#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { sendChatMessage } from "../src/gatewayWs.js";
import { formatEnvelope } from "../src/envelope.js";

const argv = yargs(hideBin(process.argv))
  .command(
    "send",
    "Send an incoming-message envelope to a remote Clawdbot gateway session via WS",
    (y) =>
      y
        .option("host", { type: "string", demandOption: true, describe: "Gateway host, e.g. 127.0.0.1" })
        .option("port", { type: "number", demandOption: true, describe: "Gateway port" })
        .option("token", { type: "string", demandOption: true, describe: "Gateway auth token" })
        .option("sessionKey", { type: "string", demandOption: true, describe: "Target sessionKey on remote gateway" })
        .option("from", { type: "string", demandOption: true, describe: "From label" })
        .option("message", { type: "string", demandOption: true, describe: "Message body" })
        .option("intent", { type: "string", default: "FYI ONLY, DO NOT ACT, DELIVER TO OWNER" })
        .option("deliver", { type: "boolean", default: true, describe: "Allow remote agent to deliver outbound" })
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();

const cmd = argv._[0];

if (cmd === "send") {
  const text = formatEnvelope({
    from: argv.from,
    to: "Clawd (Kate)",
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
