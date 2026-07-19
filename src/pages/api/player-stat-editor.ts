import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

type Scope = "profile" | "core" | "activity" | "inventory";
type Operation = "add" | "deduct" | "set";
interface RequestBody {
  action?: "lookup" | "preview" | "apply" | "history" | "undo";
  cronSecret?: string;
  userStatCode?: string;
  channelId?: string;
  username?: string;
  userId?: string;
  scope?: Scope;
  path?: string;
  operation?: Operation;
  value?: unknown;
  previewId?: string;
  confirmation?: string;
  auditId?: string;
}
interface TargetPlayer {
  channelId: string;
  userId: string;
  username: string;
  displayName: string;
}
interface PreviewRecord {
  id: string;
  target: TargetPlayer;
  scope: Scope;
  key: string;
  path: string;
  operation: Operation;
  inputValue: unknown;
  beforeValue: unknown;
  afterValue: unknown;
  beforeScope: Record<string, unknown>;
  afterScope: Record<string, unknown>;
  confirmation: string;
  createdAt: number;
}
interface AuditRecord extends Omit<PreviewRecord, "confirmation"> {
  appliedAt: number;
  undoneAt?: number;
  undoOf?: string;
}

const SCOPES: Scope[] = ["profile", "core", "activity", "inventory"];
const OPERATIONS: Operation[] = ["add", "deduct", "set"];
const BLOCKED_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const HISTORY_KEY = "admin:player-stat-editor:history";

function text(value: unknown): string {
  return String(value ?? "").trim();
}
function cleanId(value: unknown): string {
  return text(value).replace(/[^a-zA-Z0-9_-]/g, "");
}
function normalizeUsername(value: unknown): string {
  return text(value).replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
}
function displayName(value: unknown): string {
  return text(value).replace(/^@+/, "").replace(/[^a-zA-Z0-9_ -]/g, "").slice(0, 50);
}
function isAuthorized(body: RequestBody): boolean {
  const cron = process.env.CRON_SECRET;
  const code = process.env.USER_STAT_CODE;
  return Boolean(
    cron &&
      code &&
      body.cronSecret === cron &&
      body.userStatCode === code
  );
}
function scopeKey(scope: Scope, channelId: string, userId: string): string {
  if (scope === "profile") return `profile:${channelId}:${userId}`;
  if (scope === "core") return `core-system:${channelId}:${userId}`;
  if (scope === "activity") return `aok:player:${channelId}:${userId}`;
  return `inventory:${channelId}:${userId}`;
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function pathSegments(raw: string): string[] {
  const normalized = raw.replace(/\[(\d+)\]/g, ".$1").replace(/^\.+|\.+$/g, "");
  const segments = normalized.split(".").map((part) => part.trim()).filter(Boolean);
  if (segments.length === 0 || segments.length > 20) throw new Error("Path must contain 1-20 segments.");
  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment)) throw new Error("That path segment is blocked.");
    if (!/^[a-zA-Z0-9_+\-]+$/.test(segment)) throw new Error(`Invalid path segment: ${segment}`);
  }
  return segments;
}
function getAt(root: unknown, segments: string[]): unknown {
  let current = root as any;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}
function setAt(root: Record<string, unknown>, segments: string[], value: unknown): void {
  let current: any = root;
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const next = segments[index + 1];
    if (current[segment] === null || typeof current[segment] !== "object") {
      current[segment] = /^\d+$/.test(next) ? [] : {};
    }
    current = current[segment];
  }
  current[segments[segments.length - 1]] = value;
}
function numeric(value: unknown, name: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number.`);
  if (Math.abs(number) > Number.MAX_SAFE_INTEGER) throw new Error(`${name} exceeds JavaScript's safe integer range.`);
  return number;
}
function previewKey(id: string): string {
  return `admin:player-stat-editor:preview:${id}`;
}
async function mget(r: Redis, keys: string[]): Promise<Array<Record<string, unknown> | null>> {
  if (keys.length === 0) return [];
  return (await r.mget(...keys)) as Array<Record<string, unknown> | null>;
}
async function resolveTarget(
  r: Redis,
  channelId: string,
  rawUserId: string,
  rawUsername: string
): Promise<TargetPlayer | null> {
  const requestedId = cleanId(rawUserId);
  const username = normalizeUsername(rawUsername);
  if (requestedId) {
    const profile = await r.get<Record<string, unknown>>(`profile:${channelId}:${requestedId}`);
    return {
      channelId,
      userId: requestedId,
      username: username || normalizeUsername(profile?.displayName) || requestedId,
      displayName: displayName(profile?.displayName) || displayName(rawUsername) || requestedId,
    };
  }
  if (!username) return null;
  const keys = ((await r.get<string[]>(`profiles:${channelId}:keys`)) ?? []).slice(0, 5000);
  const profiles = await mget(r, keys);
  for (let index = 0; index < profiles.length; index++) {
    const profile = profiles[index];
    const indexedId = cleanId(keys[index]?.split(":").pop());
    if (normalizeUsername(profile?.displayName) !== username && indexedId !== username) continue;
    const id = cleanId(profile?.userId) || indexedId;
    if (!id) continue;
    return {
      channelId,
      userId: id,
      username,
      displayName: displayName(profile?.displayName) || displayName(rawUsername) || username,
    };
  }
  return null;
}
async function loadScopes(r: Redis, target: TargetPlayer): Promise<Record<Scope, Record<string, unknown> | null>> {
  const keys = SCOPES.map((scope) => scopeKey(scope, target.channelId, target.userId));
  const values = await mget(r, keys);
  return {
    profile: values[0],
    core: values[1],
    activity: values[2],
    inventory: values[3],
  };
}
function flattenPaths(value: unknown, prefix = "", output: string[] = [], depth = 0): string[] {
  if (depth > 8 || output.length >= 500 || value === null || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "number" || typeof child === "string" || typeof child === "boolean" || child === null) output.push(path);
    else flattenPaths(child, path, output, depth + 1);
    if (output.length >= 500) break;
  }
  return output;
}
async function history(r: Redis): Promise<AuditRecord[]> {
  return ((await r.get<AuditRecord[]>(HISTORY_KEY)) ?? []).slice(0, 50);
}
async function saveAudit(r: Redis, audit: AuditRecord): Promise<void> {
  const list = await history(r);
  list.unshift(audit);
  await r.set(HISTORY_KEY, list.slice(0, 50));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only." });
  const body = (req.body ?? {}) as RequestBody;
  if (!isAuthorized(body)) return res.status(401).json({ ok: false, error: "Both CRON_SECRET and case-sensitive USER_STAT_CODE are required." });
  const r = getRedis();
  if (!r) return res.status(503).json({ ok: false, error: "Redis is not connected." });

  try {
    const action = body.action ?? "lookup";
    if (action === "history") return res.status(200).json({ ok: true, history: await history(r) });

    if (action === "apply") {
      const id = cleanId(body.previewId);
      const preview = id ? await r.get<PreviewRecord>(previewKey(id)) : null;
      if (!preview) return res.status(404).json({ ok: false, error: "Preview expired or was not found. Create a new preview." });
      if (body.confirmation !== preview.confirmation) return res.status(400).json({ ok: false, error: "Confirmation phrase does not match exactly." });
      await r.set(preview.key, preview.afterScope);
      const audit: AuditRecord = { ...preview, appliedAt: Date.now() };
      delete (audit as Partial<PreviewRecord>).confirmation;
      await Promise.all([saveAudit(r, audit), r.del(previewKey(id))]);
      return res.status(200).json({ ok: true, audit });
    }

    if (action === "undo") {
      const id = cleanId(body.auditId);
      const list = await history(r);
      const audit = list.find((entry) => entry.id === id);
      if (!audit) return res.status(404).json({ ok: false, error: "Audit entry not found." });
      if (audit.undoneAt) return res.status(400).json({ ok: false, error: "That change was already undone." });
      await r.set(audit.key, audit.beforeScope);
      audit.undoneAt = Date.now();
      await r.set(HISTORY_KEY, list);
      const undoAudit: AuditRecord = {
        ...audit,
        id: randomUUID(),
        beforeScope: audit.afterScope,
        afterScope: audit.beforeScope,
        beforeValue: audit.afterValue,
        afterValue: audit.beforeValue,
        operation: "set",
        inputValue: "UNDO",
        createdAt: Date.now(),
        appliedAt: Date.now(),
        undoOf: audit.id,
      };
      await saveAudit(r, undoAudit);
      return res.status(200).json({ ok: true, message: `Restored the complete ${audit.scope} scope from before ${audit.id}.`, audit: undoAudit });
    }

    const channelId = cleanId(body.channelId);
    if (!channelId) return res.status(400).json({ ok: false, error: "Channel ID is required." });
    const target = await resolveTarget(r, channelId, text(body.userId), text(body.username));
    if (!target) return res.status(404).json({ ok: false, error: "Player not found. Use a Twitch user ID or a registered username." });

    if (action === "lookup") {
      const scopes = await loadScopes(r, target);
      return res.status(200).json({
        ok: true,
        target,
        scopes,
        paths: Object.fromEntries(SCOPES.map((scope) => [scope, flattenPaths(scopes[scope])])),
      });
    }

    if (action !== "preview") return res.status(400).json({ ok: false, error: "Unknown action." });
    if (!body.scope || !SCOPES.includes(body.scope)) return res.status(400).json({ ok: false, error: "Choose a valid scope." });
    if (!body.operation || !OPERATIONS.includes(body.operation)) return res.status(400).json({ ok: false, error: "Choose add, deduct, or set." });
    const path = text(body.path);
    const segments = pathSegments(path);
    const key = scopeKey(body.scope, channelId, target.userId);
    const existing = (await r.get<Record<string, unknown>>(key)) ?? {};
    const beforeScope = clone(existing);
    const afterScope = clone(existing);
    const beforeValue = getAt(beforeScope, segments);
    let afterValue: unknown;
    if (body.operation === "set") afterValue = body.value;
    else {
      const current = beforeValue === undefined ? 0 : numeric(beforeValue, "Current value");
      const amount = numeric(body.value, "Edit value");
      afterValue = body.operation === "add" ? current + amount : current - amount;
    }
    setAt(afterScope, segments, afterValue);
    const id = randomUUID();
    const confirmation = `APPLY ${target.userId} ${body.scope}.${path} ${body.operation.toUpperCase()} ${JSON.stringify(body.value)}`;
    const preview: PreviewRecord = {
      id,
      target,
      scope: body.scope,
      key,
      path,
      operation: body.operation,
      inputValue: body.value,
      beforeValue,
      afterValue,
      beforeScope,
      afterScope,
      confirmation,
      createdAt: Date.now(),
    };
    await r.set(previewKey(id), preview, { ex: 600 });
    return res.status(200).json({ ok: true, preview });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Unknown editor error." });
  }
}
