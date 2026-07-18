#!/usr/bin/env node
const fs = require("fs");

const file = "src/lib/core-system.ts";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) {
    fail(`Could not patch ${label}. Your core-system.ts may have changed.`);
  }
  return source.replace(oldText, newText);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${file}. Run this from the repository root.`);
}

const originalRaw = fs.readFileSync(file, "utf8");
let source = normalize(originalRaw);

source = replaceOnce(
  source,
`const WALL_COMPONENT_BY_PATH: Record<CorePath, string> = {
  universal: "stability_lock",
  safe: "stability_lock",
  risk: "anomaly_compressor",
  support: "support_regulator",
  biome: "biome_lens",
  precision: "precision_filter",
  token: "token_amplifier",
  anomaly: "null_processor",
};`,
`const WALL_COMPONENT_BY_PATH: Record<CorePath, string> = {
  universal: "stability_lock",
  safe: "stability_lock",
  risk: "anomaly_compressor",
  support: "support_regulator",
  biome: "biome_lens",
  precision: "precision_filter",
  token: "token_amplifier",
  anomaly: "instability_buffer",
};

function getAnomalyWallComponent(coreTier: number): string {
  if (coreTier < 50) return "instability_buffer";
  if (coreTier < 90) return "anomaly_compressor";
  if (coreTier < 130) return "rift_decoder";
  if (coreTier < 170) return "null_processor";
  if (coreTier < 220) return "paradox_engine";
  return "forbidden_singularity";
}

function getWallComponentForPath(
  path: CorePath,
  coreTier: number
): string {
  if (path === "anomaly") {
    return getAnomalyWallComponent(coreTier);
  }

  return WALL_COMPONENT_BY_PATH[path];
}`,
  "dynamic Anomaly wall ladder"
);

source = replaceOnce(
  source,
`  stability_lock: "stability_lock",
  anomaly_compressor: "anomaly_compressor",
  support_regulator: "support_regulator",`,
`  stability_lock: "stability_lock",
  instability: "instability_buffer",
  instability_buffer: "instability_buffer",
  buffer: "instability_buffer",
  anomaly_compressor: "anomaly_compressor",
  compressor: "anomaly_compressor",
  rift: "rift_decoder",
  rift_decoder: "rift_decoder",
  decoder: "rift_decoder",
  null: "null_processor",
  null_processor: "null_processor",
  paradox: "paradox_engine",
  paradox_engine: "paradox_engine",
  forbidden_singularity: "forbidden_singularity",
  forbidden_core: "forbidden_singularity",
  support_regulator: "support_regulator",`,
  "Anomaly recipe aliases"
);

source = source.replace(
`  token_amplifier: "token_amplifier",
  null_processor: "null_processor",
  stellar_regulator: "stellar_regulator",`,
`  token_amplifier: "token_amplifier",
  stellar_regulator: "stellar_regulator",`
);

source = replaceOnce(
  source,
`    anomaly_compressor: {
      id: "anomaly_compressor",
      name: "Anomaly Compressor",
      costs: {
        materials: { anomaly_matter: 20, glitched_alloy: 10 },
        components: { processor_4: 1, conduit_3: 2 },
      },
    },`,
`    instability_buffer: {
      id: "instability_buffer",
      name: "Instability Buffer",
      outputAmount: 2,
      costs: {
        materials: {
          circuit_scrap: 60,
          signal_fragment: 12,
          refined_alloy: 4,
        },
        components: {
          circuit_board_1: 2,
          processor_1: 1,
          stabilizer_1: 1,
        },
      },
    },
    anomaly_compressor: {
      id: "anomaly_compressor",
      name: "Anomaly Compressor",
      outputAmount: 2,
      costs: {
        materials: {
          refined_alloy: 40,
          stabilized_flux: 8,
        },
        components: {
          instability_buffer: 1,
          processor_2: 1,
          conduit_2: 2,
        },
      },
    },
    rift_decoder: {
      id: "rift_decoder",
      name: "Rift Decoder",
      outputAmount: 2,
      costs: {
        materials: {
          stabilized_flux: 35,
          quantum_residue: 6,
          chrono_dust: 2,
        },
        components: {
          anomaly_compressor: 1,
          processor_4: 1,
          matrix_4: 1,
        },
      },
    },`,
  "early Anomaly component recipes"
);

source = replaceOnce(
  source,
`    null_processor: {
      id: "null_processor",
      name: "Null Processor",
      costs: {
        materials: { anomaly_matter: 25, forbidden_circuit: 3 },
        components: { processor_5: 1, matrix_5: 1 },
        tokens: { anomaly_token: 1 },
      },
    },`,
`    null_processor: {
      id: "null_processor",
      name: "Null Processor",
      outputAmount: 2,
      costs: {
        materials: {
          quantum_residue: 30,
          reality_thread: 4,
          dimensional_seal: 1,
        },
        components: {
          rift_decoder: 1,
          processor_6: 1,
          matrix_6: 1,
        },
        tokens: {
          anomaly_token: 1,
        },
      },
    },
    paradox_engine: {
      id: "paradox_engine",
      name: "Paradox Engine",
      outputAmount: 2,
      costs: {
        materials: {
          reality_thread: 18,
          dimensional_seal: 6,
          anomaly_matter: 2,
          singularity_shard: 1,
        },
        components: {
          null_processor: 1,
          processor_8: 1,
          matrix_8: 1,
        },
        tokens: {
          anomaly_token: 1,
        },
      },
    },
    forbidden_singularity: {
      id: "forbidden_singularity",
      name: "Forbidden Singularity",
      outputAmount: 2,
      costs: {
        materials: {
          anomaly_matter: 20,
          glitched_alloy: 5,
          forbidden_circuit: 1,
        },
        components: {
          paradox_engine: 1,
          processor_9: 1,
          matrix_9: 1,
        },
        tokens: {
          anomaly_token: 2,
        },
      },
    },`,
  "late Anomaly component recipes"
);

source = replaceOnce(
  source,
`      ...(costs.components ?? {}),
      [WALL_COMPONENT_BY_PATH[path]]: 1,`,
`      ...(costs.components ?? {}),
      [getWallComponentForPath(path, tier)]: 1,`,
  "main Core wall component"
);

source = replaceOnce(
  source,
`        [\`power_cell_\${compTier}\`]: Math.max(1, Math.ceil(nextTier / 35)),
        [WALL_COMPONENT_BY_PATH[path]]: 1,`,
`        [\`power_cell_\${compTier}\`]: Math.max(1, Math.ceil(nextTier / 35)),
        [getWallComponentForPath(path, nextTier)]: 1,`,
  "Sub-Core wall component"
);

source = replaceOnce(
  source,
`        realignment_matrix: 1,
        [WALL_COMPONENT_BY_PATH[targetPath]]: Math.max(1, Math.ceil(scale / 5)),`,
`        realignment_matrix: 1,
        [getWallComponentForPath(
          targetPath,
          Math.max(PATH_SPLIT_CORE + 1, state.coreTier)
        )]: Math.max(1, Math.ceil(scale / 5)),`,
  "path-switch wall component"
);

source = replaceOnce(
  source,
`  const wall = isWallCore(state, nextTier) ? " | Next wall: Sub-Core available" : "";`,
`  const wall = isWallCore(state, nextTier)
    ? \` | Next wall: \${componentName(
        getWallComponentForPath(
          normalizePathForTier(state, nextTier),
          nextTier
        )
      )}; Sub-Core available\`
    : "";`,
  "Core status wall preview"
);

for (const updateFile of [
  "src/lib/update-notes.ts",
  "src/lib/social-system.ts",
]) {
  if (!fs.existsSync(updateFile)) continue;

  let update = normalize(fs.readFileSync(updateFile, "utf8"));

  if (
    update.includes("const UPDATE_NOTES = [") &&
    !update.includes("Anomaly path progression rebuilt:")
  ) {
    update = update.replace(
      "const UPDATE_NOTES = [",
      'const UPDATE_NOTES = [\n  "Anomaly path progression rebuilt: six staged wall components now scale from Core 16 to 250; early walls no longer require billion-rarity materials.",'
    );

    fs.writeFileSync(
      `${updateFile}.bak.${Date.now()}`,
      fs.readFileSync(updateFile, "utf8")
    );
    fs.writeFileSync(updateFile, update);
    console.log(`✅ Added update note to ${updateFile}.`);
  }
}

if (normalize(originalRaw) === source) {
  console.log("✅ Anomaly progression rebalance is already installed.");
  process.exit(0);
}

const backup = `${file}.bak.${Date.now()}`;
fs.writeFileSync(backup, originalRaw);
fs.writeFileSync(file, source);

console.log(`🧯 Backup: ${backup}`);
console.log("✅ Rebuilt the Anomaly wall progression.");
console.log("✅ Added Instability Buffer, Rift Decoder, Paradox Engine, and Forbidden Singularity.");
console.log("✅ Null Processor moved to Core 130–169 and no longer costs Forbidden Circuits.");
console.log("✅ Every Anomaly wall component craft outputs x2.");
console.log("✅ Existing player data and active Core jobs remain compatible.");
