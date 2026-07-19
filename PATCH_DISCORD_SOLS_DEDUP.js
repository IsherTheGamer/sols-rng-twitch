#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();
const STAMP = Date.now();
const REGISTER_PATH = "src/pages/api/discord-register.ts";
const INTERACTIONS_PATH = "src/pages/api/discord-interactions.ts";
const KEEP = new Set(["run", "commands", "link", "unlink", "whoami"]);

function fail(m){ console.error(`❌ ${m}`); process.exit(1); }
function read(p){ const f=path.join(ROOT,p); if(!fs.existsSync(f)) fail(`Missing ${p}`); return fs.readFileSync(f,"utf8"); }
function write(p,s){ const f=path.join(ROOT,p), b=`${f}.bak.${STAMP}`; fs.copyFileSync(f,b); console.log(`🧯 Backup: ${path.relative(ROOT,b)}`); fs.writeFileSync(f,s,"utf8"); console.log(`✅ Wrote ${p}`); }
function replaceOnce(s,a,b,label){ const c=s.split(a).length-1; if(c!==1) fail(`${label}: expected 1 match, found ${c}`); return s.replace(a,b); }
function matchEnd(s,start,open,close){ let d=0,q="",esc=false,line=false,block=false; for(let i=start;i<s.length;i++){ const c=s[i],n=s[i+1]||""; if(line){ if(c==="\n") line=false; continue; } if(block){ if(c==="*"&&n==="/"){block=false;i++;} continue; } if(q){ if(esc){esc=false;continue;} if(c==="\\"){esc=true;continue;} if(c===q)q=""; continue; } if(c==="/"&&n==="/"){line=true;i++;continue;} if(c==="/"&&n==="*"){block=true;i++;continue;} if(c==='"'||c==="'"||c==='`'){q=c;continue;} if(c===open)d++; if(c===close){d--; if(d===0)return i;} } return -1; }
function parseObjects(body){ const out=[]; let i=0; while(i<body.length){ while(i<body.length && (/\s/.test(body[i])||body[i]===','))i++; if(i>=body.length)break; if(body[i]!=='{')fail(`Unexpected /sols content near ${body.slice(i,i+30)}`); const e=matchEnd(body,i,'{','}'); if(e<0)fail('Could not parse /sols subcommand'); const text=body.slice(i,e+1); const m=text.match(/\bname:\s*"([^"]+)"/); if(!m)fail('Unnamed /sols subcommand'); out.push({name:m[1],text}); i=e+1; } return out; }
function cleanRegister(s){ const cs=s.indexOf('const solsCommand = {'); if(cs<0)fail('Missing solsCommand'); const ol=s.indexOf('options: [',cs); if(ol<0)fail('Missing /sols options'); const as=s.indexOf('[',ol), ae=matchEnd(s,as,'[',']'); if(ae<0)fail('Could not parse /sols options'); const entries=parseObjects(s.slice(as+1,ae)); const kept=entries.filter(x=>KEEP.has(x.name)); const removed=entries.filter(x=>!KEEP.has(x.name)).map(x=>x.name); for(const n of KEEP) if(!kept.some(x=>x.name===n)) fail(`Missing required /sols ${n}`); const rebuilt='[\n'+kept.map(x=>'    '+x.text).join(',\n')+',\n  ]'; s=s.slice(0,as)+rebuilt+s.slice(ae+1); s=s.replace('"Sol\'s RNG command center, Twitch linking and administration"','"Twitch command runner, command browser and account linking"');
 if(!s.includes('const allowedSolsUtilities = new Set(')){
  const anchor=`  const commands = [\n    solsCommand,\n    ...TWITCH_COMMANDS.map(directCommand),\n  ];\n\n`;
  const add=`  const commands = [\n    solsCommand,\n    ...TWITCH_COMMANDS.map(directCommand),\n  ];\n\n  const allowedSolsUtilities = new Set([\n    "run",\n    "commands",\n    "link",\n    "unlink",\n    "whoami",\n  ]);\n\n  const unexpectedSolsSubcommands = solsCommand.options\n    .map((option) => option.name)\n    .filter((name) => !allowedSolsUtilities.has(name));\n\n  if (unexpectedSolsSubcommands.length > 0) {\n    return text(\n      res,\n      \`❌ Duplicate /sols command entries detected: \${unexpectedSolsSubcommands.join(\n        ", "\n      )}\`\n    );\n  }\n\n`;
  s=replaceOnce(s,anchor,add,'Insert duplicate guard');
 }
 return {s,removed}; }
function removeIf(s,name){ const marker=`    if (current.name === "${name}") {`; const at=s.indexOf(marker); if(at<0)return s; const b=s.indexOf('{',at),e=matchEnd(s,b,'{','}'); if(e<0)fail(`Could not parse ${name} handler`); let end=e+1; while(s[end]==='\r'||s[end]==='\n')end++; return s.slice(0,at)+s.slice(end); }

let register=read(REGISTER_PATH), interactions=read(INTERACTIONS_PATH);
const r=cleanRegister(register); register=r.s;
for(const n of ["info","update","material","leaderboard","records","firsts","rollaccess","alerts"]) interactions=removeIf(interactions,n);
interactions=interactions.replace('name: option?.name ?? "info",','name: option?.name ?? "commands",');
interactions=interactions.replace(`  const current = subcommand(interaction);\n  const channelId =\n    process.env.DEFAULT_CHANNEL_ID ?? "904797805";\n\n  try {`,`  const current = subcommand(interaction);\n\n  try {`);
interactions=interactions.replace('"Unknown /sols subcommand.",','"Unknown /sols utility. Use /sols commands or /sols run.",');
write(REGISTER_PATH,register); write(INTERACTIONS_PATH,interactions);
console.log(''); console.log('✅ /sols duplicate cleanup installed.'); console.log(`   Removed: ${r.removed.join(', ')||'none'}`); console.log('   Kept: run, commands, link, unlink, whoami');
