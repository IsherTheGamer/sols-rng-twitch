import type { NextApiRequest, NextApiResponse } from "next";

function html(body: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Nightbot OAuth</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 850px; margin: 40px auto; line-height: 1.5; }
      code, pre { background: #f3f3f3; padding: 8px; border-radius: 6px; display: block; white-space: pre-wrap; word-break: break-all; }
      .ok { color: green; font-weight: bold; }
      .bad { color: red; font-weight: bold; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";
  const errorDescription =
    typeof req.query.error_description === "string"
      ? req.query.error_description
      : "";

  if (error) {
    res
      .status(400)
      .send(
        html(
          `<h1 class="bad">Nightbot OAuth failed</h1>
<p><b>Error:</b> ${error}</p>
<p><b>Description:</b> ${errorDescription}</p>`
        )
      );
    return;
  }

  if (!code) {
    res.status(200).send(
      html(`<h1>Nightbot OAuth callback</h1>
<p>No code yet. Start from the Nightbot authorize URL.</p>`)
    );
    return;
  }

  const clientId = process.env.NIGHTBOT_CLIENT_ID;
  const clientSecret = process.env.NIGHTBOT_CLIENT_SECRET;
  const redirectUri = "https://sols-rng-twitch.vercel.app/api/nightbot-oauth";

  if (!clientId || !clientSecret) {
    res.status(500).send(
      html(`<h1 class="bad">Missing Vercel env vars</h1>
<p>Add these to Vercel:</p>
<pre>NIGHTBOT_CLIENT_ID
NIGHTBOT_CLIENT_SECRET</pre>`)
    );
    return;
  }

  const form = new URLSearchParams();

  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code);

  const tokenRes = await fetch("https://api.nightbot.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const raw = await tokenRes.text();

  let parsed: any = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!tokenRes.ok) {
    res.status(400).send(
      html(`<h1 class="bad">Token exchange failed</h1>
<p>Status: ${tokenRes.status}</p>
<pre>${raw}</pre>
<p>Make sure the Nightbot app redirect URL is exactly:</p>
<pre>${redirectUri}</pre>`)
    );
    return;
  }

  const accessToken = parsed?.access_token;
  const refreshToken = parsed?.refresh_token;
  const scope = parsed?.scope;
  const expiresIn = parsed?.expires_in;

  res.status(200).send(
    html(`<h1 class="ok">Nightbot OAuth worked!</h1>
<p>Copy this access token into Vercel as <b>NIGHTBOT_TOKEN</b>:</p>
<pre>${accessToken}</pre>

<p>Optional refresh token:</p>
<pre>${refreshToken ?? "none"}</pre>

<p>Scope:</p>
<pre>${scope ?? "unknown"}</pre>

<p>Expires in:</p>
<pre>${expiresIn ?? "unknown"} seconds</pre>

<p>After saving NIGHTBOT_TOKEN in Vercel, redeploy and run <b>!testsend</b>.</p>`)
  );
}
