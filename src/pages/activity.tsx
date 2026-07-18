import Head from "next/head";
import type { CSSProperties } from "react";

const STEPS = [
  ["1. Earn Knowledge","Real rolls whose best result is 1/10,000+ grant Knowledge.","!knowledge"],
  ["2. Buy real research","Every node now states an implemented effect; the bot recommends your next upgrade.","!research next"],
  ["3. Use the Scanner","Scanner levels reveal bosses, events, Core walls, and the best useful action.","!scanner"],
  ["4. Fight bosses","Rolls deal damage. Bosses grant Marks, Shards, Fragments, and Knowledge.","!boss"],
  ["5. Assemble blueprints","Permanent upgrades with exact Fragment costs and effects.","!blueprints guide"],
  ["6. Forge and equip relics","Real effects, levels, rarities, slots, upgrades, and rerolls.","!relics guide"],
];

const CURRENCIES = [
  ["Knowledge","Rare-roll research currency","!research next"],
  ["Merchant Marks","Earned from boss damage","!market"],
  ["Relic Shards","Forge/upgrade/reroll relics","!relics guide"],
  ["Blueprint Fragments","Assemble permanent upgrades","!blueprints guide"],
];

const COMMANDS = [
  ["Knowledge","!knowledge"],
  ["Research","!research guide / next / branches / info / unlock"],
  ["Scanner","!scanner"],
  ["Boss","!boss / !boss start / !boss beacon"],
  ["World Event","!worldevent"],
  ["Forecast","!forecast"],
  ["Market","!market / !market buy <id>"],
  ["Blueprints","!blueprints guide / info / assemble"],
  ["Relics","!relics guide / list / forge / info / equip / upgrade / reroll"],
];

export default function ActivityPage(){
  return <><Head><title>Activity of Knowledge Guide</title></Head>
  <main style={page}><div style={container}>
    <header style={{marginBottom:28}}>
      <p style={eyebrow}>SOL&apos;S RNG TWITCH BOT</p>
      <h1 style={title}>Activity of Knowledge — Clear Guide</h1>
      <p style={lead}>The loop is now visible: roll → earn Knowledge → research → fight bosses → assemble blueprints → forge relics.</p>
      <p><a href="/dashboard" style={link}>← Dashboard</a> · <a href="/crafting" style={link}>Crafting Guide</a></p>
    </header>
    <section style={grid}>{STEPS.map(([name,text,command])=><article key={name} style={card}><h2 style={{margin:"0 0 8px",fontSize:19}}>{name}</h2><p style={muted}>{text}</p><code style={code}>{command}</code></article>)}</section>
    <section style={section}><h2 style={{marginTop:0}}>Currencies</h2><div style={grid}>{CURRENCIES.map(([name,use,command])=><article key={name} style={mini}><strong>{name}</strong><p style={muted}>{use}</p><code style={code}>{command}</code></article>)}</div></section>
    <section style={section}><h2 style={{marginTop:0}}>Commands</h2><div style={{display:"grid",gap:10}}>{COMMANDS.map(([name,command])=><div key={name} style={row}><strong>{name}</strong><code style={code}>{command}</code></div>)}</div></section>
    <section style={section}><h2 style={{marginTop:0}}>Relics are real now</h2><p style={muted}>Equipped relics improve Knowledge, boss damage, Merchant Marks, market discounts, Blueprint Fragment chance, Relic Shard rewards, or Scanner strength. Relic Slot research controls how many can be equipped.</p></section>
    <section style={section}><h2 style={{marginTop:0}}>Research is no longer vague</h2><p style={muted}>Every node describes an active effect. Use <code style={code}>!research next</code> whenever you are unsure.</p></section>
  </div></main></>;
}

const page:CSSProperties={minHeight:"100vh",padding:24,color:"#f5f7ff",background:"radial-gradient(circle at top, rgba(79,90,196,.28), transparent 34%), #070914",fontFamily:"Inter,system-ui,sans-serif"};
const container:CSSProperties={maxWidth:1180,margin:"0 auto"};
const eyebrow:CSSProperties={margin:0,color:"#9aa7ff",fontWeight:900,letterSpacing:1.2};
const title:CSSProperties={margin:"6px 0",fontSize:44};
const lead:CSSProperties={maxWidth:900,color:"#c5cce4",lineHeight:1.6};
const link:CSSProperties={color:"#aab5ff"};
const grid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14};
const card:CSSProperties={padding:17,border:"1px solid #2c3769",borderRadius:16,background:"rgba(17,21,42,.94)"};
const mini:CSSProperties={padding:14,border:"1px solid #293461",borderRadius:13,background:"#090c19"};
const muted:CSSProperties={color:"#bec6df",lineHeight:1.5};
const code:CSSProperties={color:"#b6ffdf",background:"#05070e",padding:"3px 6px",borderRadius:6};
const section:CSSProperties={marginTop:22,padding:18,border:"1px solid #26315c",borderRadius:18,background:"rgba(14,18,36,.92)"};
const row:CSSProperties={display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:10,padding:12,border:"1px solid #28325d",borderRadius:11,background:"#080a14"};
