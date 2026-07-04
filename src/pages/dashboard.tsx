export default function Dashboard() {
  const base = "https://sols-rng-twitch.vercel.app";
  const commands = ["recent", "replay", "lb?query=weekly%20rolls", "records", "firsts", "aotd", "botd", "boost", "active"];
  return (
    <main style={{ fontFamily: "system-ui, Arial", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Sols RNG Dashboard</h1>
      <p>Simple web hub for your Twitch bot. Add prettier live data later.</p>
      <section style={{ display: "grid", gap: 12 }}>
        {commands.map((cmd) => (
          <a key={cmd} href={`${base}/api/${cmd}`} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
            /api/{cmd}
          </a>
        ))}
      </section>
    </main>
  );
}
