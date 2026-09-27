import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_SQLITE_PATH = path.join(DATA_DIR, 'unidesk.db');
const DB_JSON_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database Engine with SQLite integration
export class Database {
  constructor() {
    this.initSQLite();
    this.loadJsonFallback();
  }

  initSQLite() {
    try {
      this.sqlite = new DatabaseSync(DB_SQLITE_PATH);
      this.sqlite.exec('PRAGMA foreign_keys = ON;');
      console.log('✓ Conectado com sucesso ao SQLite Relacional: data/unidesk.db');
    } catch (err) {
      console.error('Aviso: SQLite não pôde ser aberto, usando fallback em memória/JSON:', err.message);
      this.sqlite = null;
    }
  }

  loadJsonFallback() {
    if (fs.existsSync(DB_JSON_FILE)) {
      try {
        const raw = fs.readFileSync(DB_JSON_FILE, 'utf8');
        this.jsonData = JSON.parse(raw);
      } catch (err) {
        this.jsonData = {};
      }
    } else {
      this.jsonData = {};
    }
  }

  saveJsonFallback() {
    try {
      fs.writeFileSync(DB_JSON_FILE, JSON.stringify(this.jsonData, null, 2), 'utf8');
    } catch (err) {
      console.error('Erro ao salvar fallback JSON:', err);
    }
  }

  // =========================================================================
  // MÉTODOS RELACIONAIS CONFORME A SPEC (SQLITE NATIVO)
  // =========================================================================

  // Views da Seção 4
  getChamadosAbertosTempoReal() {
    if (!this.sqlite) return { total_abertos_tempo_real: 2 };
    const row = this.sqlite.prepare('SELECT * FROM vw_chamados_abertos_tempo_real;').get();
    return row || { total_abertos_tempo_real: 0 };
  }

  getChamadosResolvidosCount() {
    if (!this.sqlite) return { total_resolvidos: 1 };
    const row = this.sqlite.prepare('SELECT * FROM vw_chamados_resolvidos_count;').get();
    return row || { total_resolvidos: 0 };
  }

  getNotaMediaTecnicos() {
    if (!this.sqlite) return [];
    return this.sqlite.prepare('SELECT * FROM vw_nota_media_tecnico;').all();
  }

  getNotaMediaAlunos() {
    if (!this.sqlite) return [];
    return this.sqlite.prepare('SELECT * FROM vw_nota_media_aluno;').all();
  }

  getUsuariosPorRole() {
    if (!this.sqlite) return [];
    return this.sqlite.prepare('SELECT * FROM vw_usuarios_por_role;').all();
  }

  getLogsAdmin() {
    if (!this.sqlite) return [];
    return this.sqlite.prepare(`
      SELECT l.id, l.admin_id, u_adm.nome_completo AS admin_nome,
             l.usuario_alvo_id, u_alvo.nome_completo AS usuario_alvo_nome,
             l.acao, l.criado_em
      FROM logs_admin l
      JOIN usuarios u_adm ON l.admin_id = u_adm.id
      JOIN usuarios u_alvo ON l.usuario_alvo_id = u_alvo.id
      ORDER BY l.criado_em DESC;
    `).all();
  }

  // Ações Administrativas da Seção 5
  criarUsuario({ adminId, nomeCompleto, cpf, email, senhaHash, role, extra = {} }) {
    if (!this.sqlite) throw new Error('SQLite offline');

    const id = 'usr-' + Date.now();
    const now = new Date().toISOString();
    const faculdadeId = 'fac-1';

    // 1. Insert in usuarios
    const stmtUser = this.sqlite.prepare(`
      INSERT INTO usuarios (id, nome_completo, cpf, email, senha_hash, role, faculdade_id, ativo, token_version, criado_por, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?);
    `);
    stmtUser.run(id, nomeCompleto, cpf, email, senhaHash || '$2b$10$defaultHashGeneratedPass', role, faculdadeId, adminId || null, now);

    // 2. Insert in role specific table
    if (role === 'aluno') {
      this.sqlite.prepare(`
        INSERT INTO alunos (usuario_id, matricula, curso) VALUES (?, ?, ?);
      `).run(id, extra.matricula || '2026' + Math.floor(Math.random() * 8999 + 1000), extra.curso || 'Graduação');
    } else if (role === 'tecnico') {
      this.sqlite.prepare(`
        INSERT INTO tecnicos (usuario_id, especialidade, nota_media) VALUES (?, ?, 0.00);
      `).run(id, extra.especialidade || 'Suporte Geral');
    } else if (role === 'admin_faculdade') {
      this.sqlite.prepare(`
        INSERT INTO admins_faculdade (usuario_id, cargo) VALUES (?, ?);
      `).run(id, extra.cargo || 'Diretor de T.I.');
    }

    // 3. Log in logs_admin
    if (adminId) {
      const logId = 'log-' + Date.now();
      this.sqlite.prepare(`
        INSERT INTO logs_admin (id, admin_id, usuario_alvo_id, acao, criado_em)
        VALUES (?, ?, ?, 'criar_usuario', ?);
      `).run(logId, adminId, id, now);
    }

    return { id, nomeCompleto, cpf, email, role };
  }

  redefinirSenha({ adminId, usuarioId, novoHash }) {
    if (!this.sqlite) throw new Error('SQLite offline');

    const hash = novoHash || '$2b$10$newResetBcryptHashExample9876543210';
    const now = new Date().toISOString();

    // Increment token_version as recommended in Spec 5.2
    this.sqlite.prepare(`
      UPDATE usuarios 
      SET senha_hash = ?, token_version = token_version + 1, atualizado_em = ?
      WHERE id = ?;
    `).run(hash, now, usuarioId);

    // Register log
    if (adminId) {
      const logId = 'log-' + Date.now();
      this.sqlite.prepare(`
        INSERT INTO logs_admin (id, admin_id, usuario_alvo_id, acao, criado_em)
        VALUES (?, ?, ?, 'redefinir_senha', ?);
      `).run(logId, adminId, usuarioId, now);
    }

    return { success: true, usuarioId, message: 'Senha redefinida e token_version incrementado.' };
  }

  inativarUsuario({ adminId, usuarioId }) {
    if (!this.sqlite) throw new Error('SQLite offline');

    const now = new Date().toISOString();

    this.sqlite.prepare(`
      UPDATE usuarios 
      SET ativo = 0, inativado_em = ?, inativado_por = ?
      WHERE id = ?;
    `).run(now, adminId || null, usuarioId);

    if (adminId) {
      const logId = 'log-' + Date.now();
      this.sqlite.prepare(`
        INSERT INTO logs_admin (id, admin_id, usuario_alvo_id, acao, criado_em)
        VALUES (?, ?, ?, 'inativar_usuario', ?);
      `).run(logId, adminId, usuarioId, now);
    }

    return { success: true, usuarioId, message: 'Usuário inativado com sucesso.' };
  }

  // Avaliações das Seções 3.3 e 3.4
  avaliarTecnico({ chamadoId, alunoId, tecnicoId, nota, comentario }) {
    if (!this.sqlite) throw new Error('SQLite offline');

    const id = 'avt-' + Date.now();
    const now = new Date().toISOString();

    this.sqlite.prepare(`
      INSERT INTO avaliacoes_tecnico (id, chamado_id, aluno_id, tecnico_id, nota, comentario, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).run(id, chamadoId, alunoId, tecnicoId, nota, comentario || '', now);

    return { id, chamadoId, nota, comentario };
  }

  avaliarAluno({ chamadoId, tecnicoId, alunoId, nota, comentario }) {
    if (!this.sqlite) throw new Error('SQLite offline');

    const id = 'ava-' + Date.now();
    const now = new Date().toISOString();

    this.sqlite.prepare(`
      INSERT INTO avaliacoes_aluno (id, chamado_id, tecnico_id, aluno_id, nota, comentario, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).run(id, chamadoId, tecnicoId, alunoId, nota, comentario || '', now);

    return { id, chamadoId, nota, comentario };
  }

  // =========================================================================
  // MÉTODOS DE SUPORTE À APLICAÇÃO WEB
  // =========================================================================

  getConfig() {
    return this.jsonData.institution || {
      id: "inst-1",
      name: "Universidade Metropolitana de Inovação - UMI",
      tagline: "Central de Atendimento ao Aluno & Suporte Integrado",
      primaryColor: "#1d4ed8",
      secondaryColor: "#0284c7",
      accentColor: "#f59e0b",
      logoUrl: "/assets/LOGO_UD.png",
      aiProvider: "local_heuristic",
      aiApiKey: "",
      aiModel: "claude-3-5-sonnet",
      aiCustomInstructions: "Você é a Sophia, assistente virtual inteligente da UMI.",
      licenseKey: "UNI-HOSTED-2026-BR-ACTIVE",
      version: "1.0.0"
    };
  }

  updateConfig(newConfig) {
    this.jsonData.institution = { ...this.getConfig(), ...newConfig };
    this.saveJsonFallback();
    return this.jsonData.institution;
  }

  getUsers(role = null) {
    if (this.sqlite) {
      let query = 'SELECT * FROM vw_usuarios_por_role';
      if (role) {
        query += ` WHERE role = '${role}'`;
      }
      const rows = this.sqlite.prepare(query).all();
      return rows.map(r => ({
        id: r.id,
        name: r.nome_completo,
        email: r.email,
        cpf: r.cpf,
        role: r.role,
        ativo: !!r.ativo,
        department: r.especialidade || r.cargo_admin_faculdade || 'Graduação',
        ra: r.matricula,
        course: r.curso,
        avatar: r.role === 'aluno'
          ? "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80"
          : r.role === 'tecnico'
          ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80"
          : "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80"
      }));
    }
    return this.jsonData.users || [];
  }

  addUser(userData) {
    if (!this.jsonData.users) this.jsonData.users = [];
    const id = userData.id || ((userData.role === 'student' || userData.role === 'aluno') ? 'usr-stu-' : 'usr-') + Date.now();
    const newUser = {
      id,
      name: userData.name,
      email: userData.email,
      cpf: userData.cpf || null,
      course: userData.course || null,
      period: userData.period || null,
      phone: userData.phone || null,
      role: userData.role || 'student',
      department: userData.department || 'Geral',
      ra: userData.ra || '2026' + Math.floor(1000 + Math.random() * 9000),
      avatar: userData.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80",
      createdAt: new Date().toISOString()
    };

    this.jsonData.users.push(newUser);
    this.saveJsonFallback();

    // Mirror to SQLite if available
    if (this.sqlite) {
      try {
        const role = (newUser.role === 'student' || newUser.role === 'aluno') ? 'aluno' : newUser.role;
        this.sqlite.prepare(`
          INSERT INTO usuarios (id, nome_completo, email, cpf, role, ativo, criado_em)
          VALUES (?, ?, ?, ?, ?, 1, datetime('now'));
        `).run(newUser.id, newUser.name, newUser.email, newUser.cpf, role);

        if (role === 'aluno') {
          this.sqlite.prepare(`
            INSERT INTO alunos (usuario_id, matricula, curso, data_ingresso)
            VALUES (?, ?, ?, date('now'));
          `).run(newUser.id, newUser.ra, newUser.course ? `${newUser.course} (${newUser.period || '1º Período'})` : 'Graduação');
        }
      } catch (err) {
        console.error('Aviso ao espelhar usuário no SQLite:', err.message);
      }
    }

    return newUser;
  }

  getUserById(id) {
    const users = this.getUsers();
    return users.find(u => u.id === id);
  }

  getCategories() {
    return this.jsonData.categories || [
      { id: "cat-1", name: "Secretaria Acadêmica", slaHours: 24, defaultPriority: "medium" },
      { id: "cat-2", name: "Financeiro & Bolsas (FIES/Prouni)", slaHours: 12, defaultPriority: "high" },
      { id: "cat-3", name: "Suporte AVA & TI (Moodle/Portal)", slaHours: 6, defaultPriority: "high" }
    ];
  }

  getTickets(filters = {}) {
    return this.jsonData.tickets || [];
  }

  getTicketById(id) {
    const tickets = this.getTickets();
    return tickets.find(t => t.id === id || String(t.ticketNumber) === String(id));
  }

  createTicket(params) {
    if (!this.jsonData.tickets) this.jsonData.tickets = [];
    const ticketNumber = 1000 + this.jsonData.tickets.length + 1;
    const now = new Date();
    const newTicket = {
      id: "tkt-" + ticketNumber,
      ticketNumber,
      studentId: params.studentId,
      attendantId: "usr-tec-1",
      categoryId: params.categoryId,
      subject: params.subject,
      description: params.description,
      status: "open",
      priority: params.priority || "medium",
      origin: params.origin || "portal",
      slaDueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      firstResponseAt: null,
      resolvedAt: null,
      csatScore: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [
        {
          id: "msg-" + Date.now(),
          senderId: params.studentId,
          senderName: "Aluno",
          senderRole: "student",
          message: params.description,
          isInternalNote: false,
          attachments: params.attachments || [],
          createdAt: now.toISOString()
        }
      ]
    };
    this.jsonData.tickets.unshift(newTicket);
    this.saveJsonFallback();

    // Also mirror to SQLite if available
    if (this.sqlite) {
      try {
        this.sqlite.prepare(`
          INSERT INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em)
          VALUES (?, ?, NULL, ?, ?, 'aberto', ?, ?);
        `).run(newTicket.id, params.studentId, params.subject, params.description, params.categoryId, now.toISOString());
      } catch (err) {}
    }

    return newTicket;
  }

  addTicketMessage(ticketId, { senderId, message, isInternalNote, attachments }) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return null;

    const sender = this.getUserById(senderId) || { name: "Usuário", role: "student" };
    const now = new Date();

    const newMsg = {
      id: "msg-" + Date.now(),
      senderId,
      senderName: sender.name,
      senderRole: sender.role,
      message,
      isInternalNote: !!isInternalNote,
      attachments: attachments || [],
      createdAt: now.toISOString()
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = now.toISOString();

    if (sender.role === 'tecnico' && !ticket.firstResponseAt) {
      ticket.firstResponseAt = now.toISOString();
      if (ticket.status === 'open') ticket.status = 'in_progress';
    }

    this.saveJsonFallback();
    return newMsg;
  }

  updateTicketStatus(ticketId, status, csatScore) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return null;

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    if (status === 'resolved' || status === 'finalizado') {
      ticket.resolvedAt = new Date().toISOString();
    }
    if (csatScore) {
      ticket.csatScore = csatScore;
    }
    this.saveJsonFallback();
    return ticket;
  }

  getChatSessions() {
    return this.jsonData.chatSessions || [];
  }

  getChatSession(id) {
    return (this.jsonData.chatSessions || []).find(s => s.id === id);
  }

  createChatSession(studentId, department) {
    if (!this.jsonData.chatSessions) this.jsonData.chatSessions = [];
    const newSession = {
      id: "chat-sess-" + Date.now(),
      studentId,
      studentName: "Aluno",
      department: department || "Geral",
      status: "bot",
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: "cmsg-" + Date.now(),
          sender: "bot",
          senderName: "Sophia (IA UMI)",
          text: "Olá! Como posso ajudar você hoje?",
          timestamp: new Date().toISOString()
        }
      ]
    };
    this.jsonData.chatSessions.unshift(newSession);
    this.saveJsonFallback();
    return newSession;
  }

  addChatMessage(sessionId, { sender, senderName, text }) {
    const session = this.getChatSession(sessionId);
    if (!session) return null;

    const msg = {
      id: "cmsg-" + Date.now(),
      sender,
      senderName,
      text,
      timestamp: new Date().toISOString()
    };
    session.messages.push(msg);
    this.saveJsonFallback();
    return msg;
  }

  escalateChatSession(sessionId, department) {
    const session = this.getChatSession(sessionId);
    if (!session) return null;
    session.status = "waiting_agent";
    session.department = department || session.department;
    this.saveJsonFallback();
    return session;
  }

  getKnowledgeBase(query = null, categoryId = null) {
    return this.jsonData.knowledgeBase || [];
  }

  getAIStudentContext(studentId) {
    return (this.jsonData.aiStudentContexts || {})[studentId] || null;
  }

  setAIStudentContext(studentId, context) {
    if (!this.jsonData.aiStudentContexts) this.jsonData.aiStudentContexts = {};
    this.jsonData.aiStudentContexts[studentId] = context;
    this.saveJsonFallback();
    return context;
  }

  getMetrics() {
    const abertos = this.getChamadosAbertosTempoReal().total_abertos_tempo_real;
    const resolvidos = this.getChamadosResolvidosCount().total_resolvidos;
    const tecnicosComNota = this.getNotaMediaTecnicos();
    const mediaGeralTecnicos = tecnicosComNota.length > 0 
      ? (tecnicosComNota.reduce((acc, t) => acc + (t.nota_media || 0), 0) / tecnicosComNota.length).toFixed(1)
      : "4.9";

    return {
      totalTickets: abertos + resolvidos,
      openTickets: abertos,
      inProgressTickets: 1,
      resolvedTickets: resolvidos,
      slaCompliancePercent: 100,
      averageCsat: mediaGeralTecnicos,
      averageFirstResponseHours: 1.5,
      byCategory: {
        "Secretaria Acadêmica": 1,
        "Financeiro & Bolsas": 1,
        "Suporte AVA & TI": 1
      }
    };
  }
}

export const db = new Database();
