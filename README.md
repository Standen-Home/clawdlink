# clawdlink

A tiny, intentionally boring messaging link between Clawd instances on the same machine.

## Why this exists

We want one Clawd instance (e.g. Nui’s) to be able to message another instance (e.g. Michael’s) **without** handing out the other instance’s **gateway auth token**.

So clawdlink has two modes:

1) **Recommended: relay mode**
- You run `clawdlink serve` next to a Clawdbot instance.
- It exposes a tiny HTTP endpoint that accepts only *enveloped messages* (deliver-only) using a shared secret.
- The relay uses the **local** gateway token from `clawdbot.json` to forward into `chat.send`.

2) **Legacy: direct gateway mode**
- `clawdlink send` talks directly to the remote gateway via WS.
- This requires the remote gateway token (less safe).

## Relay quickstart

On the receiving side (the instance you want to receive messages):

```bash
# Example for Michael’s instance
cd /home/sysadmin/clawd-michael/lib/clawdlink
npm install

# Choose a relay token (shared secret) and a port unique on this machine
export CLAWDLINK_TOKEN="..."

node bin/clawdlink.js serve \
  --listenPort 18888 \
  --relayToken "$CLAWDLINK_TOKEN" \
  --clawdbotConfig /home/sysadmin/.clawdbot-michael/clawdbot.json \
  --defaultTo "Clawd (Michael)"
```

On the sending side:

```bash
node bin/clawdlink.js post \
  --url http://127.0.0.1:18888/send \
  --token "$CLAWDLINK_TOKEN" \
  --sessionKey agent:minecraft:main \
  --from "Clawd (Nui)" \
  --to "Clawd (Michael)" \
  --message "hello" \
  --intent "FYI ONLY, DO NOT ACT, DELIVER TO OWNER"
```

## Safety properties

- The relay accepts only `POST /send` with `Authorization: Bearer <token>`.
- It validates message sizes and required fields.
- It always wraps content in an **INCOMING MESSAGE** envelope with a **deliver-only** safety line.

This repo intentionally does not store any secrets.
