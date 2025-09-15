// app.js
import express from "express";
import bodyParser from "body-parser";

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

// ---------- config Meta ----------
const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_VERIFY_TOKEN
} = process.env;

// ---------- OAuth: iniciar (escopo mínimo por enquanto) ----------
app.get("/auth/meta/start", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata"
].join(",");


  const url =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;

  res.redirect(url);
});

// ---------- DEBUG: ver URL que será usada ----------
app.get("/auth/meta/debug", (req, res) => {
  const tenantId = req.query.tenant_id || "demo";
  const scopes = ["pages_show_list"].join(",");
  const url =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(tenantId)}`;

  res
    .type("html")
    .send(
      `<h3>client_id:</h3><pre>${META_APP_ID}</pre>` +
      `<h3>redirect_uri (env):</h3><pre>${META_REDIRECT_URI}</pre>` +
      `<h3>URL completa:</h3><pre>${url}</pre>` +
      `<p><a href="${url}">→ Abrir fluxo OAuth agora</a></p>`
    );
});

// ---------- OAuth: callback (troca por long-lived) ----------
app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    // 1) token curto
    const r1 = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
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
      `https://graph.facebook.com/v19.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${shortTok.access_token}`
    );
    const longTok = await r2.json();

    res
      .status(200)
      .type("html")
      .send(
        `<h2>Login OK (tenant: ${state || "demo"})</h2>` +
          `<h3>Short-lived token:</h3><pre>${JSON.stringify(shortTok, null, 2)}</pre>` +
          `<h3>Long-lived user token:</h3><pre>${JSON.stringify(longTok, null, 2)}</pre>` +
          `<p>Próximo: listar Páginas e IG.</p>`
      );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro no callback");
  }
});

// ---------- Webhook GET: verificação ----------
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
