// app.js
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// -------------------------- HEALTH
app.get("/health", (_req, res) => res.status(200).send("ok"));

// -------------------------- LEGAIS (placeholders)
const PRIVACY_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Privacy Policy</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Privacy Policy</h1><p>Last updated: 2025-09-14</p>`;
const TOS_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Terms of Service</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Terms of Service</h1><p>Last updated: 2025-09-14</p>`;
app.get("/legal/privacy", (_req, res) => res.type("html").send(PRIVACY_HTML));
app.get("/legal/tos", (_req, res) => res.type("html").send(TOS_HTML));

// -------------------------- ENVs
const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_VERIFY_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  ENC_SECRET,
  META_GRAPH_VERSION // ex.: "v19.0"
} = process.env;

// -------------------------- Helpers META
const FBV = META_GRAPH_VERSION || "v19.0";
const graph  = (q) => `https://graph.facebook.com/${FBV}${q}`;
const dialog = (q) => `https://www.facebook.com/${FBV}${q}`;

const BASE_ORIGIN = (() => { try { return new URL(META_REDIRECT_URI).origin; } catch { return "https://app.captiochat.com"; } })();

// -------------------------- Crypto (AES-256-GCM)
const ENC_KEY = Buffer.from(ENC_SECRET || "", "base64"); // 32 bytes
function encrypt(text) {
  if (!ENC_KEY || ENC_KEY.length !== 32) throw new Error("ENC_SECRET inválido (32 bytes em base64)");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// -------------------------- Supabase
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

// -------------------------- Visual (logo e ícones bem leves)
const LogoSVG = `
<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
 <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#22c1ff"/><stop offset="1" stop-color="#1479ff"/></linearGradient></defs>
 <path d="M46.5 46.3c-4.8 4.9-10.9 7.7-18.4 7.7C14.8 54 6 45.3 6 33.8 6 22.2 14.8 13.5 28 13.5c7.6 0 13.9 3 18.9 9l-7 4.7c-3.1-3.9-6.8-5.8-11.3-5.8-7.7 0-13 5.1-13 12.4 0 7.2 5.3 12.3 13 12.3 4.1 0 7.8-1.5 10.9-4.6l7 4.8Z" fill="url(#g)"/>
</svg>`;

const Icon = {
  ig:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="#e1306c" stroke-width="2"/><circle cx="12" cy="12" r="3.5" stroke="#e1306c" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.4" fill="#e1306c"/></svg>`,
  fbm: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3c5 0 9 3.7 9 8.2S17 19.4 12 19.4a8.7 8.7 0 0 1-3.1-.6L5 21l.9-3.5A8.3 8.3 0 0 1 3 11.2C3 6.7 7 3 12 3Z" stroke="#0084ff" stroke-width="2"/><path d="m8 13 3-3 2 2 3-3" stroke="#0084ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

// =============================================================================
//  HOME
// =============================================================================
app.get("/", (_req, res) => {
  const html = `
  <!doctype html><meta charset="utf-8">
  <title>CaptioChat</title>
  <style>
    :root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--primary:#2563eb}
    *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:radial-gradient(1200px 700px at 20% -10%,rgba(37,99,235,.25),transparent),var(--bg);color:var(--fg)}
    .nav{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:16px auto;padding:0 16px}
    .brand{display:flex;gap:10px;align-items:center;font-weight:700}
    .wrap{display:grid;grid-template-columns:1.2fr .8fr;gap:40px;max-width:1100px;margin:40px auto;padding:0 16px;align-items:center}
    h1{font-size:56px;line-height:1.05;margin:0 0 12px}
    p{color:var(--muted);font-size:18px;margin:0 0 24px}
    .btn{display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;border:0;border-radius:12px;padding:14px 20px;font-weight:700;text-decoration:none}
    .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);backdrop-filter:blur(8px);border-radius:20px;padding:24px}
    .hero{height:340px;border-radius:20px;background:radial-gradient(220px 140px at 50% 40%, rgba(20,121,255,.35), transparent), radial-gradient(320px 220px at 60% 60%, rgba(34,193,255,.25), transparent), #0b1222; display:flex;align-items:center;justify-content:center}
    .hero svg{transform:scale(1.6)}
    .footer{max-width:1100px;margin:40px auto 24px;padding:0 16px;color:#94a3b8;font-size:13px}
  </style>
  <div class="nav">
    <div class="brand">${LogoSVG}<span>CaptioChat</span></div>
    <a class="btn" href="/comecar">COMEÇAR</a>
  </div>
  <div class="wrap">
    <div>
      <h1>Automação simples para IG & Facebook</h1>
      <p>Conecte sua conta com um clique. Tokens ficam seguros no backend e prontos para o seu n8n.</p>
      <a class="btn" href="/comecar">COMEÇAR</a>
    </div>
    <div class="card hero">${LogoSVG}</div>
  </div>
  <div class="footer">© ${new Date().getFullYear()} CaptioChat — Beta</div>`;
  res.type("html").send(html);
});

// =============================================================================
//  COMEÇAR (escolher canal)
// =============================================================================
function channelsPage(tenant, flash = "") {
  const t = tenant || "demo_show";
  return `
  <!doctype html><meta charset="utf-8">
  <title>CaptioChat – Começar</title>
  <style>
    :root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--primary:#2563eb;--card:#0b1222;--border:rgba(255,255,255,.08)}
    *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
    .nav{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:16px auto;padding:0 16px}
    .brand{display:flex;gap:10px;align-items:center;font-weight:700}
    .wrap{max-width:1100px;margin:28px auto;padding:0 16px}
    h2{margin:4px 0 18px}
    .row{display:flex;gap:10px;align-items:center;margin-bottom:18px}
    input{background:#0b1222;border:1px solid var(--border);color:var(--fg);padding:10px 12px;border-radius:10px;width:240px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
    .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start}
    .card h4{margin:4px 0 6px}
    .muted{color:var(--muted)} .pill{font-size:12px;border:1px solid var(--border);padding:4px 8px;border-radius:999px;color:#a3e635}
    .btn{margin-left:auto;background:var(--primary);color:#fff;border:0;border-radius:10px;padding:8px 12px;cursor:pointer}
    .sep{height:1px;background:var(--border);margin:18px 0}
    .flash{background:#0b3a1e;border:1px solid #14532d;color:#bbf7d0;padding:10px 12px;border-radius:10px;margin:12px 0}
  </style>
  <div class="nav">
    <div class="brand"><a href="/">${LogoSVG}</a><span>CaptioChat</span></div>
  </div>
  <div class="wrap">
    ${flash ? `<div class="flash">${flash}</div>` : ``}
    <h2>Onde você quer começar?</h2>
    <div class="row">
      <label>tenant_id&nbsp;</label>
      <input id="tenant" value="${t}" placeholder="ex.: demo_show"/>
    </div>

    <div class="grid">
      <div class="card">
        ${Icon.fbm}
        <div>
          <h4>Facebook Messenger</h4>
          <div class="muted">Crie automações e receba eventos da sua Página do Facebook.</div>
          <div class="sep"></div><span class="pill">Disponível</span>
        </div>
        <button class="btn" onclick="go('messenger')">Conectar</button>
      </div>

      <div class="card">
        ${Icon.ig}
        <div>
          <h4>Instagram (via Meta)</h4>
          <div class="muted">Conecte sua conta de Instagram Business/Creator.</div>
          <div class="sep"></div><span class="pill">Disponível</span>
        </div>
        <button class="btn" onclick="go('instagram')">Conectar</button>
      </div>
    </div>
  </div>
  <script>
    function go(channel){
      const t = document.getElementById('tenant').value || 'demo_show';
      location.href = '/connect/meta?tenant_id=' + encodeURIComponent(t) + '&channel=' + encodeURIComponent(channel);
    }
  </script>`;
}
app.get("/comecar", (req,res)=> {
  const { tenant, msg } = req.query;
  res.type("html").send(channelsPage(tenant, msg));
});

// =============================================================================
//  PRÉ-CONSENTIMENTO (explica antes de abrir o Facebook)
// =============================================================================
function preconsentPage(tenant, channel, cancelled = false) {
  const t = tenant || "demo_show";
  const title = channel === "messenger" ? "Conectar o Facebook Messenger" : "Conectar o Instagram";
  const desc  = channel === "messenger"
    ? "Vamos pedir ao Facebook autorização para acessar sua Página (leitura básica) e listar contas. Você poderá escolher e confirmar."
    : "Vamos pedir autorização para listar suas contas/Pages e vincular seu Instagram Business/Creator.";

  return `
  <!doctype html><meta charset="utf-8">
  <title>${title} – CaptioChat</title>
  <style>
    :root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--primary:#2563eb;--card:#0b1222;--border:rgba(255,255,255,.08)}
    *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
    .nav{display:flex;align-items:center;justify-content:space-between;max-width:980px;margin:16px auto;padding:0 16px}
    .brand{display:flex;gap:10px;align-items:center;font-weight:700}
    .wrap{max-width:980px;margin:28px auto;padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}
    h1{margin:0 0 10px}
    p{color:var(--muted)}
    .btnPrimary{display:inline-flex;align-items:center;gap:10px;background:#1877F2;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;text-decoration:none}
    .secondary{color:#94a3b8;text-decoration:none}
    .note{font-size:12px;color:#94a3b8;margin-top:10px}
    .alert{background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca;padding:10px 12px;border-radius:10px;margin:12px 0}
    .box{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}
  </style>

  <div class="nav">
    <div class="brand"><a href="/">${LogoSVG}</a><span>CaptioChat</span></div>
    <div><a class="secondary" href="/comecar?tenant=${encodeURIComponent(t)}">Voltar</a></div>
  </div>

  <div class="wrap">
    <div>
      <h1>${title}</h1>
      <p>${desc}</p>
      ${cancelled ? `<div class="alert">Conexão cancelada. Nenhuma permissão foi concedida.</div>` : ``}
      <a class="btnPrimary" href="/auth/meta/start?tenant_id=${encodeURIComponent(t)}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2v-3h2V9.5c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2V12h2.2l-.3 3h-1.9v7A10 10 0 0 0 22 12Z"/></svg>
        Continuar com Facebook
      </a>
      <div class="note">Ao continuar, você concorda com nossos <a href="/legal/tos" class="secondary">Termos</a> e <a href="/legal/privacy" class="secondary">Privacidade</a>.</div>
    </div>
    <div class="box">
      <strong>O que vamos solicitar:</strong>
      <ul>
        <li>Ver sua conta e Páginas disponíveis (escopo mínimo em modo de desenvolvimento).</li>
        <li>Geramos um token seguro e guardamos criptografado.</li>
        <li>Você pode revogar a qualquer momento nas configurações do Facebook.</li>
      </ul>
    </div>
  </div>`;
}
app.get("/connect/meta", (req, res) => {
  const { tenant_id, channel, denied } = req.query;
  res.type("html").send(preconsentPage(tenant_id, channel || "messenger", !!denied));
});

// =============================================================================
//  DEBUG (mostra URL do OAuth)
app.get("/auth/meta/debug", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(",");
  const url = dialog(`/dialog/oauth`) +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;
  res.type("html").send(
    `<h3>client_id:</h3><pre>${META_APP_ID}</pre>` +
    `<h3>redirect_uri:</h3><pre>${META_REDIRECT_URI}</pre>` +
    `<h3>API version:</h3><pre>${FBV}</pre>` +
    `<h3>URL completa:</h3><pre>${url}</pre>` +
    `<p><a href="${url}">→ Abrir fluxo OAuth agora</a></p>`
  );
});

// =============================================================================
//  OAUTH START (escopo mínimo em dev)
app.get("/auth/meta/start", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(","); // mínimo para listar páginas/IG depois
  const url = dialog(`/dialog/oauth`) +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;
  res.redirect(url);
});

// =============================================================================
//  OAUTH CALLBACK (sucesso + cancelamento elegante)
app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state, error, error_reason, action } = req.query;
    const tenantId = String(state || "demo");

    // 1) Se o usuário clicou "Agora não" no Facebook → volte para a tela anterior com uma mensagem
    if (error || error_reason === "user_denied" || action === "cancel") {
      return res.redirect(`/connect/meta?tenant_id=${encodeURIComponent(tenantId)}&denied=1`);
    }

    // 2) Acesso direto ao callback (sem code) → instrução amigável
    if (!code) {
      return res.status(400).type("html").send(
        `<!doctype html><meta charset="utf-8" />
         <style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 16px}</style>
         <h2>Como usar este callback</h2>
         <p>Abra primeiro <code>/comecar</code>, selecione um canal e clique em “Continuar com Facebook”.</p>
         <p><a href="/comecar?tenant=${encodeURIComponent(tenantId)}">→ Ir para COMECAR</a></p>`
      );
    }

    // 3) Troca por token curto
    const r1 = await fetch(
      graph(`/oauth/access_token`) +
      `?client_id=${META_APP_ID}` +
      `&client_secret=${META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
      `&code=${code}`
    );
    const shortTok = await r1.json();
    if (!shortTok.access_token) {
      return res.status(400).type("html").send(`<h3>Erro ao obter token curto</h3><pre>${JSON.stringify(shortTok,null,2)}</pre>`);
    }

    // 4) Estende para long-lived
    const r2 = await fetch(
      graph(`/oauth/access_token`) +
      `?grant_type=fb_exchange_token` +
      `&client_id=${META_APP_ID}` +
      `&client_secret=${META_APP_SECRET}` +
      `&fb_exchange_token=${shortTok.access_token}`
    );
    const longTok = await r2.json();
    if (!longTok.access_token) {
      return res.status(400).type("html").send(`<h3>Erro ao estender token</h3><pre>${JSON.stringify(longTok,null,2)}</pre>`);
    }
    const userToken = longTok.access_token;
    const userExpiresAt = new Date(Date.now() + (longTok.expires_in || 0)*1000).toISOString();

    // 5) Lista páginas (ID básico)
    const r3 = await fetch(graph(`/me/accounts`) + `?fields=id,name&access_token=${encodeURIComponent(userToken)}`);
    const pages = await r3.json();
    const firstPage = Array.isArray(pages?.data) && pages.data.length ? pages.data[0] : null;
    const pageId = firstPage?.id || null;

    // 6) Salva no Supabase (token cifrado)
    const payload = {
      tenant_id: tenantId,
      provider: "meta",
      user_long_lived_token: encrypt(userToken),
      user_token_expires_at: userExpiresAt,
      page_id: pageId
    };
    const { error: dbErr } = await supa.from("oauth_accounts").upsert(payload, { onConflict: "tenant_id" });
    if (dbErr) return res.status(500).type("html").send(`<h3>Erro ao salvar no banco</h3><pre>${dbErr.message}</pre>`);

    // 7) Sucesso
    res.type("html").send(
      `<h2>Conta conectada com sucesso ✅</h2>
       <p><b>Tenant:</b> ${tenantId}</p>
       <ul><li><b>Page ID:</b> ${pageId || "—"}</li><li>Token salvo com segurança (criptografado).</li></ul>
       <p><a href="/comecar?tenant=${encodeURIComponent(tenantId)}">Voltar</a></p>`
    );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro no callback");
  }
});

// -------------------------- Webhook GET (verificação)
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// -------------------------- START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
