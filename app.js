// app.js — CaptioChat MVP (Render)
// Node 18+ (usa fetch global). Sem dependências externas.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ------------ Env ------------
const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI || "https://app.captiochat.com/auth/meta/callback";
const META_VERSION = process.env.META_GRAPH_VERSION || "v19.0";

// Para o botão VOLTAR (para o seu site público).
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://www.captiochat.com";

// ------------ Express básico ------------
const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir a pasta "public" (index.html, comecar.html, assets/*)
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Healthcheck
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Debug: ver qual redirect_uri está em uso
app.get("/debug/redirect", (_req, res) => res.type("text").send(META_REDIRECT_URI));

// ------------- DEMO: Página de conexão do Messenger (HTML simples) -------------
app.get("/connect/meta", (req, res) => {
  const denied = req.query.denied ? `<div class="alert">Conexão cancelada. Nenhuma permissão foi concedida.</div>` : "";
  const tenant = (req.query.tenant_id || "demo_show").toString();

  const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Conectar — Facebook Messenger</title>
<link rel="icon" href="/assets/favicon.ico"/>
<style>
:root{--bg:#0b1020;--card:#0f172a;--fg:#e5e7eb;--muted:#94a3b8;--accent:#2563eb;--ok:#22c55e}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,Arial,sans-serif}
.nav{display:flex;align-items:center;justify-content:space-between;max-width:1000px;margin:16px auto;padding:0 16px}
.brand{display:flex;gap:10px;align-items:center;font-weight:800}
.brand img{width:28px;height:28px;border-radius:8px}
.btn-back{background:transparent;border:1px solid rgba(255,255,255,.15);color:var(--fg);padding:10px 14px;border-radius:10px;text-decoration:none}
.wrap{max-width:1000px;margin:24px auto;padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.card{background:var(--card);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px}
h1{margin:0 0 8px;font-size:34px}
p{color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border:0;border-radius:10px;padding:14px 18px;font-weight:700;text-decoration:none}
.alert{background:#2b0f10;color:#ffb4b9;border:1px solid #43191b;padding:12px 14px;border-radius:10px;margin-bottom:16px}
ul{margin:8px 0 0 20px;color:var(--muted)}
</style>
</head>
<body>
  <div class="nav">
    <div class="brand">
      <img src="/assets/logo.png" alt="CaptioChat"/>
      <span>CaptioChat</span>
    </div>
    <a class="btn-back" href="${SITE_ORIGIN}">Voltar</a>
  </div>

  <div class="wrap">
    <div class="card">
      <h1>Conectar o Facebook<br/>Messenger</h1>
      ${denied}
      <p>Vamos pedir autorização mínima para listar suas Páginas.</p>
      <a class="btn" href="/auth/meta/start?tenant_id=${encodeURIComponent(tenant)}">
        Continuar com Facebook
      </a>
      <p style="margin-top:12px;color:#94a3b8">Ao continuar, você concorda com nossos
      <a href="/legal/tos" style="color:#cbd5e1">Termos</a> e
      <a href="/legal/privacy" style="color:#cbd5e1">Privacidade</a>.</p>
    </div>

    <div class="card">
      <h2>O que vamos solicitar:</h2>
      <ul>
        <li>Permissão para listar suas Páginas (<code>pages_show_list</code>).</li>
        <li>Geramos um token (demo: memória) e mostramos o Page ID.</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
  res.type("html").send(html);
});

// ------------- OAuth START (com dry-run e teste m.facebook.com) -------------
app.get("/auth/meta/start", (req, res) => {
  try {
    const tenantId = (req.query.tenant_id || "demo_show").toString();
    const dry = req.query.dry === "1";        // se ?dry=1 → só exibe o URL
    const useMobile = req.query.use_m === "1";// se ?use_m=1 → m.facebook.com

    const scopes = "pages_show_list";
    const fbDomain = useMobile ? "https://m.facebook.com" : "https://www.facebook.com";

    const authUrl =
      `${fbDomain}/${META_VERSION}/dialog/oauth` +
      `?client_id=${encodeURIComponent(META_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(tenantId)}` +
      `&scope=${encodeURIComponent(scopes)}`;

    if (dry) {
      // Modo debug: mostra o URL que iremos usar
      res.type("text/plain").send(authUrl);
      return;
    }

    // Modo normal: redireciona
    res.redirect(authUrl);
  } catch (e) {
    console.error("Erro em /auth/meta/start:", e);
    res.status(500).send("Erro ao iniciar login com Facebook.");
  }
});

// ------------- OAuth CALLBACK -------------
app.get("/auth/meta/callback", async (req, res) => {
  try {
    // Se usuário cancelou no Facebook:
    if (req.query.error) {
      const state = (req.query.state || "").toString();
      return res.redirect(`/connect/meta?denied=1${state ? `&tenant_id=${encodeURIComponent(state)}` : ""}`);
    }

    const code = (req.query.code || "").toString();
    const tenantId = (req.query.state || "demo_show").toString();

    if (!code) return res.status(400).send("Faltou 'code'.");

    // Troca o code por access_token (short-lived)
    const tokenResp = await fetch(
      `https://graph.facebook.com/${META_VERSION}/oauth/access_token` +
        `?client_id=${encodeURIComponent(META_APP_ID)}` +
        `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
        `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
        `&code=${encodeURIComponent(code)}`
    );
    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok || !tokenJson.access_token) {
      return res.status(400).type("json").send(tokenJson);
    }
    const userAccessToken = tokenJson.access_token;

    // Lista páginas (só para demo visual)
    const pagesResp = await fetch(
      `https://graph.facebook.com/${META_VERSION}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`
    );
    const pages = await pagesResp.json();

    // (Opcional) Trocar por long-lived:
    const llResp = await fetch(
      `https://graph.facebook.com/${META_VERSION}/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(META_APP_ID)}` +
        `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
        `&fb_exchange_token=${encodeURIComponent(userAccessToken)}`
    );
    const llJson = await llResp.json();

    // Telinha de sucesso simples
    const html = `<!doctype html>
<meta charset="utf-8"/>
<title>Conta conectada</title>
<style>
body{font-family:Inter,system-ui,Arial,sans-serif;background:#0b1020;color:#e5e7eb;margin:0;padding:24px}
.card{max-width:920px;margin:20px auto;background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:24px}
h1{margin:0 0 12px}
pre{background:#0b1020;padding:12px;border-radius:10px;white-space:pre-wrap;word-break:break-word}
a.btn{display:inline-block;margin-top:14px;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px}
.small{color:#94a3b8}
</style>
<div class="card">
  <h1>Conta conectada com sucesso ✅</h1>
  <div class="small">Tenant: <b>${tenantId}</b></div>
  <h3 style="margin-top:18px">Long-lived user token (parcial):</h3>
  <pre>${(llJson.access_token || "").slice(0, 24)}…</pre>
  <h3>Páginas (resumo):</h3>
  <pre>${JSON.stringify(pages.data || [], null, 2)}</pre>
  <a class="btn" href="/comecar">Voltar ao início</a>
</div>`;
    res.type("html").send(html);
  } catch (e) {
    console.error("Erro em /auth/meta/callback:", e);
    res.status(500).send("Erro ao finalizar login com Facebook.");
  }
});

// ------------ Start ------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CaptioChat portal on :${PORT} — v=${META_VERSION}`);
});
