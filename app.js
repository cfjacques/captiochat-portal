// app.js — CaptioChat Portal (MVP)
// package.json precisa ter: { "type": "module", "scripts": { "start": "node app.js" } }

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ===== ENV =====
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v19.0";
const META_APP_ID   = process.env.META_APP_ID || "";
const META_SECRET   = process.env.META_APP_SECRET || "";
const REDIRECT_URI  = process.env.META_REDIRECT_URI || "https://app.captiochat.com/auth/meta/callback";
const VERIFY_TOKEN  = process.env.META_VERIFY_TOKEN || "CAPTIOCHAT_VERIFY_123";

// ===== MEMÓRIA (demo) =====
const mem = {
  tokens: new Map(), // tenant -> { userLong, pageId, pageToken, channel, savedAt }
  events: new Map(), // tenant -> [{...}]
};

// ===== ESTÁTICOS / ASSETS / FAVICON =====
app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(path.join(__dirname, "public", "assets"), { maxAge: "1y", etag: false }));
app.get("/favicon.ico", (_req, res) => res.sendFile(path.join(__dirname, "public", "assets", "favicon.ico")));

// ===== HEALTH =====
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ===== HOME SIMPLES =====
app.get("/", (_req, res) => res.send("CaptioChat portal online 🚀"));

// ===== PÁGINAS LEGAIS (placeholder) =====
app.get("/legal/privacy", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8">
  <title>Privacy</title>
  <style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style>
  <h1>Privacy Policy</h1><p>Processamos apenas o necessário para conectar sua conta Meta.</p>`);
});
app.get("/legal/tos", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8">
  <title>TOS</title>
  <style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style>
  <h1>Terms of Service</h1><p>Ao usar o CaptioChat você concorda com estas condições e com as Meta Platform Policies.</p>`);
});

// ===== /COMECAR (render inline; Instagram = Em breve) =====
app.get("/comecar", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CaptioChat – Começar</title>
<link rel="icon" href="/assets/favicon.ico"/>
<style>
:root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--primary:#2563eb;--card:#0b1222;--border:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
.nav{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:16px auto;padding:0 16px}
.brand{display:flex;gap:10px;align-items:center;font-weight:800}.brand img{width:28px;height:28px;border-radius:8px}
.link{color:#94a3b8;text-decoration:none;border:1px solid var(--border);padding:8px 12px;border-radius:10px}
.wrap{max-width:1100px;margin:28px auto;padding:0 16px}
h2{margin:4px 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start}
.card h4{margin:4px 0 6px}.muted{color:var(--muted)}
.pill{font-size:12px;border:1px solid var(--border);padding:4px 8px;border-radius:999px;color:#a3e635}
.pill-yellow{color:#facc15}.btn{margin-left:auto;background:var(--primary);color:#fff;border:0;border-radius:10px;padding:8px 12px;cursor:pointer}
.btn[disabled]{opacity:.5;cursor:not-allowed}.sep{height:1px;background:var(--border);margin:18px 0}
.icon{width:22px;height:22px}
</style></head>
<body>
<div class="nav">
  <div class="brand"><a href="/"><img src="/assets/logo.png" alt="CaptioChat"/></a><span>CaptioChat</span></div>
  <a class="link" href="/">Voltar</a>
</div>
<div class="wrap">
  <h2>Onde você quer começar?</h2>
  <div class="grid">
    <div class="card" aria-disabled="true">
      <svg class="icon" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="#e1306c" stroke-width="2"/>
        <circle cx="12" cy="12" r="3.5" stroke="#e1306c" stroke-width="2"/>
        <circle cx="17.5" cy="6.5" r="1.4" fill="#e1306c"/>
      </svg>
      <div><h4>Instagram</h4><div class="muted">Em breve.</div><div class="sep"></div><span class="pill pill-yellow">Em breve</span></div>
      <button class="btn" disabled>Conectar</button>
    </div>
    <div class="card">
      <svg class="icon" viewBox="0 0 24 24" fill="none">
        <path d="M12 3c5 0 9 3.7 9 8.2S17 19.4 12 19.4a8.7 8.7 0 0 1-3.1-.6L5 21l.9-3.5A8.3 8.3 0 0 1 3 11.2C3 6.7 7 3 12 3Z" stroke="#0084ff" stroke-width="2"/>
        <path d="m8 13 3-3 2 2 3-3" stroke="#0084ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div><h4>Facebook Messenger</h4><div class="muted">Habilite respostas e eventos da Página.</div><div class="sep"></div><span class="pill">Disponível</span></div>
      <button class="btn" onclick="goMessenger()">Conectar</button>
    </div>
  </div>
</div>
<script>
  function tenant(){ const t=new URL(location.href).searchParams.get('tenant_id'); return t||'demo_show'; }
  function goMessenger(){
    const origin = location.href;
    const url = '/connect/meta'
      + '?tenant_id=' + encodeURIComponent(tenant())
      + '&channel='   + encodeURIComponent('messenger')
      + '&origin='    + encodeURIComponent(origin);
    location.href = url;
  }
</script>
</body></html>`);
});

// ===== TELA DE PRÉ-CONSENTIMENTO =====
app.get("/connect/meta", (req, res) => {
  const tenant  = req.query.tenant_id || "demo_show";
  const denied  = req.query.denied === "1";
  const origin  = req.query.origin || "/comecar";
  const channel = req.query.channel || "messenger";

  const msg = denied
    ? `<div style="background:#7f1d1d;color:#fff;padding:12px 16px;border-radius:10px;margin:0 0 16px">
         Conexão cancelada. Nenhuma permissão foi concedida.
       </div>`
    : "";

  const startUrl = `/auth/meta/start?tenant_id=${encodeURIComponent(tenant)}`
                 + `&channel=${encodeURIComponent(channel)}`
                 + `&origin=${encodeURIComponent(origin)}`;

  res.type("html").send(`<!doctype html><meta charset="utf-8">
  <title>Conectar o Facebook Messenger</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--card:#0b1222;--border:rgba(255,255,255,.08);--blue:#2563eb}
    body{margin:0;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,Arial,sans-serif}
    .outer{max-width:960px;margin:32px auto;padding:0 16px}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    a.link{color:#94a3b8;border:1px solid var(--border);padding:8px 12px;border-radius:10px;text-decoration:none}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px}
    .btn{display:inline-flex;gap:8px;align-items:center;background:var(--blue);color:#fff;border:0;border-radius:10px;padding:12px 16px;text-decoration:none}
    .muted{color:var(--muted)}
    h1{margin:0 0 12px} ul{margin:8px 0 0 20px}
  </style>
  <div class="outer">
    <div class="top">
      <div style="display:flex;gap:10px;align-items:center;font-weight:800">
        <img src="/assets/logo.png" width="28" height="28" style="border-radius:8px"> CaptioChat
      </div>
      <a class="link" href="${origin}">Voltar</a>
    </div>
    <div class="grid">
      <div class="card">
        ${msg}
        <h1>Conectar o Facebook Messenger</h1>
        <p>Vamos pedir autorização mínima para listar suas Páginas.</p>
        <a class="btn" href="${startUrl}">Continuar com Facebook</a>
        <p class="muted" style="margin-top:10px">Ao continuar, você concorda com nossos <a href="/legal/tos" style="color:#93c5fd">Termos</a> e <a href="/legal/privacy" style="color:#93c5fd">Privacidade</a>.</p>
      </div>
      <div class="card">
        <h3>O que vamos solicitar:</h3>
        <ul class="muted"><li>Permissão para listar suas Páginas (<code>pages_show_list</code>).</li><li>Geramos um token (demo: memória) e mostramos o Page ID.</li></ul>
      </div>
    </div>
  </div>`);
});

// ===== OAUTH: START =====
app.get("/auth/meta/start", (req, res) => {
  const tenant  = req.query.tenant_id || "demo_show";
  const origin  = req.query.origin || "/comecar";
  const channel = req.query.channel || "messenger";

  const scopes  = ["pages_show_list"].join(",");
  const stateObj = { tenant, origin, channel, t: Date.now() };
  const state    = Buffer.from(JSON.stringify(stateObj)).toString("base64url");

  const url = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`
            + `?client_id=${encodeURIComponent(META_APP_ID)}`
            + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
            + `&scope=${encodeURIComponent(scopes)}`
            + `&state=${encodeURIComponent(state)}`
            + `&response_type=code`;

  res.redirect(url);
});

// ===== OAUTH: CALLBACK =====
app.get("/auth/meta/callback", async (req, res) => {
  const { code, state, error } = req.query;
  let stateObj = { tenant: "demo_show", origin: "/comecar", channel: "messenger" };
  try { if (state) stateObj = JSON.parse(Buffer.from(state, "base64url").toString("utf8")); } catch {}

  if (error) {
    const back = `/connect/meta?tenant_id=${encodeURIComponent(stateObj.tenant)}`
               + `&channel=${encodeURIComponent(stateObj.channel)}`
               + `&origin=${encodeURIComponent(stateObj.origin)}`
               + `&denied=1`;
    return res.redirect(back);
  }
  if (!code) return res.status(400).send("Missing code");

  try {
    // 1) short-lived
    const url1 = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
               + `?client_id=${encodeURIComponent(META_APP_ID)}`
               + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
               + `&client_secret=${encodeURIComponent(META_SECRET)}`
               + `&code=${encodeURIComponent(code)}`;
    const r1 = await fetch(url1);
    const shortTok = await r1.json();
    if (!r1.ok || !shortTok.access_token) {
      return res.status(400).type("json").send({ error:"Erro token curto", details: shortTok });
    }

    // 2) long-lived
    const url2 = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
               + `?grant_type=fb_exchange_token`
               + `&client_id=${encodeURIComponent(META_APP_ID)}`
               + `&client_secret=${encodeURIComponent(META_SECRET)}`
               + `&fb_exchange_token=${encodeURIComponent(shortTok.access_token)}`;
    const r2 = await fetch(url2);
    const longTok = await r2.json();
    if (!r2.ok || !longTok.access_token) {
      return res.status(400).type("json").send({ error:"Erro token longo", details: longTok });
    }

    // 3) páginas
    const r3 = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(longTok.access_token)}`);
    const pages = await r3.json();
    if (!r3.ok) return res.status(400).type("json").send({ error:"Erro ao listar páginas", details: pages });

    const first = Array.isArray(pages.data) && pages.data.length ? pages.data[0] : null;

    // 4) guarda em memória (demo)
    mem.tokens.set(stateObj.tenant, {
      userLong: longTok.access_token,
      pageId: first?.id || null,
      pageToken: first?.access_token || null,
      channel: stateObj.channel || "messenger",
      savedAt: new Date().toISOString(),
    });

    // 5) resposta
    res.type("html").send(`<!doctype html><meta charset="utf-8">
    <title>Conta conectada</title>
    <style>body{font-family:system-ui;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.5}</style>
    <h2>Conta conectada com sucesso ✅</h2>
    <p><b>Tenant:</b> ${stateObj.tenant}</p>
    <p><b>Page ID:</b> ${first?.id || "—"}</p>
    <p><b>IG User ID:</b> — (em breve)</p>
    <p><b>Page access token:</b> ${first?.access_token ? "salvo em memória (demo)" : "—"}</p>
    <p><b>Versão da API:</b> ${GRAPH_VERSION}</p>
    <p><a href="${stateObj.origin}">Voltar</a></p>`);
  } catch (e) {
    res.status(500).type("json").send({ error:"callback-failed", message:String(e) });
  }
});

// ===== WEBHOOKS META =====
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

app.post("/webhooks/meta", async (req, res) => {
  try {
    const body = req.body || {};
    const pageId = body?.entry?.[0]?.id || null;
    let tenantForEvent = null;
    for (const [tenant, t] of mem.tokens.entries()) {
      if (t.pageId && t.pageId === pageId) { tenantForEvent = tenant; break; }
    }
    if (!tenantForEvent) tenantForEvent = "unknown";
    if (!mem.events.has(tenantForEvent)) mem.events.set(tenantForEvent, []);
    mem.events.get(tenantForEvent).push({ receivedAt: new Date().toISOString(), body });
    res.sendStatus(200);
  } catch { res.sendStatus(200); }
});

// ===== DEBUG =====
app.get("/meta/events", (req, res) => {
  const tenant = req.query.tenant_id || "demo_show";
  res.type("json").send(mem.events.get(tenant) || []);
});
app.get("/debug/redirect", (_req, res) => res.send(REDIRECT_URI));

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Portal up on :${PORT} | Graph ${GRAPH_VERSION}`);
});
