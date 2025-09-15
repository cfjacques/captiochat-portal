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

// ---------- base url (usado para montar webhook callback) ----------
const BASE_URL = (() => {
  try {
    return new URL(META_REDIRECT_URI).origin;
  } catch {
    return "https://app.captiochat.com";
  }
})();
const APP_WEBHOOK_URL = `${BASE_URL}/webhooks/meta`;

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
function decrypt(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// ---------- supabase ----------
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

// util: localizar tenant pelo page_id
async function findTenantByPageId(pageId) {
  const { data } = await supa
    .from("oauth_accounts")
    .select("tenant_id")
    .eq("page_id", String(pageId))
    .maybeSingle();
  return data?.tenant_id || null;
}

// ======================= LOGIN (já funcional) =======================
app.get("/auth/meta/start", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(","); // mínimo; já temos page access token salvo do fluxo anterior
  const url =
    dialog(`/dialog/oauth`) +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;
  res.redirect(url);
});

app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state } = req.query; // state = tenant_id
    const tenantId = String(state || "demo");

    // 1) short-lived
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

    // 2) long-lived (~60 dias)
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

    // 3) pegar Page ID (id,name; page token já está salvo de antes; se não estiver, deixamos null)
    const r3 = await fetch(
      graph(`/me/accounts`) + `?fields=id,name&access_token=${encodeURIComponent(userToken)}`
    );
    const pages = await r3.json();
    const firstPage = Array.isArray(pages?.data) && pages.data.length > 0 ? pages.data[0] : null;
    const pageId = firstPage?.id || null;

    // 4) salvar/atualizar no Supabase (user token cifrado)
    const payload = {
      tenant_id: tenantId,
      provider: "meta",
      user_long_lived_token: encrypt(userToken),
      user_token_expires_at: userExpiresAt,
      page_id: pageId
      // page_access_token / ig_user_id podem já existir de login anterior, não vamos sobrepor aqui
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
           <li><b>Page ID:</b> ${pageId || "— (nenhuma página listada)"}</li>
         </ul>
         <p>Próximo passo: configurar **webhooks (feed)** e inscrever sua Página para enviarmos eventos.</p>`
      );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro no callback");
  }
});

// ======================= WEBHOOKS =======================

// 1) Verificação (GET)
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Recebimento (POST) — salva no Supabase
app.post("/webhooks/meta", async (req, res) => {
  try {
    const body = req.body || {};
    // tentar mapear tenant pela page_id do entry
    let tenantId = null;
    let pageId = null;
    if (Array.isArray(body.entry) && body.entry.length > 0) {
      pageId = String(body.entry[0].id || "");
      if (pageId) tenantId = await findTenantByPageId(pageId);
    }

    await supa.from("events").insert({
      provider: "meta",
      tenant_id: tenantId,
      page_id: pageId,
      body
    });

    res.status(200).send("ok");
  } catch (e) {
    console.error("Erro no webhook:", e);
    res.sendStatus(200); // sempre 200 para não reentregar sem fim
  }
});

// ======================= CONFIGURAR ASSINATURA (APP) =======================
// Registra no APP (objeto=page) que queremos receber o campo 'feed'
// Isso dispara a verificação GET no /webhooks/meta
app.get("/meta/app/webhooks/setup", async (_req, res) => {
  try {
    const appAccessToken = `${META_APP_ID}|${META_APP_SECRET}`;
    const r = await fetch(
      graph(`/${META_APP_ID}/subscriptions`) +
        `?object=page` +
        `&callback_url=${encodeURIComponent(APP_WEBHOOK_URL)}` +
        `&verify_token=${encodeURIComponent(META_VERIFY_TOKEN)}` +
        `&fields=${encodeURIComponent("feed")}` +
        `&include_values=true` +
        `&access_token=${appAccessToken}`,
      { method: "POST" }
    );
    const data = await r.json();
    res
      .status(200)
      .type("html")
      .send(
        `<h3>Resultado da assinatura do APP (page/feed):</h3>` +
          `<pre>${JSON.stringify(data, null, 2)}</pre>` +
          `<p>Callback: <code>${APP_WEBHOOK_URL}</code></p>`
      );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro ao configurar assinatura do app");
  }
});

// Consulta assinaturas do APP
app.get("/meta/app/webhooks/list", async (_req, res) => {
  try {
    const appAccessToken = `${META_APP_ID}|${META_APP_SECRET}`;
    const r = await fetch(
      graph(`/${META_APP_ID}/subscriptions`) + `?access_token=${appAccessToken}`
    );
    const data = await r.json();
    res.type("html").send(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro ao listar assinaturas do app");
  }
});

// ======================= INSCRVER UMA PÁGINA (tenant) =======================
// Inscreve a Página do tenant para enviar eventos 'feed' para o app
app.get("/meta/page/subscribe", async (req, res) => {
  try {
    const tenantId = String(req.query.tenant_id || "");
    if (!tenantId) return res.status(400).send("Passe ?tenant_id=");
    const { data, error } = await supa
      .from("oauth_accounts")
      .select("page_id, page_access_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return res.status(404).send("Tenant não encontrado");
    if (!data.page_id || !data.page_access_token)
      return res.status(400).send("Falta page_id ou page_access_token para este tenant");

    const pageId = data.page_id;
    const pageToken = decrypt(data.page_access_token);

    const r = await fetch(
      graph(`/${pageId}/subscribed_apps`) +
        `?subscribed_fields=${encodeURIComponent("feed")}` +
        `&access_token=${encodeURIComponent(pageToken)}`,
      { method: "POST" }
    );
    const out = await r.json();

    res
      .status(200)
      .type("html")
      .send(
        `<h3>Resultado da inscrição da Página (${pageId}) em feed:</h3><pre>${JSON.stringify(
          out,
          null,
          2
        )}</pre>`
      );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro ao inscrever a página");
  }
});

// Ver assinaturas atuais da Página
app.get("/meta/page/subscriptions", async (req, res) => {
  try {
    const tenantId = String(req.query.tenant_id || "");
    if (!tenantId) return res.status(400).send("Passe ?tenant_id=");
    const { data, error } = await supa
      .from("oauth_accounts")
      .select("page_id, page_access_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return res.status(404).send("Tenant não encontrado");
    if (!data.page_id || !data.page_access_token)
      return res.status(400).send("Falta page_id ou page_access_token para este tenant");

    const pageId = data.page_id;
    const pageToken = decrypt(data.page_access_token);

    const r = await fetch(
      graph(`/${pageId}/subscribed_apps`) +
        `?access_token=${encodeURIComponent(pageToken)}`
    );
    const out = await r.json();

    res.type("html").send(`<pre>${JSON.stringify(out, null, 2)}</pre>`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro ao consultar assinaturas da página");
  }
});

// ======================= DIAGNÓSTICO: eventos =======================
app.get("/meta/events", async (req, res) => {
  try {
    const tenantId = req.query.tenant_id ? String(req.query.tenant_id) : null;
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    let q = supa.from("events").select("*").order("created_at", { ascending: false }).limit(limit);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q;
    if (error) return res.status(500).send(error.message);
    res.type("html").send(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro ao listar eventos");
  }
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
