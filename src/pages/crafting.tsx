import { useMemo, useState } from "react";

const TIER_NAMES = [
  "Basic",
  "Copper",
  "Refined",
  "Stabilized",
  "Quantum",
  "Reality",
  "Singularity",
  "Dimensional",
  "Anomaly",
  "Forbidden",
] as const;

const COMPONENT_FAMILIES = [
  "wire",
  "cable",
  "plate",
  "rod",
  "screw",
  "bolt",
  "coil",
  "resistor",
  "smd_resistor",
  "transistor",
  "smd_transistor",
  "capacitor",
  "smd_capacitor",
  "diode",
  "smd_diode",
  "fuse",
  "relay",
  "sensor",
  "emitter",
  "lens",
  "heat_sink",
  "battery_cell",
  "power_cell",
  "circuit_board",
  "processor",
  "logic_chip",
  "regulator",
  "stabilizer",
  "conduit",
  "matrix",
] as const;

const MATERIAL_NAMES: Record<string, string> = {
  scrap: "Scrap",
  metal_bits: "Metal Bits",
  mechanical_scrap: "Mechanical Scrap",
  circuit_scrap: "Circuit Scrap",
  signal_fragment: "Signal Fragment",
  refined_alloy: "Refined Alloy",
  stabilized_flux: "Stabilized Flux",
  quantum_residue: "Quantum Residue",
  reality_thread: "Reality Thread",
  dimensional_seal: "Dimensional Seal",
  anomaly_matter: "Anomaly Matter",
  forbidden_circuit: "Forbidden Circuit",
  debug_fragment: "Debug Fragment",
  thermal_paste: "Thermal Paste",
  conductive_gel: "Conductive Gel",
  energy_cell: "Energy Cell",
  glitched_alloy: "Glitched Alloy",
  chrono_dust: "Chrono Dust",
  void_glass: "Void Glass",
  stellar_ink: "Stellar Ink",
};

const MATERIAL_SOURCES = [
  ["Scrap", "Every roll gives Scrap."],
  ["Metal Bits", "Every roll gives Metal Bits."],
  ["Mechanical Scrap", "Pure roll-only: every 5 successful aura rolls gives 1. Not sold in shops/markets."],
  ["Circuit Scrap", "Roll 1/450+ auras; also quests/boxes."],
  ["Signal Fragment", "Roll 1/10k+ auras; also quests/boxes."],
  ["Refined Alloy", "Roll 1/50k+ auras; also quests/boxes/black market."],
  ["Stabilized Flux", "Roll 1/1M+ auras; also late quests/black market."],
  ["Quantum Residue", "Roll 1/10M+ auras; also weekly/story rewards."],
  ["Reality Thread", "Roll 1/100M+ auras; black market can sell packs."],
  ["Singularity Shard", "Roll 1/1B+ auras; black market can sell packs."],
  ["Chrono Dust", "Roll 1/5M+ auras."],
  ["Void Glass", "Roll 1/25M+ auras."],
  ["Stellar Ink", "Roll 1/75M+ auras."],
  ["Dimensional Seal", "Roll 1/250M+ auras."],
  ["Anomaly Matter", "Roll 1/500M+ auras."],
  ["Glitched Alloy", "Roll 1/1B+ auras."],
  ["Forbidden Circuit", "Roll 1/5B+ auras."],
];

function titleCase(raw: string): string {
  return raw
    .split(/[_\-\s:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAmount(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function outputRule(tier: number): string {
  if (tier <= 5) return "x2 guaranteed";
  if (tier <= 7) return "x1, 25% double";
  return "x1";
}

function recipeFor(family: string, tier: number) {
  const familyIndex = COMPONENT_FAMILIES.indexOf(family as typeof COMPONENT_FAMILIES[number]);
  const baseScale = Math.max(1, familyIndex + 1);
  const materials: Record<string, number> = {
    scrap: Math.ceil(baseScale * tier * 6),
    metal_bits: Math.ceil(baseScale * tier * 2),
  };

  if (tier <= 2) {
    materials.mechanical_scrap = Math.max(1, Math.ceil(baseScale * (tier === 1 ? 0.75 : 1.25)));
  }
  const components: Record<string, number> = {};

  if (tier >= 2) components[`${family}_${tier - 1}`] = Math.max(1, Math.ceil(tier / 2));
  if (tier >= 3) materials.circuit_scrap = baseScale * tier * 3;
  if (tier >= 4) materials.signal_fragment = Math.ceil(baseScale * tier * 1.5);
  if (tier >= 5) materials.refined_alloy = Math.ceil(baseScale * tier);
  if (tier >= 6) materials.stabilized_flux = Math.ceil((baseScale * tier) / 2);
  if (tier >= 7) materials.quantum_residue = Math.ceil((baseScale * tier) / 4);
  if (tier >= 8) materials.reality_thread = Math.ceil((baseScale * tier) / 6);
  if (tier >= 9) materials.dimensional_seal = Math.ceil((baseScale * tier) / 8);
  if (tier >= 10) materials.anomaly_matter = Math.ceil((baseScale * tier) / 10);

  if (family.includes("smd") && tier >= 2) {
    components[family.replace("smd_", "") + `_${Math.max(1, tier - 1)}`] = 2;
  }

  if (["processor", "logic_chip", "regulator", "stabilizer", "conduit", "matrix"].includes(family)) {
    components[`circuit_board_${Math.max(1, Math.min(10, tier))}`] = Math.max(1, Math.ceil(tier / 3));
  }

  return { materials, components };
}

function formatBag(bag: Record<string, number>, nameFn: (id: string) => string): string {
  const entries = Object.entries(bag);
  if (entries.length === 0) return "None";
  return entries.map(([id, amount]) => `${nameFn(id)} x${formatAmount(amount)}`).join(", ");
}

function materialName(id: string): string {
  return MATERIAL_NAMES[id] ?? titleCase(id);
}

function componentName(id: string): string {
  const match = id.match(/^(.+)_(\d+)$/);
  if (!match) return titleCase(id);
  return `${TIER_NAMES[Number(match[2]) - 1] ?? "Tier"} ${titleCase(match[1])}`;
}

export default function CraftingGuide() {
  const [family, setFamily] = useState<string>("wire");
  const [tier, setTier] = useState<number>(1);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return COMPONENT_FAMILIES.flatMap((f) =>
      TIER_NAMES.map((tierName, index) => {
        const t = index + 1;
        const recipe = recipeFor(f, t);
        return {
          id: `${f}_${t}`,
          family: f,
          tier: t,
          name: `${tierName} ${titleCase(f)}`,
          output: outputRule(t),
          materials: formatBag(recipe.materials, materialName),
          components: formatBag(recipe.components, componentName),
          command: `!craft ${tierName.toLowerCase()} ${titleCase(f).toLowerCase()}`,
          recipeCommand: `!craft recipe ${tierName.toLowerCase()} ${titleCase(f).toLowerCase()}`,
        };
      })
    );
  }, []);

  const selected = rows.find((r) => r.family === family && r.tier === tier) ?? rows[0];

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return r.family === family || r.tier === tier;
    return (
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.materials.toLowerCase().includes(q) ||
      r.components.toLowerCase().includes(q)
    );
  });

  return (
    <main style={{ minHeight: "100vh", background: "#090b16", color: "#f5f7ff", fontFamily: "system-ui, Arial", padding: 24 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <p style={{ color: "#9aa7ff", margin: 0 }}>Sols RNG Twitch Bot</p>
          <h1 style={{ fontSize: 42, margin: "4px 0" }}>Crafting Guide</h1>
          <p style={{ color: "#b9c1df", maxWidth: 850 }}>
            Full component recipe website. Outputs follow the new balance: Tier 1-5 = x2, Tier 6-7 = 25% chance to double, Tier 8+ = x1.
            SHD Lv.8 and global 25k rolls add duplicate chances.
          </p>
          <p><a href="/dashboard" style={{ color: "#9aa7ff" }}>← Dashboard</a></p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
          {[
            ["Tier 1-5", "x2 guaranteed output"],
            ["Tier 6-7", "x1 + 25% double chance"],
            ["Tier 8+", "x1 output"],
            ["SHD Lv.8", "+10% duplicate materials/components"],
            ["Global 25k rolls", "+1% duplicate materials/components"],
            ["Levels", "+0.1% material multiplier every 50 levels"],
            ["Global quests", "+0.1% material multiplier every 100 daily/weekly global quests"],
            ["Mechanical Scrap", "1 every 5 successful aura rolls; pure roll-only limiter"],
          ].map(([title, text]) => (
            <div key={title} style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 16, padding: 16 }}>
              <strong>{title}</strong>
              <p style={{ color: "#b9c1df", marginBottom: 0 }}>{text}</p>
            </div>
          ))}
        </section>

        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Recipe Explorer</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <select value={family} onChange={(e) => setFamily(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
              {COMPONENT_FAMILIES.map((f) => <option key={f} value={f}>{titleCase(f)}</option>)}
            </select>
            <select value={tier} onChange={(e) => setTier(Number(e.target.value))} style={{ padding: 10, borderRadius: 10 }}>
              {TIER_NAMES.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipe/material..." style={{ padding: 10, borderRadius: 10, minWidth: 240 }} />
          </div>

          <div style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 14, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p><b>Output:</b> {selected.output}</p>
            <p><b>Materials:</b> {selected.materials}</p>
            <p><b>Components:</b> {selected.components}</p>
            <code style={{ display: "block", color: "#b6ffdf", whiteSpace: "pre-wrap" }}>{selected.recipeCommand}</code>
            <code style={{ display: "block", color: "#b6ffdf", whiteSpace: "pre-wrap", marginTop: 8 }}>{selected.command}</code>
          </div>
        </section>

        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>All Craftable Components</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#9aa7ff" }}>
                  <th style={{ padding: 10, borderBottom: "1px solid #2a3564" }}>Component</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #2a3564" }}>Output</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #2a3564" }}>Materials</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #2a3564" }}>Components</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #2a3564" }}>Command</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 120).map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #1c2446" }}>{r.name}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #1c2446" }}>{r.output}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #1c2446", color: "#d5dcff" }}>{r.materials}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #1c2446", color: "#d5dcff" }}>{r.components}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #1c2446" }}><code>{r.recipeCommand}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 120 && <p style={{ color: "#b9c1df" }}>Showing first 120 matches. Use search/filter to narrow it.</p>}
        </section>

        <section style={{ background: "#11152a", border: "1px solid #20294d", borderRadius: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>How to obtain materials</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {MATERIAL_SOURCES.map(([name, text]) => (
              <div key={name} style={{ background: "#080a14", border: "1px solid #26305b", borderRadius: 12, padding: 12 }}>
                <b>{name}</b>
                <p style={{ color: "#b9c1df", marginBottom: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
