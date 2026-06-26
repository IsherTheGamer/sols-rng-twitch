import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const file = join(process.cwd(), "data", "auras.json");
const data = JSON.parse(readFileSync(file, "utf8"));

function patchAura(id: string, patch: any) {
  const aura = data.auras.find((a: any) => a.id === id);
  if (!aura) {
    console.log(`Missing aura: ${id}`);
    return;
  }

  Object.assign(aura, patch);
  console.log(`Patched ${id}`);
}

patchAura("eden", {
  potion: { id: "void_heart", rarity: 200 },
  unobtainable: false,
  deleted: false,
  biome: null,
  biomeLock: false,
  noBreakthrough: false,
  luckImmune: true,
  tags: ["challenged+"],
});

patchAura("neferkhaf", {
  potion: { id: "dune", rarity: 50000 },
  unobtainable: false,
  deleted: false,
  biome: null,
  biomeLock: false,
  noBreakthrough: false,
  luckImmune: true,
});

for (const id of [
  "memory",
  "oblivion_aura",
  "fragments_of_the_red_crimson_moon_1",
  "fragments_of_the_red_crimson_moon_2",
  "abomination_aura",
  "red_full_moon_aura",
  "edict",
  "mastermind",
  "another_realm",
]) {
  patchAura(id, {
    unobtainable: false,
    deleted: false,
    biome: null,
    biomeLock: false,
    noBreakthrough: false,
    luckImmune: true,
  });
}

writeFileSync(file, JSON.stringify(data, null, 2));
console.log("auras.json fixed");
