// app.js
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// ---------- health ----------
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ---------- home ----------
app.get("/", (_req, res) => res.send("CaptioChat portal online 🚀"));

// ---------- legal ----------
const PRIVACY_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Privacy Policy</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Privacy Policy</h1><p>Last updated: 2025-09-14</p><p>CaptioChat collects and processes data strictly to provide automation services on Instagram/Facebook/WhatsApp via Meta’s APIs.</p><h2>What we collect</h2><ul><li>Meta profile IDs, Page IDs, Instagram Business IDs</li><li>OAuth tokens provided by Meta (stored securely, encrypted at rest)</li><li>Inbound messages/events necessary to operate the service</li></ul><h2>How we use data</h2><p>To connect your account, receive events (DMs/comments) and send automated replies via your authorization.</p><h2>Sharing</h2><p>We do not sell personal data. Data may be shared with processors strictly to run the service (e.g., hosting, databases).</p><h2>Retention</h2><p>We retain data only while your account is active or as required by law; tokens can be revoked at any time.</p><h2>Security</h2><p>Encryption at rest, access control, and least-privilege. Contact us if you suspect unauthorized access.</p><h2>Your rights</h2><p>Contact us to access, correct, or delete your data.</p><h2>Contact</h2><p>Email: legal@captiochat.com</p>`;
const TOS_HTML = `<!doctype html><meta charset="utf-8"><title>CaptioChat – Terms of Service</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>Terms of Service</h1><p>Last updated: 2025-09-14</p><h2>1. Agreement</h2><p>By using CaptioChat you agree to these Terms and Meta’s Platform Policies.</p><h2>2. Use of the Service</h2><ul><li>You must own/operate the Pages/IG accounts you connect.</li><li>No spam, harassment, or prohibited content. You must follow all Meta policies.</li></ul><h2>3. Billing</h2><p>Free while in beta; paid plans may be introduced later with notice.</p><h2>4. Data</h2><p>We process data on your behalf to deliver automations. See our Privacy Policy.</p><h2>5. Termination</h2><p>We may suspend access for violations or security risks. You may disconnect at any time.</p><h2>6. Disclaimer</h2><p>Service provided “as is”, without warranties; to the extent permitted by law.</p><h2>7. Contact</h2><p>Email: legal@captiochat.com</p>`;
app.get("/legal/privacy", (_req, res) => res.type("html").send(PRIVACY_HTML));
app.get("/legal/tos", (_req, res) => res.type("html").send(TOS_HTML));

// ---------- env ----------
const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_VERIFY_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  ENC_SECRET,
  META_GRAPH_VERSION // ex.: "v19.0", "v20.0"
} = process.env;

// ---------- version helpers ----------
const FBV = META_GRAPH_VERSION || "v19.0";
const graph = (pathAndQuery) => `https://graph.facebook.com/${FBV}${pathAndQuery}`;
const dialog = (pathAndQuery) => `https://www.facebook.com/${FBV}${pathAndQuery}`;

// ---------- crypto helpers (AES-256-GCM) ----------
const ENC_KEY = Buffer.from(ENC_SECRET || "", "base64"); // 32 bytes
function encrypt(text) {
  if (!ENC_KEY || ENC_KEY.length !== 32) throw new Error("ENC_SECRET inválido");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// ---------- supabase ----------
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

// ---------- OAuth: iniciar (escopo mínimo por enquanto) ----------
app.get("/auth/meta/start", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(","); // manter mínimo para evitar "Invalid Scopes"

  const url =
    dialog(`/dialog/oauth`) +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;

  res.redirect(url);
});

// ---------- DEBUG: ver URL/redirect atual ----------
app.get("/auth/meta/debug", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(",");
  const url =
    dialog(`/dialog/oauth`) +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;

  res
    .type("html")
    .send(
      `<h3>client_id:</h3><pre>${META_APP_ID}</pre>` +
      `<h3>redirect_uri:</h3><pre>${META_REDIRECT_URI}</pre>` +
      `<h3>API version:</h3><pre>${FBV}</pre>` +
      `<h3>URL completa:</h3><pre>${url}</pre>` +
      `<p><a href="${url}">→ Abrir fluxo OAuth agora</a></p>`
    );
});

// ---------- OAuth: callback (short → long + salvar no Supabase) ----------
app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state } = req.query; // state = tenant_id
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
      return res
        .status(400)
        .type("html")
        .send(`<h3>Erro ao obter token curto</h3><pre>${JSON.stringify(shortTok, null, 2)}</pre>`);
    }

    // 2) token longo (~60 dias)
    const r2 = await fetch(
      graph(`/oauth/access_token`) +
        `?grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${shortTok.access_token}`
    );
    const longTok = await r2.json();
    if (!longTok.access_token) {
      return res
        .status(400)
        .type("html")
        .send(`<h3>Erro ao estender token</h3><pre>${JSON.stringify(longTok, null, 2)}</pre>`);
    }
    const userToken = longTok.access_token;
    const userExpiresAt = new Date(Date.now() + (longTok.expires_in || 0) * 1000).toISOString();

    // 3) listar páginas (apenas id,name para não exigir outros escopos)
    const r3 = await fetch(
      graph(`/me/accounts`) +
        `?fields=id,name` +
        `&access_token=${encodeURIComponent(userToken)}`
    );
    const pages = await r3.json();
    if (pages.error) {
      console.error("Erro ao listar páginas:", pages.error);
    }

    const firstPage = Array.isArray(pages?.data) && pages.data.length > 0 ? pages.data[0] : null;
    const pageId = firstPage?.id || null;

    // 4) salvar/atualizar no Supabase (tokens cifrados)
    const payload = {
      tenant_id: tenantId,
      provider: "meta",
      user_long_lived_token: encrypt(userToken),
      user_token_expires_at: userExpiresAt,
      page_id: pageId,
      page_access_token: null, // pegaremos depois com escopos extras
      ig_user_id: null
    };

    const { error } = await supa
      .from("oauth_accounts")
      .upsert(payload, { onConflict: "tenant_id" });

    if (error) {
      console.error(error);
      return res.status(500).type("html").send(`<h3>Erro ao salvar no banco</h3><pre>${error.message}</pre>`);
    }

    return res
      .status(200)
      .type("html")
      .send(
        `<h2>Conta conectada com sucesso ✅</h2>
         <p><b>Tenant:</b> ${tenantId}</p>
         <ul>
           <li><b>Page ID (primeira encontrada):</b> ${pageId || "— (nenhuma página listada)"}</li>
           <li><b>Token salvo com segurança.</b></li>
         </ul>
         <p>Versão da API em uso: <code>${FBV}</code>. Para atualizar, basta mudar a env <code>META_GRAPH_VERSION</code> e reiniciar.</p>`
      );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro no callback");
  }
});

// ---------- Webhook GET: verificação (usaremos depois) ----------
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
