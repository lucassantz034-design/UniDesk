import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/routes/api.js';
import { db } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distDir = path.join(__dirname, 'frontend', 'dist');
const distIndex = path.join(distDir, 'index.html');
const hasDist = fs.existsSync(distIndex);

// Serve frontend static assets (React build if available, plus public assets)
if (hasDist) {
  app.use(express.static(distDir));
}
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRouter);

// WebSocket connected clients pool
const clients = new Set();

export function broadcastWS(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        // Ignorar clientes que fecharam repentinamente
      }
    }
  }
}

app.set('broadcastWS', broadcastWS);

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.send(JSON.stringify({
    type: 'WELCOME',
    message: 'Conectado ao Unidesk Real-time Gateway',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Broadcast real-time chat messages to all connected attendants & students in session
      if (data.type === 'CHAT_MESSAGE' || data.type === 'TICKET_UPDATE') {
        broadcastWS(data);
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

// Navigation routes (React SPA or fallback to static HTML)
app.get(['/', '/aluno', '/atendente', '/operador', '/admin'], (req, res) => {
  if (hasDist) {
    return res.sendFile(distIndex);
  }
  if (req.path === '/atendente' || req.path === '/operador') {
    return res.sendFile(path.join(__dirname, 'public', 'attendant.html'));
  }
  if (req.path === '/admin') {
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA catch-all for any other client route
if (hasDist) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/ws') {
      return next();
    }
    res.sendFile(distIndex);
  });
}

server.listen(PORT, () => {
  const config = db.getConfig();
  console.log(`====================================================`);
  console.log(`🎓 UNIDESK — HELPDESK UNIVERSITÁRIO SELF-HOSTED`);
  console.log(`🏛️  Instituição: ${config.name}`);
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📱 Portal do Aluno:      http://localhost:${PORT}/aluno`);
  console.log(`🎧 Painel do Atendente:   http://localhost:${PORT}/atendente`);
  console.log(`⚙️  Painel Administrativo: http://localhost:${PORT}/admin`);
  console.log(`💬 Widget Script:        http://localhost:${PORT}/widget/unidesk-chat.js`);
  console.log(`📡 WebSocket Gateway:    ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
