const fs = require("fs");

const file = "src/pages/api/chat-send.ts";

if (!fs.existsSync(file)) {
  console.error("❌ Missing src/pages/api/chat-send.ts. Install nightbot-chat-sender first.");
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");

if (!s.includes("function readBodyToken(")) {
  s = s.replace(
`function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}`,
`function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readBodyToken(req: NextApiRequest): string {
  if (!req.body || typeof req.body !== "object") return "";
  const value = (req.body as Record<string, unknown>).token;
  return typeof value === "string" ? value : "";
}

function verifyChatSendToken(req: NextApiRequest): boolean {
  if (verifyCron(req)) return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const bodyToken = readBodyToken(req);
  return bodyToken === secret;
}`
  );
}

s = s.replace(
`  if (!verifyCron(req)) {
    return res.status(401).send("Unauthorized");
  }`,
`  if (!verifyChatSendToken(req)) {
    return res.status(401).send("Unauthorized");
  }`
);

fs.writeFileSync(file, s);
console.log("✅ Fixed chat-send auth so website POST body token works.");
