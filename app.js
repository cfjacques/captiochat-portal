// app.js — CaptioChat Portal (MVP OAuth Meta)
// Executa com "node app.js" (package.json com "type":"module")

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------- Setup básico ----------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Variáveis de ambiente
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v19.0";
const META_APP_ID   = process.env.META_APP_ID || "";
const META_SECRET   = process.env.META_APP_SECRET || "";
const REDIRECT_URI  = process.env.META_REDIRECT_URI || "https://app.captiochat.com/auth/meta/callback";
const VERIFY_TOKEN  = process.env.META_VERIFY_TOKEN || "CAPTIOCHAT_VERIFY_123";

// Armazenamento em memória (apenas demo!)
const mem = {
  tokens: new Map(), // tenant -> { userLong, pageId, pageToken, channel, savedAt }
  events: new Map(), // tenant -> [eventos]
};

// ---------------------- Estáticos / páginas ----------------------
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/assets",
  express.static(path.join(__dirname, "public", "assets"), { maxAge: "1y", etag: false })
);
app.get("/favicon.ico", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "assets", "favicon.ico"))
);

// Health
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Home simples
app.get("/", (_req, res) => res.send("CaptioChat portal online 🚀"));

// Páginas legais (placeholder simples)
app.get("/legal/privacy", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8">
  <title>CaptioChat – Privacy Policy</title>
  <style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style>
  <h1>Privacy Policy</h1>
  <p>We only process data needed to connect your Meta accounts and deliver automations.</p>
  <p>Contact: legal@captiochat.com</p>`);
});
app.get("/legal/tos", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8">
  <title>CaptioChat – Terms of Service</title>
  <style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style>
  <h1>Terms of Service</h1>
  <p>By using CaptioChat you agree to Meta Platform Policies and these Terms.</p>`);
});

// Página "Começar" (UI está em public/comecar-app.html)
app.get("/comecar", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "comecar-app.html"))
);

// ---------------------- Tela de conexão (antes do OAuth) ----------------------
// GET /connect/meta?tenant_id=demo_show&channel=messenger&origin=<url>&denied=1
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
    h1{margin:0 0 12px}
    ul{margin:8px 0 0 20px}
  </style>
  <div class="outer">
    <div class="top">
      <div style="display:flex;gap:10px;align-items:center;font-weight:800">
        <img src="/assets/logo.png" width="28" height="28" style="border-radius:8px">
        CaptioChat
      </div>
      <a class="link" href="${origin}">Voltar</a>
    </div>

    <div class="grid">
      <div class="card">
        ${msg}
        <h1>Conectar o Facebook Messenger</h1>
        <p>Vamos pedir ao Facebook autorização mínima para listar suas Páginas e escolher qual conectar.</p>
        <a class="btn" href="${startUrl}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 3c5 0 9 3.7 9 8.2S17 19.4 12 19.4a8.7 8.7 0 0 1-3.1-.6L5 21l.9-3.5A8.3 8.3 0 0 1 3 11.2C3 6.7 7 3 12 3Z" stroke="white" stroke-width="2"/>
            <path d="m8 13 3-3 2 2 3-3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Continuar com Facebook
        </a>
        <p class="muted" style="margin-top:10px">Ao continuar, você concorda com nossos <a href="/legal/tos" style="color:#93c5fd">Termos</a> e <a href="/legal/privacy" style="color:#93c5fd">Privacidade</a>.</p>
      </div>
      <div class="card">
        <h3>O que vamos solicitar:</h3>
        <ul class="muted">
          <li>Permissão para listar suas Páginas (escopo <code>pages_show_list</code>).</li>
          <li>Geramos um token seguro (demo: memória) e mostramos o Page ID conectado.</li>
          <li>Você pode revogar quando quiser nas configurações do Facebook.</li>
        </ul>
      </div>
    </div>
  </div>`);
});

// ---------------------- OAuth: iniciar ----------------------
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

// ---------------------- OAuth: callback ----------------------
app.get("/auth/meta/callback", async (req, res) => {
  const { code, state, error } = req.query;
  let stateObj = { tenant: "demo_show", origin: "/comecar", channel: "messenger" };
  try { if (state) stateObj = JSON.parse(Buffer.from(state, "base64url").toString("utf8")); } catch {}

  // Usuário cancelou
  if (error) {
    const back = `/connect/meta?tenant_id=${encodeURIComponent(stateObj.tenant)}`
               + `&channel=${encodeURIComponent(stateObj.channel)}`
               + `&origin=${encodeURIComponent(stateObj.origin)}`
               + `&denied=1`;
    return res.redirect(back);
  }

  if (!code) return res.status(400).send("Missing code");

  try {
    // 1) short-lived user token
    const url1 = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
               + `?client_id=${encodeURIComponent(META_APP_ID)}`
               + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
               + `&client_secret=${encodeURIComponent(META_SECRET)}`
               + `&code=${encodeURIComponent(code)}`;

    const r1 = await fetch(url1);
    const shortTok = await r1.json();

    if (!r1.ok || !shortTok.access_token) {
      return res.type("json").status(400).send({
        error: "Erro ao obter token curto",
        details: shortTok,
      });
    }

    // 2) long-lived user token
    const url2 = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
               + `?grant_type=fb_exchange_token`
               + `&client_id=${encodeURIComponent(META_APP_ID)}`
               + `&client_secret=${encodeURIComponent(META_SECRET)}`
               + `&fb_exchange_token=${encodeURIComponent(shortTok.access_token)}`;

    const r2 = await fetch(url2);
    const longTok = await r2.json();

    if (!r2.ok || !longTok.access_token) {
      return res.type("json").status(400).send({
        error: "Erro ao trocar por token longo",
        details: longTok,
      });
    }

    // 3) listar páginas
    const r3 = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(longTok.access_token)}`);
    const pages = await r3.json();
    if (!r3.ok) {
      return res.type("json").status(400).send({ error: "Erro ao listar páginas", details: pages });
    }

    const first = Array.isArray(pages.data) && pages.data.length ? pages.data[0] : null;

    // 4) armazenar em memória (demo)
    mem.tokens.set(stateObj.tenant, {
      userLong: longTok.access_token,
      pageId: first?.id || null,
      pageToken: first?.access_token || null,
      channel: stateObj.channel || "messenger",
      savedAt: new Date().toISOString(),
    });

    // 5) resposta amigável
    res.type("html").send(`<!doctype html><meta charset="utf-8">
    <title>Conta conectada</title>
    <style>body{font-family:system-ui,Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.5}</style>
    <h2>Conta conectada com sucesso ✅</h2>
    <p><b>Tenant:</b> ${stateObj.tenant}</p>
    <p><b>Page ID:</b> ${first?.id || "—"}</p>
    <p><b>IG User ID:</b> — (vincule um IG Business/Creator à Página)</p>
    <p><b>Page access token:</b> ${first?.access_token ? "salvo em memória (demo)" : "—"}</p>
    <p><b>Versão da API:</b> ${GRAPH_VERSION}</p>
    <p><a href="${stateObj.origin}">Voltar</a></p>`);
  } catch (e) {
    res.status(500).type("json").send({ error: "callback-failed", message: String(e) });
  }
});

// ---------------------- Webhooks Meta ----------------------
// Verificação
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Recepção (apenas log + guarda em memória por tenant associado ao pageId)
app.post("/webhooks/meta", async (req, res) => {
  try {
    const body = req.body || {};
    // tentar identificar tenant pelo pageId que vier no evento
    // (simplificado para demo: procura no mem.tokens por pageId igual)
    const pageId =
      body?.entry?.[0]?.id ||
      body?.entry?.[0]?.changes?.[0]?.value?.from?.id ||
      null;

    let tenantForEvent = null;
    for (const [tenant, t] of mem.tokens.entries()) {
      if (t.pageId && t.pageId === pageId) {
        tenantForEvent = tenant; break;
      }
    }
    if (!tenantForEvent) tenantForEvent = "unknown";

    if (!mem.events.has(tenantForEvent)) mem.events.set(tenantForEvent, []);
    mem.events.get(tenantForEvent).push({ receivedAt: new Date().toISOString(), body });

    res.sendStatus(200);
  } catch {
    res.sendStatus(200);
  }
});

// ---------------------- Utilitários de debug ----------------------
app.get("/meta/events", (req, res) => {
  const tenant = req.query.tenant_id || "demo_show";
  res.type("json").send(mem.events.get(tenant) || []);
});

app.get("/debug/redirect", (_req, res) => res.send(REDIRECT_URI));

// ---------------------- Start ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Portal up on :${PORT} | Graph ${GRAPH_VERSION}`);
});
