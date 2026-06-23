import type { NextApiRequest, NextApiResponse } from "next";

export function text(res: NextApiResponse, message: string) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(message);
}

export function error(res: NextApiResponse, message: string, status = 400) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(status).send(message);
}

export function parseQuery(req: NextApiRequest): string {
  const q = req.query.query;
  if (typeof q === "string") return q.trim();
  const parts: string[] = [];
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "query" || k === "action" || k === "token") continue;
    if (typeof v === "string") parts.push(v);
  }
  if (parts.length) return parts.join(" ").trim();
  return "";
}

export function verifyCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const token = req.query.token;
  return token === secret;
}
