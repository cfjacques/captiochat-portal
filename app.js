// app.js (ESM)
// Se seu package.json NÃO tiver "type":"module", troque os imports por require(...)!

import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// ---- CONSTS úteis
const WWW = "https://www.captiochat.com";                 // seu site
const LOGO = `${WWW}/assets/logo.png`;                    // logo absoluta
const PRIVACY_URL = `${WWW}/legal/privacy`;
const TOS_URL = `${WWW}/legal/tos`;

// ---- HEALTH
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ---- Safety redirect: /comecar no portal -> site
app.get("/comecar", (_req, res) => res.redirect(302, `${WWW}/comecar.html`));

// ---- DEMO simples
app.get("/", (_req, res) => res.type("text").send("CaptioChat portal online 🚀"));

// ===================== META OAUTH (MVP) =====================

// Helper p/ montar querystring
const qs = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

// Iniciar OAuth (escopo mínimo)
app.get("/auth/meta/start", (req, res) => {
  const tenant = (req.query.tenant_id || "demo_show").toString();
  const state = tenant; // só pra identificação mínima

  const params = {
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",
    state,
    scope: "pages_show_list",
  };

  const url = `https://www.facebook.com/v${process.env.META_GRAPH_VERSION || "19.0"}/dialog/oauth?${qs(params)}`;
  res.redirect(url);
});

// Callback do OAuth
app.get("/auth/meta/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Usuário cancelou
  if (error) {
    return res
      .status(200)
      .type("html")
      .send(`
      <!doctype html><meta charset="utf-8">
      <title>Conexão cancelada</title>
      <style>body{font-family:system-ui,Arial;background:#0b1222;color:#e2e8f0;padding:24px}</style>
      <h2>Conexão cancelada</h2>
      <p>${error_description || "Nenhuma permissão foi concedida."}</p>
      <p><a href="${WWW}/comecar.html" style="color:#60a5fa">Voltar</a></p>
    `);
  }

  if (!code) {
    return res.status(400).send("Faltou o code");
  }

  try {
    // Troca code->token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v${process.env.META_GRAPH_VERSION || "19.0"}/oauth/access_token?${qs({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code: String(code),
      })}`
    );
    const shortToken = await tokenRes.json();
    if (shortToken.error) throw shortToken.error;

    // converte em long-lived user token
    const longRes = await fetch(
      `https://graph.facebook.com/v${process.env.META_GRAPH_VERSION || "19.0"}/oauth/access_token?${qs({
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortToken.access_token,
      })}`
    );
    const longToken = await longRes.json();
    if (longToken.error) throw longToken.error;

    // lista páginas só para demonstrar (sem gravar nada)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v${process.env.META_GRAPH_VERSION || "19.0"}/me/accounts?access_token=${longToken.access_token}`
    );
    const pages = await pagesRes.json();

    const first = Array.isArray(pages.data) && pages.data.length ? pages.data[0] : null;

    return res
      .status(200)
      .type("html")
      .send(`
      <!doctype html><meta charset="utf-8">
      <title>Conta conectada</title>
      <style>
        body{font-family:system-ui,Arial;background:#0b1222;color:#e2e8f0;padding:24px;line-height:1.5}
        a{color:#60a5fa}
        .ok{background:#052e16;border:1px solid #166534;padding:12px;border-radius:8px}
        .box{background:#0f172a;border:1px solid #1f2937;padding:16px;border-radius:12px;margin-top:12px}
        .mono{font-family:ui-monospace,Menlo,Consolas,monospace}
      </style>
      <h2>Conta conectada com sucesso ✅</h2>
      <p class="ok">Tenant: <b>${state || "demo"}</b></p>

      <div class="box">
        <p><b>Primeira Página:</b> ${first ? `${first.name} (ID: <span class="mono">${first.id}</span>)` : "nenhuma encontrada"}</p>
        <p>Token de usuário (long-lived) foi gerado para a DEMO e descartado ao finalizar. Em produção, gravamos com criptografia.</p>
      </div>

      <p><a href="${WWW}/comecar.html">Voltar</a></p>
    `);
  } catch (e) {
    return res.status(500).json({ error: e });
  }
});

// ---- Tela “Conectar com Facebook” (frontend simples servido pelo portal)
app.get("/connect/meta", (req, res) => {
  const tenant = (req.query.tenant_id || "demo_show").toString();
  const oauthURL = `/auth/meta/start?tenant_id=${encodeURIComponent(tenant)}`;

  res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<meta charset="utf-8">
<title>Conectar o Facebook Messenger</title>
<style>
  :root{--bg:#0b1222;--card:#0f172a;--muted:#94a3b8;--fg:#e2e8f0;--primary:#2563eb}
  *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
  .nav{display:flex;align-items:center;justify-content:space-between;padding:16px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800}
  .brand img{width:28px;height:28px;border-radius:8px;object-fit:contain}
  .wrap{max-width:1100px;margin:20px auto;padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .card{background:var(--card);border:1px solid #1f2937;border-radius:16px;padding:24px}
  .muted{color:var(--muted)}
  .btn{display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;text-decoration:none}
  .back{position:fixed;top:16px;right:16px;background:#111827;border:1px solid #1f2937;color:#e5e7eb;border-radius:10px;padding:10px 14px;text-decoration:none}
</style>

<a class="back" href="${WWW}/comecar.html">Voltar</a>

<div class="nav">
  <div class="brand">
    <img src="${LOGO}" alt="CaptioChat"/>
    <span>CaptioChat</span>
  </div>
</div>

<div class="wrap">
  <div class="card">
    <h1>Conectar o Facebook<br/>Messenger</h1>
    <p class="muted">Vamos pedir autorização mínima para listar suas Páginas.</p>
    <a class="btn" href="${oauthURL}">Continuar com Facebook</a>
    <p class="muted" style="margin-top:14px">Ao continuar, você concorda com nossos <a href="${TOS_URL}" style="color:#60a5fa">Termos</a> e <a href="${PRIVACY_URL}" style="color:#60a5fa">Privacidade</a>.</p>
  </div>
  <div class="card">
    <h3>O que vamos solicitar:</h3>
    <ul>
      <li>Permissão para listar suas Páginas (<code>pages_show_list</code>).</li>
      <li>Geramos um token (demo: memória) e mostramos o Page ID.</li>
    </ul>
  </div>
</div>`);
});

// ---- SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
