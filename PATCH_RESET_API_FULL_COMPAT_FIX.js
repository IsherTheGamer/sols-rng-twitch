const fs = require("fs");

function patchFile(path, patcher) {
  if (!fs.existsSync(path)) {
    console.warn(`⚠️ Missing ${path}, skipped.`);
    return;
  }

  const before = fs.readFileSync(path, "utf8");
  const after = patcher(before);

  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`✅ Patched ${path}`);
  } else {
    console.log(`ℹ️ No changes needed for ${path}`);
  }
}

patchFile("src/pages/api/reset.ts", (s) => {
  // 1) Make global/server key whitelist include newer systems.
  const oldIsGlobal = `function isGlobalKey(key: string): boolean {
  return (
    key === "global:rolls" ||
    key === "global:achievement-state" ||
    key.startsWith("social:recent:") ||
    key.startsWith("social:boosts:") ||
    key.startsWith("social:chat:") ||
    key.startsWith("social:merchant:") ||
    key.startsWith("social:npc:") ||
    key.startsWith("social:flex:")
  );
}`;

  const newIsGlobal = `function isGlobalKey(key: string): boolean {
  return (
    key === "global:rolls" ||
    key === "global:achievement-state" ||
    key.startsWith("global:") ||
    key.startsWith("social:recent:") ||
    key.startsWith("social:boosts:") ||
    key.startsWith("social:chat:") ||
    key.startsWith("social:merchant:") ||
    key.startsWith("social:npc:") ||
    key.startsWith("social:flex:") ||
    key.startsWith("mega:") ||
    key.startsWith("aok:channel:") ||
    key.startsWith("core-channel-active:")
  );
}`;

  if (s.includes(oldIsGlobal)) {
    s = s.replace(oldIsGlobal, newIsGlobal);
  }

  // 2) Allow all reset to delete new per-user Activity Of Knowledge keys.
  if (!s.includes(`key.startsWith("aok:player:")`)) {
    s = s.replace(
      `      key.startsWith("rolls:") ||
      isGlobalKey(key)`,
      `      key.startsWith("rolls:") ||
      key.startsWith("aok:player:") ||
      isGlobalKey(key)`
    );
  }

  // 3) Activity Of Knowledge is player progress, so profile/player reset should include it.
  if (!s.includes(`key.startsWith("aok:player:") ||\n      key.startsWith("viewer-profile:")`)) {
    s = s.replace(
      `      key.startsWith("profiles:") ||
      key.startsWith("viewer-profile:")`,
      `      key.startsWith("profiles:") ||
      key.startsWith("aok:player:") ||
      key.startsWith("viewer-profile:")`
    );
  }

  // 4) Server reset should add newer exact channel server keys too.
  if (!s.includes('keys.add(`aok:channel:${channelId}`);')) {
    s = s.replace(
      `  keys.add(\`social:flex:\${channelId}\`);
}`,
      `  keys.add(\`social:flex:\${channelId}\`);

  keys.add(\`aok:channel:\${channelId}\`);
  keys.add(\`core-channel-active:\${channelId}\`);
  keys.add(\`mega:lastbiome:\${channelId}\`);
  keys.add(\`mega:discord:\${channelId}\`);
}`
    );
  }

  // 5) Scan all channel server keys when old URL uses global=1&server=1.
  const oldAddAll = `async function addAllChannelSocialKeys(
  r: Redis,
  keys: Set<string>,
  scope: ResetScope
): Promise<void> {
  await addKeysByPattern(r, keys, "social:recent:*", scope);
  await addKeysByPattern(r, keys, "social:boosts:*", scope);
  await addKeysByPattern(r, keys, "social:chat:*", scope);
  await addKeysByPattern(r, keys, "social:merchant:*", scope);
  await addKeysByPattern(r, keys, "social:npc:*", scope);
  await addKeysByPattern(r, keys, "social:flex:*", scope);
}`;

  const newAddAll = `async function addAllChannelSocialKeys(
  r: Redis,
  keys: Set<string>,
  scope: ResetScope
): Promise<void> {
  await addKeysByPattern(r, keys, "social:recent:*", scope);
  await addKeysByPattern(r, keys, "social:boosts:*", scope);
  await addKeysByPattern(r, keys, "social:chat:*", scope);
  await addKeysByPattern(r, keys, "social:merchant:*", scope);
  await addKeysByPattern(r, keys, "social:npc:*", scope);
  await addKeysByPattern(r, keys, "social:flex:*", scope);

  await addKeysByPattern(r, keys, "aok:channel:*", scope);
  await addKeysByPattern(r, keys, "core-channel-active:*", scope);
  await addKeysByPattern(r, keys, "mega:*", scope);
}`;

  if (s.includes(oldAddAll)) {
    s = s.replace(oldAddAll, newAddAll);
  }

  // 6) For the old URL style, query=all&userId=...&name=...&global=1 should also scan AOK player keys.
  if (!s.includes('await addKeysByPattern(r, keys, `aok:player:*:${userId}`, scope);')) {
    s = s.replace(
      `      await addKeysByPattern(r, keys, \`*:\${userId}:*\`, scope);
      await addKeysByPattern(r, keys, \`*\${userId}*\`, scope);`,
      `      await addKeysByPattern(r, keys, \`*:\${userId}:*\`, scope);
      await addKeysByPattern(r, keys, \`*\${userId}*\`, scope);
      await addKeysByPattern(r, keys, \`aok:player:*:\${userId}\`, scope);`
    );
  }

  // 7) Improve no-match text so old URL troubleshooting is less confusing.
  s = s.replace(
    `No matching reset keys found. Scope=\${scope} | ChannelId=\${channelId} | UserId=\${userId}.`,
    `No matching reset keys found. Scope=\${scope} | ChannelId=\${channelId} | UserId=\${userId} | Tip: old URL format with global=1 searches all channels for this user.`
  );

  return s;
});

console.log("✅ Reset API full compatibility fix complete.");
