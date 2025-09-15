// app.js
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// ---------- HEALTH ----------
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ---------- PÁGINAS LEGAIS ----------
const PRIVACY_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Privacy Policy</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Privacy Policy</h1><p>Last updated: 2025-09-14</p>`;
const TOS_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Terms of Service</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Terms of Service</h1><p>Last updated: 2025-09-14</p>`;
app.get("/legal/privacy", (_req, res) => res.type("html").send(PRIVACY_HTML));
app.get("/legal/tos", (_req, res) => res.type("html").send(TOS_HTML));

// ---------- ENVs ----------
const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_VERIFY_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  ENC_SECRET,
  META_GRAPH_VERSION // ex.: v19.0
} = process.env;

// ---------- HELPERS META ----------
const FBV = META_GRAPH_VERSION || "v19.0";
const graph  = (q) => `https://graph.facebook.com/${FBV}${q}`;
const dialog = (q) => `https://www.facebook.com/${FBV}${q}`;

const BASE_URL = (() => { try { return new URL(META_REDIRECT_URI).origin; } catch { return "https://app.captiochat.com"; } })();
const APP_WEBHOOK_URL = `${BASE_URL}/webhooks/meta`;

// ---------- CRYPTO (AES-256-GCM) ----------
const ENC_KEY = Buffer.from(ENC_SECRET || "", "base64"); // 32 bytes
function encrypt(text) {
  if (!ENC_KEY || ENC_KEY.length !== 32) throw new Error("ENC_SECRET inválido");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// ---------- SUPABASE ----------
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

// ---------- SVGs inline (logo + ícones simples) ----------
const LogoSVG = `
<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
   <stop stop-color="#22c1ff"/>
   <stop offset="1" stop-color="#1479ff"/>
  </linearGradient>
 </defs>
 <path d="M46.5 46.3c-4.8 4.9-10.9 7.7-18.4 7.7C14.8 54 6 45.3 6 33.8 6 22.2 14.8 13.5 28 13.5c7.6 0 13.9 3 18.9 9l-7 4.7c-3.1-3.9-6.8-5.8-11.3-5.8-7.7 0-13 5.1-13 12.4 0 7.2 5.3 12.3 13 12.3 4.1 0 7.8-1.5 10.9-4.6l7 4.8Z" fill="url(#g)"/>
</svg>`;
const Icon = {
  ig:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="#e1306c" stroke-width="2"/><circle cx="12" cy="12" r="3.5" stroke="#e1306c" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.4" fill="#e1306c"/></svg>`,
  wa:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 0 1 7.5 13.9L20 21l-4.1-1.2A9 9 0 1 1 12 3Z" stroke="#25D366" stroke-width="2"/><path d="M8.5 9.2c.4-.9 1.3-.8 1.8-.3l.9.9c.5.5.2 1.1-.1 1.5.3.7.9 1.6 1.7 2.2.4-.3 1-.6 1.5-.1l.9.9c.5.5.6 1.4-.3 1.8-1.5.7-3.9-.3-6-2.4s-3.1-4.5-2.4-6Z" fill="#25D366"/></svg>`,
  fbm: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3c5 0 9 3.7 9 8.2S17 19.4 12 19.4a8.7 8.7 0 0 1-3.1-.6L5 21l.9-3.5A8.3 8.3 0 0 1 3 11.2C3 6.7 7 3 12 3Z" stroke="#0084ff" stroke-width="2"/><path d="m8 13 3-3 2 2 3-3" stroke="#0084ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  tiktok:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14.5 3v3.2a5.5 5.5 0 0 0 5.5 5.5" stroke="#000" stroke-width="2"/><path d="M14.5 9.7v4.2a4.9 4.9 0 1 1-4.9-4.9" stroke="#000" stroke-width="2"/></svg>`,
  tg:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 4 3 11l6.6 2.1L11 21l3.6-5.5L21 4Z" stroke="#26A7E3" stroke-width="2"/></svg>`
};

// ---------- HOME ----------
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
      <p>Conecte sua conta com um clique e deixe o resto por nossa conta. Tokens ficam seguros no backend, prontos para usar no seu n8n.</p>
      <a class="btn" href="/comecar">COMEÇAR</a>
    </div>
    <div class="card hero">${LogoSVG}</div>
  </div>
  <div class="footer">© ${new Date().getFullYear()} CaptioChat — Beta</div>
  `;
  res.type("html").send(html);
});

// ---------- GET STARTED / COMECAR ----------
function channelsPage(tenant) {
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
    .muted{color:var(--muted)}
    .pill{font-size:12px;border:1px solid var(--border);padding:4px 8px;border-radius:999px;color:#a3e635}
    .btn{margin-left:auto;background:var(--primary);color:#fff;border:0;border-radius:10px;padding:8px 12px;cursor:pointer}
    .ghost{background:transparent;color:#94a3b8;border:1px dashed var(--border)}
    .sep{height:1px;background:var(--border);margin:18px 0}
    a{color:#fff;text-decoration:none}
  </style>
  <div class="nav">
    <div class="brand"><a href="/">${LogoSVG}</a><span>CaptioChat</span></div>
  </div>
  <div class="wrap">
    <h2>Onde você quer começar?</h2>
    <div class="row">
      <label>tenant_id&nbsp;</label>
      <input id="tenant" value="${t}" placeholder="ex.: demo_show"/>
    </div>

    <div class="grid">
      <div class="card">
        ${Icon.ig}
        <div>
          <h4>Instagram</h4>
          <div class="muted">Conecte com a sua conta de Instagram via Facebook (Meta).</div>
          <div class="sep"></div>
          <span class="pill">Disponível</span>
        </div>
        <button class="btn" onclick="go('meta')">Conectar</button>
      </div>

      <div class="card">
        ${Icon.fbm}
        <div>
          <h4>Facebook Messenger</h4>
          <div class="muted">Habilite respostas e captação de eventos da Página.</div>
          <div class="sep"></div>
          <span class="pill">Disponível</span>
        </div>
        <button class="btn" onclick="go('meta')">Conectar</button>
      </div>

      <div class="card">
        ${Icon.wa}
        <div>
          <h4>WhatsApp</h4>
          <div class="muted">Integração oficial do WhatsApp Business (em breve).</div>
          <div class="sep"></div>
          <span class="pill" style="color:#fde047;border-color:#fde047;">Em breve</span>
        </div>
        <button class="btn ghost" disabled>Em breve</button>
      </div>

      <div class="card">
        ${Icon.tiktok}
        <div>
          <h4>TikTok</h4>
          <div class="muted">Conecte para automações (em breve).</div>
          <div class="sep"></div>
          <span class="pill" style="color:#fde047;border-color:#fde047;">Em breve</span>
        </div>
        <button class="btn ghost" disabled>Em breve</button>
      </div>

      <div class="card">
        ${Icon.tg}
        <div>
          <h4>Telegram</h4>
          <div class="muted">Automação em canais e bots (em breve).</div>
          <div class="sep"></div>
          <span class="pill" style="color:#fde047;border-color:#fde047;">Em breve</span>
        </div>
        <button class="btn ghost" disabled>Em breve</button>
      </div>
    </div>
  </div>
  <script>
    function go(kind){
      const t = document.getElementById('tenant').value || 'demo_show';
      if(kind==='meta'){
        location.href = '/auth/meta/start?tenant_id=' + encodeURIComponent(t);
      }
    }
  </script>`;
}
app.get("/comecar", (req,res)=> res.type("html").send(channelsPage(req.query.tenant)));
app.get("/get-started", (req,res)=> res.redirect("/comecar"));

// ---------- DEBUG (mostra URL OAuth) ----------
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

// ---------- OAUTH START (mínimo estável em dev) ----------
app.get("/auth/meta/start", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(",");
  const url = dialog(`/dialog/oauth`) +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;
  res.redirect(url);
});

// ---------- OAUTH CALLBACK ----------
app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).type("html").send(
        `<!doctype html><meta charset="utf-8" />
         <style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 16px}</style>
         <h2>Como usar este callback</h2>
         <p>Abra primeiro <code>/comecar</code> e conecte Instagram/Facebook. O Facebook redireciona para cá com <code>code</code>.</p>
         <p><a href="/comecar">→ Ir para COMECAR</a></p>`
      );
    }
    const tenantId = String(state || "demo");

    // 1) token curto
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

    // 2) token longo
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

    // 3) pegar páginas (ID básico) com escopo mínimo
    const r3 = await fetch(graph(`/me/accounts`) + `?fields=id,name&access_token=${encodeURIComponent(userToken)}`);
    const pages = await r3.json();
    const firstPage = Array.isArray(pages?.data) && pages.data.length ? pages.data[0] : null;
    const pageId = firstPage?.id || null;

    // 4) salvar no Supabase (token cifrado)
    const payload = {
      tenant_id: tenantId,
      provider: "meta",
      user_long_lived_token: encrypt(userToken),
      user_token_expires_at: userExpiresAt,
      page_id: pageId
    };
    const { error } = await supa.from("oauth_accounts").upsert(payload, { onConflict: "tenant_id" });
    if (error) return res.status(500).type("html").send(`<h3>Erro ao salvar no banco</h3><pre>${error.message}</pre>`);

    res.type("html").send(
      `<h2>Conta conectada com sucesso ✅</h2>
       <p><b>Tenant:</b> ${tenantId}</p>
       <ul><li><b>Page ID:</b> ${pageId || "—"}</li><li>Token salvo com segurança.</li></ul>
       <p><a href="/comecar">Voltar</a></p>`
    );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro no callback");
  }
});

// ---------- WEBHOOK (opcional – só verificação) ----------
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// ---------- START ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
