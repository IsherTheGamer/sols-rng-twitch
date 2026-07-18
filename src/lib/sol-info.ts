import { auras, biomes, potions, events, devEvents, devices } from "./data";
import { getAllTokenDefinitions, formatTokenDefinitionPage } from "./inventory";
import { truncate } from "./format";
import {
  formatBoxGuide,
  formatComponentGuide,
  formatMaterialGuide,
  formatObtainGuide,
  formatPathComponentGuide,
  formatTokenSourceGuide,
  isKnownTokenGuide,
} from "./progression-info";

const START = [
  "1) !roll earns profile progress, Core materials, Stardust, and Knowledge from 1/10k+ results.",
  "2) !core shows exactly what the next Core needs; !core recipe shows the complete cost.",
  "3) !knowledge explains every Activity currency and recommends research.",
  "4) !research next chooses a useful available upgrade.",
  "5) !scanner tells you what is active and what to do next.",
  "6) Confused by an item? Use !info obtain <name>.",
];
const CURRENCIES = [
  "Stardust: SHD storage; spent on Cores and Reactor.",
  "Knowledge: earned from 1/10k+ rolls; spent with !research.",
  "Merchant Marks: boss-damage currency; spent with !market.",
  "Relic Shards: bosses/Relic Echo/market; spent with !relics.",
  "Blueprint Fragments: bosses/Blueprint Rain/market; !blueprints assemble.",
  "Core Tokens: inspect/use with !core tokens and !core token <name>.",
];
const ACTIVITY = [
  "!knowledge: balances plus recommended research.",
  "!research next / branches / info / unlock.",
  "!scanner: boss, event, Core-wall, and action guidance.",
  "!market: exact offers and rewards.",
  "!blueprints guide / info / assemble.",
  "!relics guide / list / forge / equip / upgrade / reroll.",
  "!boss / !boss beacon / !forecast.",
];
const RELICS = [
  "Earn Shards from bosses, Relic Echo, or !market.",
  "Assemble relic_forge with !blueprints.",
  "Forge: !relics forge; inspect: !relics info 1.",
  "Equip: !relics equip 1; research unlocks slots 2 and 3.",
  "Upgrade level: !relics upgrade 1; rarity: !relics reroll 1.",
  "Effects are real: Knowledge, boss damage, Marks, discounts, fragments, shards, Scanner.",
];
const RESEARCH = [
  "Knowledge comes from the best 1/10k+ aura in a real roll command.",
  "!research next recommends a useful node and exact command.",
  "Every node has an active implemented effect.",
  "Inspect before spending: !research info <id>.",
];
const BLUEPRINTS = [
  "Fragments come from bosses, Blueprint Rain, and Market.",
  "Unlock blueprint_reading then blueprint_assembly.",
  "!blueprints info <id> shows source/effect/cost.",
  "!blueprints assemble <id> permanently activates it.",
];
const COMMANDS = [
  "!info start / currencies / paths / token <name>",
  "!core / recipe / tokens / token use quest|crafting",
  "!knowledge / !research next / !scanner",
  "!relics guide / !blueprints guide / !market",
  "!pquests / !gquests / !lb / !records / !firsts",
  "!replay / !aotd / !botd / !event / !update",
];

function norm(raw:string|undefined|null){return(raw??"").toLowerCase().trim().replace(/^!+/,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
function title(raw:string){return raw.split(/[_\-\s:]+/g).filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");}
function rarity(v:number){return`1/${Math.floor(v).toLocaleString("en-US")}`;}
function page(raw:string|undefined,total:number){const n=Number(String(raw??"1").replace(/,/g,""));return Math.max(1,Math.min(total,Number.isFinite(n)?Math.floor(n):1));}
function paginate<T>(items:T[],raw:string|undefined,fmt:(x:T)=>string,name:string,size=8){const total=Math.max(1,Math.ceil(items.length/size)),p=page(raw,total),shown=items.slice((p-1)*size,p*size).map(fmt);return truncate(`${name} ${p}/${total}: ${shown.join(" | ")||"None"}`,390);}
function split(parts:string[]){const copy=[...parts];let p="";if(copy.length>1&&/^\d+$/.test(copy[copy.length-1]))p=copy.pop()??"";return{query:copy.join(" "),page:p};}
function findAura(q:string){const n=norm(q);return auras.find(x=>norm(x.id)===n||norm(x.name)===n||norm(x.name).replace(/_/g,"")===n.replace(/_/g,""));}
function findBiome(q:string){const n=norm(q);return biomes.find(x=>norm(x.id)===n||norm(x.name)===n);}
function findPotion(q:string){const n=norm(q);return potions.find(x=>norm(x.id)===n||norm(x.name)===n||x.aliases.some(a=>norm(a)===n));}
function staticGuide(items:string[],p:string,name:string){return paginate(items,p,x=>x,name,4);}

function auraInfo(q:string,p?:string){if(q&&!/^\d+$/.test(q)){const a=findAura(q);if(!a)return`Unknown aura: ${q}`;const flags=[a.biome?`Biome ${title(a.biome)}`:null,a.event?`Event ${title(a.event)}`:null,a.devBiome?`Dev ${title(a.devBiome)}`:null,a.potion?`Potion ${title(a.potion.id)} ${rarity(a.potion.rarity)}`:null,a.luckImmune?"Raw luck only":null,a.unobtainable?"Unobtainable":null,a.deleted?"Deleted":null].filter(Boolean);return truncate(`✨ ${a.name} | ${rarity(a.rarity)}${flags.length?` | ${flags.join(" | ")}`:""}`,390);}return paginate([...auras].sort((a,b)=>a.rarity-b.rarity),/^\d+$/.test(q)?q:p,a=>`${a.name} ${rarity(a.rarity)}`,"✨ Auras");}
function biomeInfo(q:string,p?:string){if(q&&!/^\d+$/.test(q)){const b=findBiome(q);if(!b)return`Unknown biome: ${q}`;const chance=b.spawnPerSecond?`Spawn/sec 1/${Math.round(1/b.spawnPerSecond).toLocaleString("en-US")}`:b.spawnOnChange?`On-change 1/${Math.round(1/b.spawnOnChange).toLocaleString("en-US")}`:b.deviceChance?`Device 1/${b.deviceChance.toLocaleString("en-US")}`:b.manualOnly||b.devOnly?"Manual/dev only":"Normal pool";return truncate(`🌍 ${b.name} | ${chance} | BT x${b.breakthroughMultiplier}${b.isRareBiome?" | Rare":""}`,390);}return paginate(biomes,/^\d+$/.test(q)?q:p,b=>`${b.name}${b.isRareBiome?" rare":""}`,"🌍 Biomes");}
function potionInfo(q:string,p?:string){if(q&&!/^\d+$/.test(q)){const x=findPotion(q);if(!x)return`Unknown potion: ${q}`;return truncate(`🧪 ${x.name} | +${Math.floor(x.luck).toLocaleString("en-US")} luck${x.clearsBuffs?" | Clears buffs":""}${x.requiresEvent?` | Event ${title(x.requiresEvent)}`:""}${x.exclusiveAuras?.length?` | ${x.exclusiveAuras.length} exclusive aura(s)`:""}`,390);}return paginate(potions,/^\d+$/.test(q)?q:p,x=>`${x.name} +${Math.floor(x.luck).toLocaleString("en-US")}`,"🧪 Potions");}
function rollTokens(kind:string,p?:string){const mode=norm(kind||"boosts"),all=getAllTokenDefinitions(),special=(t:(typeof all)[number])=>Boolean((t.flatLuck??0)>0||(t.rareBiomePercentLuck??0)>0||(t.finalLuckMultiplier??1)>1),list=mode.includes("potion")||mode.includes("roll")?all.filter(t=>t.kind==="potion"):mode.includes("special")?all.filter(t=>t.kind==="percent_luck"&&special(t)):all.filter(t=>t.kind==="percent_luck"&&!special(t));return formatTokenDefinitionPage(list,p,mode.includes("potion")?"🧪 Roll/Potion Tokens":mode.includes("special")?"✨ Special Luck Tokens":"🎟️ Luck Boost Tokens");}

export function formatSolInfo(rawQuery:string){
  const parts=rawQuery.trim().split(/\s+/).filter(Boolean);if(norm(parts[0])==="sol")parts.shift();const topic=norm(parts.shift()??"help"),{query,page:p}=split(parts),pq=p||query;
  if(topic==="help"||topic==="info")return"📘 Help | !info start | currencies | paths | token <name> | obtain <item> | research | relics | blueprints";
  if(topic==="start"||topic==="begin")return staticGuide(START,pq,"🚀 Start Guide");
  if(["currency","currencies","money"].includes(topic))return staticGuide(CURRENCIES,pq,"💰 Currency Guide");
  if(topic==="commands"||topic==="cmds")return staticGuide(COMMANDS,pq,"🤖 Commands");
  if(["activity","knowledge","aok"].includes(topic))return staticGuide(ACTIVITY,pq,"🧠 Activity Guide");
  if(topic==="research")return staticGuide(RESEARCH,pq,"🧠 Research Guide");
  if(topic==="relic"||topic==="relics")return staticGuide(RELICS,pq,"🧿 Relic Guide");
  if(topic==="blueprint"||topic==="blueprints")return staticGuide(BLUEPRINTS,pq,"📘 Blueprint Guide");
  if(topic==="aura"||topic==="auras")return auraInfo(query,p);
  if(topic==="biome"||topic==="biomes")return biomeInfo(query,p);
  if(topic==="potion"||topic==="potions")return potionInfo(query,p);
  if(topic==="token"||topic==="tokens"){const first=norm(query.split(/\s+/)[0]??"");if(["boost","boosts","potion","potions","special"].includes(first))return rollTokens(first,p);if(["source","sources","obtain","how","get"].includes(first))return formatTokenSourceGuide(query.split(/\s+/).slice(1).join(" "),p);if(isKnownTokenGuide(query))return formatTokenSourceGuide(query,p);return"🎟️ Two token systems | Core tokens: !info token quest | Roll tokens: !info token boosts/potions | Owned Core tokens: !core tokens";}
  if(topic==="boost"||topic==="boosts")return rollTokens("boosts",query||p);
  if(topic==="special")return rollTokens("special",query||p);
  if(topic==="path"||topic==="paths")return formatPathComponentGuide(query,p);
  if(topic==="material"||topic==="materials")return formatMaterialGuide(query,p);
  if(topic==="component"||topic==="components")return formatComponentGuide(query,p);
  if(topic==="box"||topic==="boxes")return formatBoxGuide(query,p);
  if(["obtain","source","sources","how","get"].includes(topic))return formatObtainGuide(query,p);
  if(topic==="events"||topic==="event")return paginate(events as Array<{name:string}>,pq,e=>e.name,"🎉 Events");
  if(topic==="dev"||topic==="devs")return paginate(devEvents as Array<{name?:string;id:string}>,pq,e=>e.name??title(e.id),"🛠️ Dev Biomes");
  if(topic==="device"||topic==="devices")return paginate(devices as Array<{name:string}>,pq,d=>d.name,"📟 Devices");
  if(["core","cores","shd","reactor","quest","quests"].includes(topic))return truncate(`📘 ${title(topic)} | Status: !${topic==="cores"?"core":topic} | Exact source: !info obtain <name> | Token help: !core tokens`,390);
  return auraInfo([topic,query].filter(Boolean).join(" "));
}
