app.get("/auth/meta/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    // 1) token curto
    const r1 = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI)}` +
      `&code=${code}`
    );
    const shortTok = await r1.json();
    if (!shortTok.access_token) {
      return res
        .status(400)
        .type("html")
        .send(`<h3>Erro ao obter token curto</h3><pre>${JSON.stringify(shortTok, null, 2)}</pre>`);
    }

    // 2) troca por token longo (~60 dias)
    const r2 = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${shortTok.access_token}`
    );
    const longTok = await r2.json();

    // 3) exibe resultado (MVP)
    res
      .status(200)
      .type("html")
      .send(
        `<h2>Login OK (tenant: ${state || "demo"})</h2>` +
        `<h3>Short-lived token (não usar em produção):</h3>` +
        `<pre>${JSON.stringify(shortTok, null, 2)}</pre>` +
        `<h3>Long-lived user token (usar nos próximos passos):</h3>` +
        `<pre>${JSON.stringify(longTok, null, 2)}</pre>` +
        `<p>Próximo: listar Páginas e achar o Instagram vinculado.</p>`
      );
  } catch (e) {
    console.error(e);
    res.status(500).send("Erro no callback");
  }
});
