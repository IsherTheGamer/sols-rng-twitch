import type { NightbotUser } from "./nightbot";

function normalize(input: string | undefined | null): string {
  return (input ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(/[,\s]+/)
    .map(normalize)
    .filter(Boolean);
}

function getChannelSpecificEnvName(channelName: string | undefined | null): string | null {
  const clean = normalize(channelName);

  if (!clean) return null;

  return `POPOP_ALLOWED_USERS_${clean.toUpperCase()}`;
}

export function isPopopAllowlisted(
  user: NightbotUser | null,
  channelName?: string | null
): boolean {
  if (!user) return false;

  const userNames = [
    normalize(user.name),
    normalize(user.displayName),
    normalize(user.providerId),
  ].filter(Boolean);

  const globalAllowed = parseList(process.env.POPOP_ALLOWED_USERS);

  const channelEnvName = getChannelSpecificEnvName(channelName);
  const channelAllowed = channelEnvName
    ? parseList(process.env[channelEnvName])
    : [];

  const allowed = new Set([...globalAllowed, ...channelAllowed]);

  return userNames.some((name) => allowed.has(name));
}
