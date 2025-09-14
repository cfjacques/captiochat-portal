import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Rota de saúde (Render usa para checar se está vivo)
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Página inicial (por enquanto só uma mensagem)
app.get("/", (_req, res) => res.send("CaptioChat portal online 🚀"));

// Webhook placeholder (vamos completar no passo 3)
app.get("/webhooks/meta", (req, res) => {
  // aqui no futuro vamos responder o hub.challenge
  res.status(200).send("pending-setup");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
