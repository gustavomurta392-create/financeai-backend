const express = require("express");
const cors = require("cors");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

const app = express();
app.use(cors());
app.use(express.json());

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);
const accessTokens = {};

app.post("/api/create-link-token", async (req, res) => {
  const { userId } = req.body;
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId || "default" },
      client_name: "FinanceAI",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

app.post("/api/exchange-token", async (req, res) => {
  const { public_token, userId } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    accessTokens[userId || "default"] = response.data.access_token;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

app.post("/api/transactions", async (req, res) => {
  const { userId } = req.body;
  const accessToken = accessTokens[userId || "default"];
  if (!accessToken) return res.status(400).json({ error: "Conta não conectada" });
  const today = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  try {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: start,
      end_date: today,
      options: { count: 100 },
    });
    res.json({ transactions: response.data.transactions });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

app.post("/api/balance", async (req, res) => {
  const { userId } = req.body;
  const accessToken = accessTokens[userId || "default"];
  if (!accessToken) return res.status(400).json({ error: "Conta não conectada" });
  try {
    const response = await plaidClient.accountsBalanceGet({ access_token: accessToken });
    const total = response.data.accounts.reduce((s, a) => s + (a.balances.current || 0), 0);
    res.json({ balance: total });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

app.get("/", (req, res) => res.json({ status: "FinanceAI backend rodando!" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
