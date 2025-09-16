// app.js — CaptioChat portal (MVP)
// Node >=18. ESM (package.json "type": "module")

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

/* ====== ENV ====== */
const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI, // ex: https://app.captiochat.com/auth/meta/callback
  META_GRAPH_VERSION = "v19.0",
  SITE_HOST = "https://www.captiochat.com", // para "Voltar" e redirect de /comecar
} = process.env;

/* ====== UTILS ====== */
const html = (title, body) => `
<!doctype html><html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    :root{--bg:#0b1220;--card:#111b2e;--muted:#97a5bf;--fg:#e6eefc;--primary:#2563eb;--ok:#9ae6b4;--warn:#f6e05e;--err:#fecaca}
    *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
    .nav{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:18px auto;padding:0 16px}
    .brand{display:flex;gap:10px;align-items:center;font-weight:800}
    .brand img{width:28px;height:28px;border-radius:8px}
    .btn{display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;border:0;border-radius:12px;padding:12px 18px;font-weight:700;text-decoration:none}
    .btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.15);padding:10px 16px;border-radius:12px;color:var(--fg);text-decoration:none}
    .wrap{max-width:980px;margin:40px auto;padding:0 16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .card{background:var(--card);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:20px}
    h1{margin:0 0 14px;font-size:36px} p{margin:0 0 14px;color:var(--muted)}
    .badge-ok{display:inline-block;background:#1f2a3f;color:#c9f7d9;border:1px solid #2f4a2f;padding:4px 10px;border-radius:999px;font-size:12px}
    .badge-warn{display:inline-block;background:#3a320f;color:#fff6bf;border:1px solid #7e6e26;padding:4px 10px;border-radius:999px;font-size:12px}
    .alert-err{background:#2a1313;border:1px solid #5a1e1e;color:var(--err);border-radius:10px;padding:12px 14px;margin:16px 0}
    code, pre{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px}
    pre{white-space:pre-wrap;word-break:break-word;background:#0e1626;border:1px solid rgba(255,255,255,.06);padding:12px;border-radius:10px}
    .top-actions{display:flex;gap:8px;justify-content:flex-end}
  </style>
</head>
<body>
  <div class="nav">
    <div class="brand">
      <img src="${SITE_HOST}/assets/logo.png" alt="CaptioChat"/>
      <span>CaptioChat</span>
    </div>
    <div class="top-actions">
      <a href="${SITE_HOST}" class="btn-ghost">Início</a>
      <a href="${SITE_HOST}/comecar.html" class="btn-ghost">Voltar</a>
    </div>
  </div>
  <div class="wrap">
    ${body}
  </div>
</body>
</html>
`;

/* ====== ROTAS BÁSICAS ====== */

// Healthcheck
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Home simples (app)
app.get("/", (_req, res) => {
  res.send(
    html(
      "CaptioChat – App",
      `
      <div class="card">
        <h1>CaptioChat – API</h1>
        <p>Backend online.</p>
        <p><a class="btn" href="${SITE_HOST}/comecar.html">COMEÇAR</a></p>
      </div>
    `
    )
  );
});

// /comecar no app → sempre redireciona para o site (evita 404)
app.get("/comecar", (_req, res) => {
  res.redirect(302, `${SITE_HOST}/comecar.html`);
});

/* ====== TELA DE CONEXÃO (APP) ====== */
app.get("/connect/meta", (req, res) => {
  const tenant = (req.query.tenant_id || "demo_show").toString();
  const denied = req.query.denied ? true : false;

  const body = `
  <div class="grid">
    <div class="card">
      <h1>Conectar o Facebook Messenger</h1>
      ${
        denied
          ? `<div class="alert-err">Conexão cancelada. Nenhuma permissão foi concedida.</div>`
          : ""
      }
      <p>Vamos pedir autorização mínima para listar suas Páginas.</p>
      <p><a class="btn" href="/auth/meta/start?tenant_id=${encodeURIComponent(
        tenant
      )}">Continuar com Facebook</a></p>
      <p style="color:#7f8a9f">
        Ao continuar, você concorda com nossos
        <a href="${SITE_HOST}/legal/tos" style="color:#fff">Termos</a> e
        <a href="${SITE_HOST}/legal/privacy" style="color:#fff">Privacidade</a>.
      </p>
    </div>
    <div class="card">
      <h2>O que vamos solicitar:</h2>
      <ul>
        <li>Permissão para <b>listar suas Páginas</b> (<code>pages_show_list</code>).</li>
        <li>Geramos um token (no demo: só mostramos resultado em tela).</li>
      </ul>
      <span class="badge-ok">Disponível</span>
    </div>
  </div>
  `;
  res.send(html("Conectar o Facebook Messenger", body));
});

/* ====== OAUTH START ====== */
app.get("/auth/meta/start", (req, res) => {
  try {
    const tenant = (req.query.tenant_id || "demo_show").toString();
    const dry = req.query.dry === "1";

    if (!META_APP_ID || !META_REDIRECT_URI) {
      return res
        .status(500)
        .send("Faltam META_APP_ID/META_REDIRECT_URI nas variáveis de ambiente.");
    }

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: META_REDIRECT_URI,
      response_type: "code",
      scope: "pages_show_list", // mínimo para demo
      state: tenant,
    });

    const oauthUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;

    if (dry) {
      return res.send(
        html(
          "OAuth (dry run)",
          `<div class="card"><h1>URL de login</h1><p>Abra para testar o login do Facebook:</p><p><a class="btn" href="${oauthUrl}" target="_blank" rel="noopener">Abrir diálogo do Facebook</a></p><pre>${oauthUrl}</pre></div>`
        )
      );
    }

    return res.redirect(302, oauthUrl);
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro ao iniciar OAuth.");
  }
});

/* ====== OAUTH CALLBACK ====== */
app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state, error, error_reason, error_description } = req.query;

    if (error) {
      // Usuário cancelou ou erro do FB → volta para a tela de conexão com aviso
      return res.redirect(
        302,
        `/connect/meta?tenant_id=${encodeURIComponent(
          state || "demo_show"
        )}&denied=1`
      );
    }

    if (!code) {
      return res
        .status(400)
        .send(
          html(
            "Callback",
            `<div class="card"><h1>Faltou "code"</h1><p>Abra <a class="btn-ghost" href="/connect/meta?tenant_id=${encodeURIComponent(
              state || "demo_show"
            )}">/connect/meta</a> e clique em “Continuar com Facebook”.</p></div>`
          )
        );
    }

    // Trocar code por access_token
    const tokenUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code: code.toString(),
    });

    const tRes = await fetch(`${tokenUrl}?${tokenParams.toString()}`);
    const tJson = await tRes.json();

    if (!tRes.ok || !tJson.access_token) {
      return res
        .status(400)
        .send(
          html(
            "Erro ao trocar token",
            `<div class="card"><h1>Erro ao obter token</h1><pre>${JSON.stringify(
              tJson,
              null,
              2
            )}</pre></div>`
          )
        );
    }

    const userToken = tJson.access_token;

    // Lista de páginas para provar que funciona
    const pagesRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(
        userToken
      )}`
    );
    const pagesJson = await pagesRes.json();

    let pageId = "—";
    if (pagesRes.ok && Array.isArray(pagesJson.data) && pagesJson.data.length) {
      pageId = pagesJson.data[0].id;
    }

    const body = `
      <div class="card">
        <h1>Conta conectada com sucesso ✅</h1>
        <p>Tenant: <b>${state || "demo_show"}</b></p>
        <p>Page ID (primeira encontrada): <b>${pageId}</b></p>
        <p>Versão da API: <code>${META_GRAPH_VERSION}</code></p>
        <p><a class="btn" href="${SITE_HOST}/comecar.html">Voltar</a></p>
      </div>
      <div class="card">
        <h2>Short-lived user token</h2>
        <pre>${JSON.stringify(
          { access_token: userToken, token_type: tJson.token_type, expires_in: tJson.expires_in },
          null,
          2
        )}</pre>
      </div>
      <div class="card">
        <h2>Resposta /me/accounts</h2>
        <pre>${JSON.stringify(pagesJson, null, 2)}</pre>
      </div>
    `;
    return res.send(html("Conectado", body));
  } catch (e) {
    console.error(e);
    return res.status(500).send("Erro no callback.");
  }
});

/* ====== DEBUG ====== */
app.get("/debug/redirect", (_req, res) => {
  res.send(
    html(
      "Debug",
      `<div class="card"><h1>Redirect URI</h1><pre>${META_REDIRECT_URI || "(vazio)"}</pre></div>`
    )
  );
});

/* ====== START ====== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
