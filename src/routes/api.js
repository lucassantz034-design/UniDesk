import express from 'express';
import { db } from '../db.js';
import { AIService } from '../aiService.js';
import { heartbeatClient } from '../licensing/heartbeatClient.js';
import { licenseVerifier } from '../licensing/licenseVerifier.js';
import { supportClient } from '../support/supportClient.js';
import { requireAuth } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

export const apiRouter = express.Router();

function emitEvent(req, payload) {
  const broadcast = req.app?.get('broadcastWS');
  if (typeof broadcast === 'function') {
    broadcast(payload);
  }
}

// Health check & Telemetry status
apiRouter.get('/health', (req, res) => {
  const cfg = db.getConfig();
  res.json({
    status: 'ok',
    engine: 'Node.js (Express + SQLite)',
    instance: cfg ? cfg.name : 'UniDesk',
    version: cfg ? cfg.version : '2.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Institution & Branding Configuration (Sanitizada para acesso público)
apiRouter.get('/config', (req, res) => {
  const cfg = { ...db.getConfig() };
  if (cfg.aiApiKey) {
    cfg.aiApiKey = '••••••••';
  }
  res.json(cfg);
});

// Configuração completa restrita a administradores (com visualização de aiApiKey)
apiRouter.get('/admin/config', requireAuth(['admin']), (req, res) => {
  res.json(db.getConfig());
});

apiRouter.put('/config', requireAuth(['admin']), (req, res) => {
  const body = { ...req.body };
  if (body.aiApiKey && body.aiApiKey.includes('••••')) {
    delete body.aiApiKey;
  }
  const updated = db.updateConfig(body);
  res.json({ success: true, config: updated });
});

// Authentication (Login com E-mail institucional e validação obrigatória de senha)
apiRouter.post('/auth/login', (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Por favor, informe seu e-mail institucional.' });
    }
    const result = db.authenticate(email, password, role);
    res.json({
      success: true,
      user: result.user,
      token: result.token,
      message: `Bem-vindo(a), ${result.user.name}!`
    });
  } catch (err) {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', requireAuth(), (req, res) => {
  res.json({ success: true, user: req.user });
});

apiRouter.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// Users
apiRouter.get('/users', (req, res) => {
  const { role } = req.query;
  res.json(db.getUsers(role));
});

apiRouter.get('/users/:id', (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json(user);
});

apiRouter.post('/users', requireAuth(['admin']), (req, res) => {
  const { name, email, role, department, course, period, cpf, phone } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Nome e E-mail são obrigatórios para cadastro" });
  }
  const newUser = db.addUser({
    name,
    email,
    cpf,
    course,
    period,
    phone,
    role: role || 'student',
    department: department || course || "Graduação",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
  });
  res.status(201).json(newUser);
});

// Categories
apiRouter.get('/categories', (req, res) => {
  res.json(db.getCategories());
});

// Tickets
apiRouter.get('/tickets', (req, res) => {
  const { studentId, attendantId, status, categoryId } = req.query;
  const tickets = db.getTickets({ studentId, attendantId, status, categoryId });
  
  // Attach student and attendant basic info
  const enriched = tickets.map(t => {
    const student = db.getUserById(t.studentId);
    const attendant = db.getUserById(t.attendantId);
    const category = db.getCategories().find(c => c.id === t.categoryId);
    return {
      ...t,
      studentName: student ? student.name : "Aluno",
      studentRa: student ? student.ra : "N/A",
      studentCourse: student ? student.course : "N/A",
      attendantName: attendant ? attendant.name : "Não atribuído",
      categoryName: category ? category.name : "Geral"
    };
  });

  res.json(enriched);
});

apiRouter.get('/tickets/:id', (req, res) => {
  const ticket = db.getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

  const student = db.getUserById(ticket.studentId);
  const attendant = db.getUserById(ticket.attendantId);
  const category = db.getCategories().find(c => c.id === ticket.categoryId);

  res.json({
    ...ticket,
    student,
    attendant,
    category
  });
});

apiRouter.post('/tickets', (req, res) => {
  const { studentId, categoryId, subject, description, priority, origin, attachments } = req.body;
  if (!studentId || !categoryId || !subject || !description) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios" });
  }

  const created = db.createTicket({
    studentId,
    categoryId,
    subject,
    description,
    priority: priority || "medium",
    origin: origin || "portal",
    attachments: attachments || []
  });

  emitEvent(req, {
    type: 'TICKET_UPDATE',
    action: 'created',
    ticket: created
  });

  res.status(201).json(created);
});

apiRouter.post('/tickets/:id/messages', (req, res) => {
  const { senderId, message, isInternalNote, attachments } = req.body;
  if (!senderId || !message) {
    return res.status(400).json({ error: "Remetente e mensagem são obrigatórios" });
  }

  const msg = db.addTicketMessage(req.params.id, {
    senderId,
    message,
    isInternalNote: !!isInternalNote,
    attachments: attachments || []
  });

  if (!msg) return res.status(404).json({ error: "Chamado não encontrado" });

  emitEvent(req, {
    type: 'CHAT_MESSAGE',
    ticketId: req.params.id,
    message: msg
  });

  res.status(201).json(msg);
});

apiRouter.patch('/tickets/:id/status', (req, res) => {
  const { status, csatScore } = req.body;
  if (!status) return res.status(400).json({ error: "Status é obrigatório" });

  const updated = db.updateTicketStatus(req.params.id, status, csatScore);
  if (!updated) return res.status(404).json({ error: "Chamado não encontrado" });

  emitEvent(req, {
    type: 'TICKET_UPDATE',
    action: 'status_change',
    ticket: updated
  });

  res.json(updated);
});

// AI Student Context
apiRouter.get('/students/:id/ai-context', async (req, res) => {
  try {
    const context = await AIService.getOrGenerateStudentContext(req.params.id);
    if (!context) return res.status(404).json({ error: "Contexto não encontrado para o aluno" });
    res.json(context);
  } catch (err) {
    res.status(500).json({ error: "Erro ao processar inteligência do aluno", details: err.message });
  }
});

// Knowledge Base / FAQ
apiRouter.get('/faq', (req, res) => {
  const { search, categoryId } = req.query;
  const list = db.getKnowledgeBase(search, categoryId);
  res.json(list);
});

// Chat Sessions
apiRouter.get('/chat/sessions', (req, res) => {
  res.json(db.getChatSessions());
});

apiRouter.get('/chat/sessions/:id', (req, res) => {
  const session = db.getChatSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Sessão não encontrada" });
  res.json(session);
});

apiRouter.post('/chat/start', (req, res) => {
  const { studentId, department } = req.body;
  const session = db.createChatSession(studentId || "usr-stu-1", department || "Geral");
  res.status(201).json(session);
});

apiRouter.post('/chat/:id/messages', async (req, res) => {
  const { sender, senderName, text } = req.body;
  if (!text) return res.status(400).json({ error: "Texto da mensagem é obrigatório" });

  const session = db.getChatSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

  // Add the student message
  const userMsg = db.addChatMessage(req.params.id, {
    sender: sender || "student",
    senderName: senderName || "Aluno",
    text
  });

  // If in bot mode and message is from student, generate AI response
  let botReply = null;
  if (session.status === 'bot' && sender === 'student') {
    const aiResult = await AIService.handleChatbotTurn(req.params.id, text);
    botReply = db.addChatMessage(req.params.id, {
      sender: "bot",
      senderName: db.getConfig().name.split(' ')[0] + " Bot",
      text: aiResult.response
    });
  }

  emitEvent(req, {
    type: 'CHAT_MESSAGE',
    sessionId: req.params.id,
    userMessage: userMsg,
    botReply
  });

  res.json({
    userMessage: userMsg,
    botReply,
    session: db.getChatSession(req.params.id)
  });
});

apiRouter.post('/chat/:id/escalate', (req, res) => {
  const { department } = req.body;
  const session = db.escalateChatSession(req.params.id, department);
  if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

  emitEvent(req, {
    type: 'CHAT_MESSAGE',
    sessionId: req.params.id,
    action: 'escalated',
    department
  });

  res.json(session);
});

// Admin Metrics
apiRouter.get('/admin/metrics', requireAuth(['admin', 'attendant']), (req, res) => {
  res.json(db.getMetrics());
});

apiRouter.post('/telemetry/heartbeat', (req, res) => {
  // Simulates central licensing heartbeat without sending any student PII
  const config = db.getConfig();
  const metrics = db.getMetrics();
  
  const payload = {
    licenseKey: config.licenseKey,
    instanceVersion: config.version,
    institutionName: config.name,
    totalTickets: metrics.totalTickets,
    slaCompliancePercent: metrics.slaCompliancePercent,
    status: "healthy",
    transmittedAt: new Date().toISOString()
  };

  res.json({
    verified: true,
    message: "Licença Self-Hosted ativa e válida.",
    payload
  });
});

// =========================================================================
// ROTAS RELACIONAIS DA SPEC DE BANCO DE DADOS
// =========================================================================

// 1. Views de Estatísticas e Contadores
apiRouter.get('/sql/chamados/stats', (req, res) => {
  const abertos = db.getChamadosAbertosTempoReal();
  const resolvidos = db.getChamadosResolvidosCount();
  res.json({
    chamados_abertos_tempo_real: abertos.total_abertos_tempo_real,
    chamados_resolvidos_count: resolvidos.total_resolvidos
  });
});

apiRouter.get('/sql/tecnicos-rating', (req, res) => {
  res.json(db.getNotaMediaTecnicos());
});

apiRouter.get('/sql/alunos-rating', (req, res) => {
  res.json(db.getNotaMediaAlunos());
});

apiRouter.get('/sql/users-by-role', requireAuth(['admin', 'attendant']), (req, res) => {
  res.json(db.getUsuariosPorRole());
});

apiRouter.get('/sql/logs-admin', requireAuth(['admin']), (req, res) => {
  res.json(db.getLogsAdmin());
});

// 2. Gestão de Usuários pelo Admin Faculdade (Seção 5)
apiRouter.post('/sql/users', requireAuth(['admin']), (req, res) => {
  try {
    const { adminId, nomeCompleto, cpf, email, role, extra } = req.body;
    if (!nomeCompleto || !cpf || !email || !role) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes (nomeCompleto, cpf, email, role)." });
    }
    const effectiveAdminId = req.user?.id || adminId;
    const created = db.criarUsuario({ adminId: effectiveAdminId, nomeCompleto, cpf, email, role, extra });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar usuário", details: err.message });
  }
});

apiRouter.post('/sql/users/:id/reset-password', requireAuth(['admin']), (req, res) => {
  try {
    const { adminId, novoHash, novaSenha } = req.body;
    const effectiveAdminId = req.user?.id || adminId;
    const result = db.redefinirSenha({ adminId: effectiveAdminId, usuarioId: req.params.id, novoHash, novaSenha });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao redefinir senha", details: err.message });
  }
});

apiRouter.post('/sql/users/:id/inactivate', requireAuth(['admin']), (req, res) => {
  try {
    const { adminId } = req.body;
    const effectiveAdminId = req.user?.id || adminId;
    const result = db.inativarUsuario({ adminId: effectiveAdminId, usuarioId: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao inativar usuário", details: err.message });
  }
});

// 3. Avaliações (Seção 3.3 e 3.4)
apiRouter.post('/sql/ratings/tecnico', (req, res) => {
  try {
    const { chamadoId, alunoId, tecnicoId, nota, comentario } = req.body;
    if (!chamadoId || !alunoId || !tecnicoId || !nota) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes para avaliação do técnico." });
    }
    const result = db.avaliarTecnico({ chamadoId, alunoId, tecnicoId, nota: Number(nota), comentario });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao registrar avaliação do técnico", details: err.message });
  }
});

apiRouter.post('/sql/ratings/aluno', (req, res) => {
  try {
    const { chamadoId, tecnicoId, alunoId, nota, comentario } = req.body;
    if (!chamadoId || !tecnicoId || !alunoId || !nota) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes para avaliação do aluno." });
    }
    const result = db.avaliarAluno({ chamadoId, tecnicoId, alunoId, nota: Number(nota), comentario });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao registrar avaliação do aluno", details: err.message });
  }
});

// ==========================================
// MÓDULO DE LICENCIAMENTO (EPIC-3)
// ==========================================

// Retorna o status da licença (com flag de warning se em grace period)
apiRouter.get('/licensing/status', (req, res) => {
  const status = heartbeatClient.getStatus();
  res.json({
    success: true,
    data: status,
    warning: req.licenseWarning || null
  });
});

// Força emissão de heartbeat outbound para a Central
apiRouter.post('/licensing/heartbeat', async (req, res) => {
  try {
    const result = await heartbeatClient.sendHeartbeat(req.body?.telemetry || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retorna dados da fatura / cobrança Asaas
apiRouter.get('/licensing/invoice', (req, res) => {
  const status = heartbeatClient.getStatus();
  res.json({
    success: true,
    invoice: status.invoice || {
      message: 'Fatura anual de licenciamento UniDesk',
      paymentUrl: 'https://asaas.com/i/unidesk-licenca',
      amount: 1499.00,
      pixQrCode: '00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/cobv/unidesk-licenca-anual5204000053039865405599.005802BR5925UNIDESK SOLUCOES SAAS LTDA6009SAO PAULO62070503***6304E85C'
    }
  });
});

// Endpoint administrativo para simular status (demonstração / testes de QA)
apiRouter.post('/licensing/simulate', requireAuth(['admin']), (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'A rota de simulação está desativada em ambiente de produção.' });
  }

  const { status, daysInGrace, invoice } = req.body;
  if (!status || !['ACTIVE', 'GRACE_PERIOD', 'LOCKED'].includes(status)) {
    return res.status(400).json({ error: 'Status deve ser ACTIVE, GRACE_PERIOD ou LOCKED' });
  }
  const updated = heartbeatClient.forceState({
    status,
    daysInGrace: daysInGrace !== undefined ? Number(daysInGrace) : (status === 'GRACE_PERIOD' ? 5 : status === 'LOCKED' ? 16 : 0),
    daysRemainingGrace: status === 'GRACE_PERIOD' ? Math.max(0, 15 - (Number(daysInGrace) || 5)) : (status === 'LOCKED' ? 0 : 15),
    invoice: invoice || (status !== 'ACTIVE' ? {
      message: 'Fatura de Renovação Anual do Software UniDesk',
      amount: 1499.00,
      paymentUrl: 'https://asaas.com/i/unidesk-licenca',
      pixQrCode: '00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/cobv/unidesk-licenca-anual5204000053039865405599.005802BR5925UNIDESK SOLUCOES SAAS LTDA6009SAO PAULO62070503***6304E85C'
    } : null)
  });
  res.json({ success: true, state: updated });
});

// Validação matemática de token avulso
apiRouter.post('/licensing/verify-token', (req, res) => {
  const { token } = req.body;
  const result = licenseVerifier.verifyToken(token);
  res.json(result);
});

// ==========================================
// MÓDULO DE SUPORTE DA PLATAFORMA (EPIC-4)
// ==========================================

// Despacha chamado técnico com diagnósticos para a Central do Fornecedor
apiRouter.post('/admin/support/ticket', requireAuth(['admin', 'attendant']), async (req, res) => {
  try {
    const title = req.body.title || req.body.subject;
    const { description, priority, contactEmail, category } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Título e descrição são obrigatórios para abertura de chamado.' });
    }

    const result = await supportClient.submitTicket({
      title,
      description,
      priority: priority || 'MEDIUM',
      category: category || 'INCIDENT',
      contactEmail: contactEmail || 'admin@metropolitana.edu.br'
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao despachar chamado para a Central do Fornecedor', details: err.message });
  }
});

// Consulta chamados na fila de contingência local
apiRouter.get('/admin/support/pending', requireAuth(['admin', 'attendant']), (req, res) => {
  try {
    const pending = supportClient.loadPendingTickets();
    res.json({
      success: true,
      count: pending.length,
      pending
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar fila de suporte local', details: err.message });
  }
});

// Força reenvio de chamados da fila de contingência
apiRouter.post('/admin/support/flush', requireAuth(['admin', 'attendant']), async (req, res) => {
  try {
    const result = await supportClient.flushPendingTickets();
    res.json({
      success: true,
      result
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao executar reenvio de contingência', details: err.message });
  }
});

// ==========================================
// MÓDULO DE BACKUP & SEGURANÇA DE DADOS
// ==========================================
import { backupService } from '../services/backupService.js';

// Listar backups existentes
apiRouter.get('/admin/backups', requireAuth(['admin']), (req, res) => {
  try {
    const list = backupService.listBackups();
    res.json({
      success: true,
      retentionDays: backupService.retentionDays,
      intervalHours: backupService.intervalHours,
      backups: list
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disparar backup imediato
apiRouter.post('/admin/backups/create', requireAuth(['admin']), async (req, res) => {
  try {
    const backup = await backupService.createBackup();
    res.status(201).json({
      success: true,
      message: 'Backup transacional concluído com sucesso!',
      backup
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Baixar um backup existente (autenticado, somente o arquivo solicitado)
apiRouter.get('/admin/backups/:filename', requireAuth(['admin']), (req, res) => {
  try {
    const { filename } = req.params;
    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    const filePath = path.resolve(backupDir, filename);

    // Apenas o backup pertencente ao diretório de backups pode ser servido
    if (!filePath.startsWith(backupDir)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup não encontrado.' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


