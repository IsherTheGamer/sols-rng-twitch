import type { NextApiRequest, NextApiResponse } from "next";

function cleanNightbotText(message: string): string {
  return message
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 390);
}

export function text(res: NextApiResponse, message: string) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(cleanNightbotText(message));
}

export function error(res: NextApiResponse, message: string, _status = 400) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  // Nightbot hides non-200 response bodies and shows generic server/code errors.
  // Returning status 200 lets Twitch chat actually see the reason.
  return res.status(200).send(cleanNightbotText(`❌ ${message}`));
}

export function parseQuery(req: NextApiRequest): string {
  const q = req.query.query;

  if (typeof q === "string") {
    return q.trim();
  }

  const args = req.query.args;

  if (typeof args === "string") {
    return args.trim();
  }

  const parts: string[] = [];

  for (const [key, value] of Object.entries(req.query)) {
    if (
      key === "query" ||
      key === "args" ||
      key === "action" ||
      key === "token" ||
      key === "channel" ||
      key === "secret"
    ) {
      continue;
    }

    if (typeof value === "string") {
      parts.push(value);
    }

    if (Array.isArray(value)) {
      parts.push(...value);
    }
  }

  return parts.join(" ").trim();
}

export function verifyCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) return true;

  const auth = req.headers.authorization;

  if (auth === `Bearer ${secret}`) return true;

  const token = req.query.token;

  return token === secret;
}
