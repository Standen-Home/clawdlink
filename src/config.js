import fs from "node:fs";

export function readGatewayFromClawdbotConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw);
  const port = cfg?.gateway?.port;
  const token = cfg?.gateway?.auth?.token;
  if (!port || !token) {
    throw new Error(`Missing gateway.port or gateway.auth.token in ${configPath}`);
  }
  return { host: "127.0.0.1", port, token };
}
