// app.js (ESM)
import express from "express";
import bodyParser from "body-parser";

const app = express();

// ---- Não deixe proxies/caches guardarem respostas dinâmicas
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use(bodyParser.json());

// ---- Constantes
const WWW = "https://www.captiochat.com";       // seu site estático (GitHub Pages)
const LOGO = `${WWW}/assets/logo.png`;
const PRIVACY_URL = `${WWW}/legal/privacy`;
const TOS_URL = `${WWW}/legal/tos`;
const GRAPH_V = process.env.META_GRAPH_VERSION || "19.0";

// Health
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Raiz do portal
app.get("/", (_req, res) => res.type("text").send("CaptioChat portal online 🚀"));

// /comecar no portal -> redireciona com fallback (meta+JS)
app.get("/comecar", (_req, res) => {
  const target = `${WWW}/comecar.html`;
  // 302 normal
  res.status(302).set("Location", target);
  // E ainda devolve um HTML de fallback para proxies “teimosos”
  res.type("html").send(`<!doctype html>
<meta charset="utf-8">
<title>Redirecionando…</title>
<meta http-equiv="refresh" content="0; url=${target}">
<style>body{font-family:system-ui,Arial;background:#0b1222;color:#e2e8f0;padding:24px}</style>
<p>Redirecionando para <a style="color:#60a5fa" href="${target}">${target}</a>…</p>
<script>location.replace("${target}");</script>`);
});

// Util
const qs = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

// ---- OAuth START
app.get("/auth/meta/start", (req, res) => {
  const tenant = (req.query.tenant_id || "demo_show").toString();
  const params = {
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",
    state: tenant,
    scope: "pages_show_list",
  };
  const url = `https://www.facebook.com/v${GRAPH_V}/dialog/oauth?${qs(params)}`;
  res.redirect(url);
});

// ---- OAuth CALLBACK
app.get("/auth/meta/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res
      .status(200)
      .type("html")
      .send(`<!doctype html><meta charset="utf-8">
<title>Conexão cancelada</title>
<style>body{font-family:system-ui,Arial;background:#0b1222;color:#e2e8f0;padding:24px}</style>
<h2>Conexão cancelada</h2>
<p>${error_description || "Nenhuma permissão foi concedida."}</p>
<p><a href="${WWW}/comecar.html" style="color:#60a5fa">Voltar</a></p>`);
  }

  if (!code) return res.status(400).send("Faltou o code");

  try {
    // Node 18+ tem fetch nativo
    const tokenRes = await fetch(
      `https://graph.facebook.com/v${GRAPH_V}/oauth/access_token?${qs({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code: String(code),
      })}`
    );
    const shortToken = await tokenRes.json();
    if (shortToken.error) throw shortToken.error;

    const longRes = await fetch(
      `https://graph.facebook.com/v${GRAPH_V}/oauth/access_token?${qs({
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortToken.access_token,
      })}`
    );
    const longToken = await longRes.json();
    if (longToken.error) throw longToken.error;

    const pagesRes = await fetch(
      `https://graph.facebook.com/v${GRAPH_V}/me/accounts?access_token=${longToken.access_token}`
    );
    const pages = await pagesRes.json();
    const first = Array.isArray(pages.data) && pages.data.length ? pages.data[0] : null;

    return res
      .status(200)
      .type("html")
      .send(`<!doctype html><meta charset="utf-8">
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
  <p>Token de usuário (long-lived) gerado apenas para DEMO e descartado ao finalizar.</p>
</div>
<p><a href="${WWW}/comecar.html">Voltar</a></p>`);
  } catch (e) {
    return res.status(500).json({ error: e });
  }
});

// ---- Tela de conexão (Messenger)
app.get("/connect/meta", (req, res) => {
  const tenant = (req.query.tenant_id || "demo_show").toString();
  const oauthURL = `/auth/meta/start?tenant_id=${encodeURIComponent(tenant)}`;

  res
    .status(200)
    .type("html")
    .send(`<!doctype html><meta charset="utf-8">
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

// ---- Tratadores globais para não derrubar o processo
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
