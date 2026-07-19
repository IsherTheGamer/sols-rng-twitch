import { useMemo, useState } from "react";

type Scope = "profile" | "core" | "activity" | "inventory";
type Operation = "add" | "deduct" | "set";

type ApiResult = Record<string, any>;

function parseEditorValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export default function PlayerStatEditor() {
  const [cronSecret, setCronSecret] = useState("");
  const [userStatCode, setUserStatCode] = useState("");
  const [channelId, setChannelId] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [scope, setScope] = useState<Scope>("core");
  const [path, setPath] = useState("stardust");
  const [operation, setOperation] = useState<Operation>("add");
  const [value, setValue] = useState("1000");
  const [confirmation, setConfirmation] = useState("");
  const [lookup, setLookup] = useState<ApiResult | null>(null);
  const [preview, setPreview] = useState<ApiResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);

  const pathOptions = useMemo(
    () => (lookup?.paths?.[scope] ?? []) as string[],
    [lookup, scope]
  );

  async function call(body: Record<string, unknown>): Promise<ApiResult> {
    setBusy(true);
    try {
      const response = await fetch("/api/player-stat-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cronSecret,
          userStatCode,
          ...body,
        }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function loadPlayer() {
    try {
      setStatus("Loading player scopes...");
      const result = await call({ action: "lookup", channelId, username, userId });
      setLookup(result);
      setPreview(null);
      setConfirmation("");
      setStatus(`Loaded ${result.target.displayName} (${result.target.userId}).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lookup failed.");
    }
  }

  async function createPreview() {
    try {
      setStatus("Creating non-destructive preview...");
      const result = await call({
        action: "preview",
        channelId,
        username,
        userId,
        scope,
        path,
        operation,
        value: parseEditorValue(value),
      });
      setPreview(result.preview);
      setConfirmation("");
      setStatus("Preview created. Copy the exact phrase before applying.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed.");
    }
  }

  async function applyPreview() {
    if (!preview?.id) return;
    try {
      setStatus("Applying confirmed edit...");
      const result = await call({
        action: "apply",
        previewId: preview.id,
        confirmation,
      });
      setPreview(null);
      setConfirmation("");
      setStatus(`Applied. Audit ID: ${result.audit.id}`);
      await loadPlayer();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Apply failed.");
    }
  }

  async function loadHistory() {
    try {
      const result = await call({ action: "history" });
      setHistory(result.history ?? []);
      setStatus(`Loaded ${result.history?.length ?? 0} audit entries.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "History failed.");
    }
  }

  async function undo(auditId: string) {
    try {
      const result = await call({ action: "undo", auditId });
      setStatus(result.message);
      await Promise.all([loadHistory(), loadPlayer()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Undo failed.");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">SOL'S RNG TWITCH ADMIN</p>
          <h1>Player Stat Editor</h1>
          <p>Protected by both CRON_SECRET and the case-sensitive USER_STAT_CODE. Every edit requires a preview and exact confirmation.</p>
        </div>
        <div className="status">{busy ? "Working..." : status}</div>
      </section>

      <section className="panel grid two">
        <label>CRON_SECRET<input type="password" value={cronSecret} onChange={(event) => setCronSecret(event.target.value)} /></label>
        <label>USER_STAT_CODE (case-sensitive)<input type="password" value={userStatCode} onChange={(event) => setUserStatCode(event.target.value)} /></label>
        <label>Channel Twitch ID<input value={channelId} onChange={(event) => setChannelId(event.target.value)} placeholder="Numeric channel ID" /></label>
        <label>Player username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="isherthegamer" /></label>
        <label>Player Twitch ID (optional, strongest match)<input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="932837274" /></label>
        <button onClick={loadPlayer} disabled={busy}>Load player</button>
      </section>

      <section className="panel grid two">
        <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="profile">Profile</option><option value="core">Core</option><option value="activity">Activity / Knowledge</option><option value="inventory">Roll-token Inventory</option></select></label>
        <label>Operation<select value={operation} onChange={(event) => setOperation(event.target.value as Operation)}><option value="add">Add</option><option value="deduct">Deduct</option><option value="set">Set</option></select></label>
        <label className="wide">Nested path<input list="stat-paths" value={path} onChange={(event) => setPath(event.target.value)} placeholder="materials.scrap" /><datalist id="stat-paths">{pathOptions.map((entry) => <option value={entry} key={entry} />)}</datalist></label>
        <label className="wide">Value (JSON accepted)<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} placeholder='1000 or {"enabled":true}' /></label>
        <button onClick={createPreview} disabled={busy || !lookup}>Preview edit</button>
        <button onClick={loadHistory} disabled={busy}>Load audit history</button>
      </section>

      {preview && (
        <section className="panel danger">
          <h2>Preview — nothing changed yet</h2>
          <div className="diff"><div><strong>Before</strong><pre>{JSON.stringify(preview.beforeValue, null, 2)}</pre></div><div><strong>After</strong><pre>{JSON.stringify(preview.afterValue, null, 2)}</pre></div></div>
          <p>Type this phrase exactly:</p>
          <code>{preview.confirmation}</code>
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Exact confirmation phrase" />
          <button className="dangerButton" onClick={applyPreview} disabled={busy || confirmation !== preview.confirmation}>Apply confirmed edit</button>
        </section>
      )}

      {lookup && (
        <section className="panel">
          <h2>Current {scope} record</h2>
          <pre className="json">{JSON.stringify(lookup.scopes?.[scope], null, 2)}</pre>
        </section>
      )}

      {history.length > 0 && (
        <section className="panel">
          <h2>Audit history</h2>
          <div className="history">{history.map((entry) => <article key={entry.id}><div><strong>{entry.target?.displayName}</strong> — {entry.scope}.{entry.path}</div><small>{entry.operation} {JSON.stringify(entry.inputValue)} · {new Date(entry.appliedAt).toLocaleString()}</small><button onClick={() => undo(entry.id)} disabled={busy || Boolean(entry.undoneAt) || Boolean(entry.undoOf)}>{entry.undoneAt ? "Undone" : entry.undoOf ? "Undo record" : "Undo whole scope"}</button></article>)}</div>
        </section>
      )}

      <style jsx>{`
        :global(body){margin:0;background:#090b12;color:#f5f7ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1100px;margin:0 auto;padding:36px 20px 80px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.18em;color:#9ea8ff;font-weight:800}.hero h1{font-size:42px;margin:4px 0 8px}.hero p{max-width:720px;color:#b9c0d4}.status{background:#151928;border:1px solid #2a3047;padding:12px 16px;border-radius:12px;max-width:360px}.panel{background:#111522;border:1px solid #252b40;border-radius:18px;padding:20px;margin-top:18px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.grid{display:grid;gap:16px}.two{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:1/-1}label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#ccd2e6}input,select,textarea{width:100%;box-sizing:border-box;background:#090c15;color:#fff;border:1px solid #343b55;border-radius:10px;padding:11px 12px;font:inherit}button{align-self:end;background:#6978ff;color:white;border:0;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.danger{border-color:#6f3942}.dangerButton{background:#d74c60;margin-top:14px}.diff{display:grid;grid-template-columns:1fr 1fr;gap:14px}.diff>div{background:#090c15;border-radius:12px;padding:12px}code{display:block;padding:12px;background:#090c15;border:1px dashed #e06b7c;border-radius:10px;margin:8px 0 12px;overflow-wrap:anywhere}.json{max-height:560px;overflow:auto;background:#080a11;border-radius:12px;padding:16px}.history{display:grid;gap:10px}.history article{display:grid;grid-template-columns:1fr auto;gap:5px 12px;background:#0b0e18;padding:12px;border-radius:12px}.history small{color:#9ca5be}.history button{grid-column:2;grid-row:1/3;padding:8px 12px}@media(max-width:760px){.hero{display:block}.status{margin-top:14px}.two,.diff{grid-template-columns:1fr}.wide{grid-column:auto}.history article{grid-template-columns:1fr}.history button{grid-column:auto;grid-row:auto}}
      `}</style>
    </main>
  );
}
