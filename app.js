// app.js
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

app.get("/health", (_req, res) => res.status(200).send("ok"));

const PRIVACY_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Privacy Policy</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Privacy Policy</h1><p>Last updated: 2025-09-14</p>`;
const TOS_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Terms of Service</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Terms of Service</h1><p>Last updated: 2025-09-14</p>`;
app.get("/legal/privacy", (_req, res) => res.type("html").send(PRIVACY_HTML));
app.get("/legal/tos", (_req, res) => res.type("html").send(TOS_HTML));

const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_VERIFY_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  ENC_SECRET,
  META_GRAPH_VERSION
} = process.env;

const FBV = META_GRAPH_VERSION || "v19.0";
const graph  = (q) => `https://graph.facebook.com/${FBV}${q}`;
const dialog = (q) => `https://www.facebook.com/${FBV}${q}`;
const BASE_ORIGIN = (() => { try { return new URL(META_REDIRECT_URI).origin; } catch { return "https://app.captiochat.com"; } })();

const ENC_KEY = Buffer.from(ENC_SECRET || "", "base64");
function encrypt(text) {
  if (!ENC_KEY || ENC_KEY.length !== 32) throw new Error("ENC_SECRET inválido (32 bytes base64)");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// base64url helpers para colocar origin dentro do state
const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");
const fromB64url = (s) => Buffer.from(String(s || ""), "base64url").toString("utf8");

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

// ======= UI simples (home + comecar) iguais aos anteriores omitidos por brevidade =======
function channelsPage(tenant, flash = "") { /* (mesmo HTML que você já tem) */ return `
<!doctype html><meta charset="utf-8"><title>CaptioChat – Começar</title>
<style> :root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--primary:#2563eb;--card:#0b1222;--border:rgba(255,255,255,.08)}
*{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
.nav{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:16px auto;padding:0 16px}
.brand{display:flex;gap:10px;align-items:center;font-weight:800}
.link{color:#94a3b8;text-decoration:none;border:1px solid var(--border);padding:8px 12px;border-radius:10px}
.wrap{max-width:1100px;margin:28px auto;padding:0 16px}
h2{margin:4px 0 18px}
.row{display:flex;gap:10px;align-items:center;margin-bottom:18px}
input{background:#0b1222;border:1px solid var(--border);color:var(--fg);padding:10px 12px;border-radius:10px;width:240px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start}
.card h4{margin:4px 0 6px} .muted{color:var(--muted)} .pill{font-size:12px;border:1px solid var(--border);padding:4px 8px;border-radius:999px;color:#a3e635}
.btn{margin-left:auto;background:var(--primary);color:#fff;border:0;border-radius:10px;padding:8px 12px;cursor:pointer}
.sep{height:1px;background:var(--border);margin:18px 0} .flash{background:#0b3a1e;border:1px solid #14532d;color:#bbf7d0;padding:10px 12px;border-radius:10px;margin:12px 0}
.icon{width:22px;height:22px} </style>
<div class="nav"><div class="brand"><span style="width:28px;height:28px;border-radius:8px;background:#1479ff;display:inline-block;margin-right:6px"></span><span>CaptioChat</span></div></div>
<div class="wrap">
${flash ? `<div class="flash">${flash}</div>` : ``}
<h2>Onde você quer começar?</h2>
<div class="row"><label>tenant_id&nbsp;</label><input id="tenant" value="${tenant||'demo_show'}"/></div>
<div class="grid">
  <div class="card"><div class="icon"></div><div><h4>Facebook Messenger</h4><div class="muted">Habilite respostas e eventos da Página.</div><div class="sep"></div><span class="pill">Disponível</span></div><button class="btn" onclick="go('messenger')">Conectar</button></div>
  <div class="card"><div class="icon"></div><div><h4>Instagram</h4><div class="muted">Conecte via Meta.</div><div class="sep"></div><span class="pill">Disponível</span></div><button class="btn" onclick="go('instagram')">Conectar</button></div>
</div></div>
<script>
function go(channel){
  const t = document.getElementById('tenant').value || 'demo_show';
  const origin = window.location.href;
  location.href = '/connect/meta?tenant_id='+encodeURIComponent(t)+'&channel='+encodeURIComponent(channel)+'&origin='+encodeURIComponent(origin);
}
</script>`;}
app.get("/", (_req,res)=>res.redirect("/comecar"));
app.get("/comecar", (req,res)=>res.type("html").send(channelsPage(req.query.tenant, req.query.msg)));

// ======= PRECONSENTIMENTO (respeita origin) =======
function preconsentPage(tenant, channel, origin, cancelled=false){
  const t = tenant || "demo_show";
  const backHref = origin ? origin : `/comecar?tenant=${encodeURIComponent(t)}`;
  const startHref = `/auth/meta/start?tenant_id=${encodeURIComponent(t)}${origin?`&origin=${encodeURIComponent(origin)}`:''}`;
  return `<!doctype html><meta charset="utf-8"><title>Conectar – CaptioChat</title>
<style>:root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--primary:#2563eb;--card:#0b1222;--border:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--fg)}
.nav{display:flex;align-items:center;justify-content:space-between;max-width:980px;margin:16px auto;padding:0 16px}
.brand{display:flex;gap:10px;align-items:center;font-weight:800}.link{color:#94a3b8;text-decoration:none;border:1px solid var(--border);padding:8px 12px;border-radius:10px}
.wrap{max-width:980px;margin:28px auto;padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}
h1{margin:0 0 10px}p{color:var(--muted)}.btnPrimary{display:inline-flex;align-items:center;gap:10px;background:#1877F2;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:700;text-decoration:none}
.note{font-size:12px;color:#94a3b8;margin-top:10px}.alert{background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca;padding:10px 12px;border-radius:10px;margin:12px 0}
.box{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}</style>
<div class="nav"><div class="brand"><span style="width:28px;height:28px;border-radius:8px;background:#1479ff;display:inline-block;margin-right:6px"></span><span>CaptioChat</span></div>
<a class="link" href="${backHref}">Voltar</a></div>
<div class="wrap">
  <div>
    <h1>Conectar o Facebook Messenger</h1>
    <p>Vamos pedir autorização básica para listar suas Páginas e concluir a conexão.</p>
    ${cancelled?`<div class="alert">Conexão cancelada. Nenhuma permissão foi concedida.</div>`:''}
    <a class="btnPrimary" href="${startHref}">Continuar com Facebook</a>
    <div class="note">Ao continuar, você concorda com nossos <a href="/legal/tos" class="link">Termos</a> e <a href="/legal/privacy" class="link">Privacidade</a>.</div>
  </div>
  <div class="box"><strong>O que vamos solicitar</strong><ul>
    <li>Ver sua conta e Páginas disponíveis (escopo mínimo).</li>
    <li>Geramos um token seguro e guardamos criptografado.</li>
    <li>Você pode revogar a qualquer momento no Facebook.</li>
  </ul></div>
</div>`;}
app.get("/connect/meta", (req,res)=>{
  const { tenant_id, channel, origin, denied } = req.query;
  res.type("html").send(preconsentPage(tenant_id, channel||"messenger", origin, !!denied));
});

// ======= START (state leva tenant + origin) =======
app.get("/auth/meta/start", (req, res) => {
  const tenantId = req.query.tenant_id || "demo_show";
  const origin = req.query.origin || "";
  const scopes = ["pages_show_list"].join(",");
  const stateObj = { t: tenantId, o: origin };
  const state = b64url(JSON.stringify(stateObj));
  const url = dialog(`/dialog/oauth`)
    + `?client_id=${META_APP_ID}`
    + `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}`
    + `&scope=${scopes}`
    + `&state=${state}`;
  res.redirect(url);
});

// ======= CALLBACK (se cancelar, volta para origin) =======
app.get("/auth/meta/callback", async (req,res)=>{
  try{
    const { code, state, error, error_reason, action } = req.query;
    let tenantId = "demo_show", origin = "";
    try{
      const parsed = JSON.parse(fromB64url(state));
      tenantId = parsed.t || tenantId;
      origin   = parsed.o || "";
    }catch{}

    if (error || error_reason === "user_denied" || action === "cancel") {
      const back = `/connect/meta?tenant_id=${encodeURIComponent(tenantId)}&denied=1`
        + (origin ? `&origin=${encodeURIComponent(origin)}` : "");
      return res.redirect(back);
    }

    if (!code){
      const back = origin || `/comecar?tenant=${encodeURIComponent(tenantId)}`;
      return res.status(400).type("html").send(
        `<h2>Abra primeiro a tela de conexão</h2><p><a href="${back}">→ Voltar</a></p>`
      );
    }

    const r1 = await fetch(
      graph(`/oauth/access_token`)
      + `?client_id=${META_APP_ID}`
      + `&client_secret=${META_APP_SECRET}`
      + `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}`
      + `&code=${code}`
    );
    const shortTok = await r1.json();
    if (!shortTok.access_token) return res.status(400).type("html").send(`<h3>Erro token curto</h3><pre>${JSON.stringify(shortTok,null,2)}</pre>`);

    const r2 = await fetch(
      graph(`/oauth/access_token`)
      + `?grant_type=fb_exchange_token`
      + `&client_id=${META_APP_ID}`
      + `&client_secret=${META_APP_SECRET}`
      + `&fb_exchange_token=${shortTok.access_token}`
    );
    const longTok = await r2.json();
    if (!longTok.access_token) return res.status(400).type("html").send(`<h3>Erro token longo</h3><pre>${JSON.stringify(longTok,null,2)}</pre>`);
    const userToken = longTok.access_token;
    const userExpiresAt = new Date(Date.now() + (longTok.expires_in||0)*1000).toISOString();

    const r3 = await fetch(graph(`/me/accounts`) + `?fields=id,name&access_token=${encodeURIComponent(userToken)}`);
    const pages = await r3.json();
    const firstPage = Array.isArray(pages?.data) && pages.data.length ? pages.data[0] : null;
    const pageId = firstPage?.id || null;

    const payload = { tenant_id: tenantId, provider:"meta",
      user_long_lived_token: encrypt(userToken),
      user_token_expires_at: userExpiresAt, page_id: pageId };
    const { error: dbErr } = await supa.from("oauth_accounts").upsert(payload, { onConflict: "tenant_id" });
    if (dbErr) return res.status(500).type("html").send(`<h3>Erro DB</h3><pre>${dbErr.message}</pre>`);

    const back = origin || `/comecar?tenant=${encodeURIComponent(tenantId)}`;
    res.type("html").send(
      `<h2>Conta conectada com sucesso ✅</h2>
       <p><b>Tenant:</b> ${tenantId}</p>
       <ul><li><b>Page ID:</b> ${pageId || "—"}</li><li>Token salvo com segurança.</li></ul>
       <p><a href="${back}">Voltar</a></p>`
    );
  }catch(e){ console.error(e); res.status(500).send("Erro no callback"); }
});

// webhook GET (verify)
app.get("/webhooks/meta", (req,res)=>{
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode==="subscribe" && token===META_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server on ${PORT}`));
