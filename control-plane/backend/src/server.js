require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const { ensureKeys } = require('./services/cryptoService');

const app = express();
const PORT = process.env.PORT || 4000;

// Garante que o par Ed25519 esteja gerado e pronto
ensureKeys();

app.use(cors());
app.use(express.json());

// Logger simples de requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rotas da API
app.use('/api/v1', apiRoutes);

// Fallback de erro
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Erro interno no servidor' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 UniDesk Control Plane rodando na porta ${PORT}`);
    console.log(`📡 Endpoints disponíveis em http://localhost:${PORT}/api/v1`);
  });
}

module.exports = app;
