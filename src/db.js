import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, verifyPassword, generateSessionToken, INSTANCE_SECRET } from './middleware/auth.js';

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
    this.initPasswordHashes();
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

  initPasswordHashes() {
    const defaultPassword = '123456';
    const defaultHash = hashPassword(defaultPassword);

    // 1. Sincroniza senhas padrão criptografadas no SQLite
    if (this.sqlite) {
      try {
        const users = this.sqlite.prepare('SELECT id, email, senha_hash FROM usuarios').all();
        const updateStmt = this.sqlite.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?');
        for (const u of users) {
          if (!u.senha_hash || u.senha_hash.startsWith('$2b$10$abcdef') || !u.senha_hash.startsWith('scrypt:')) {
            updateStmt.run(defaultHash, u.id);
          }
        }
      } catch (err) {
        console.warn('Aviso ao sincronizar hashes de senha no SQLite:', err.message);
      }
    }

    // 2. Sincroniza senhas padrão criptografadas no fallback JSON
    if (Array.isArray(this.jsonData?.users)) {
      let changed = false;
      for (const u of this.jsonData.users) {
        if (!u.senhaHash || !u.senhaHash.startsWith('scrypt:')) {
          u.senhaHash = defaultHash;
          changed = true;
        }
      }
      if (changed) {
        this.saveJsonFallback();
      }
    }
  }

  getUserPasswordHash(userId) {
    if (this.sqlite) {
      try {
        const row = this.sqlite.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(userId);
        if (row && row.senha_hash) return row.senha_hash;
      } catch (err) {
        console.warn('Erro ao consultar senha_hash no SQLite:', err.message);
      }
    }
    const jsonUser = (this.jsonData.users || []).find(u => u.id === userId);
    return jsonUser?.senhaHash || jsonUser?.senha_hash || null;
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
    const finalHash = senhaHash || (extra.senha ? hashPassword(extra.senha) : hashPassword('123456'));

    // 1. Insert in usuarios
    const stmtUser = this.sqlite.prepare(`
      INSERT INTO usuarios (id, nome_completo, cpf, email, senha_hash, role, faculdade_id, ativo, token_version, criado_por, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?);
    `);
    stmtUser.run(id, nomeCompleto, cpf, email, finalHash, role, faculdadeId, adminId || null, now);

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

  redefinirSenha({ adminId, usuarioId, novoHash, novaSenha }) {
    if (!this.sqlite) throw new Error('SQLite offline');

    const hash = novoHash || (novaSenha ? hashPassword(novaSenha) : hashPassword('123456'));
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
      try {
        let query = 'SELECT * FROM vw_usuarios_por_role';
        const params = [];
        if (role) {
          query += ' WHERE role = ?';
          params.push(role);
        }
        const rows = this.sqlite.prepare(query).all(...params);
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
      } catch (err) {
        console.warn('Fallback para usuarios JSON devido a erro SQLite:', err.message);
      }
    }
    const users = this.jsonData.users || [];
    if (role) {
      return users.filter(u => u.role === role || (role === 'aluno' && u.role === 'student'));
    }
    return users;
  }

  addUser(userData) {
    if (!this.jsonData.users) this.jsonData.users = [];
    const id = userData.id || ((userData.role === 'student' || userData.role === 'aluno') ? 'usr-stu-' : 'usr-') + Date.now();
    const finalHash = userData.senhaHash || (userData.senha ? hashPassword(userData.senha) : hashPassword('123456'));
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
      senhaHash: finalHash,
      createdAt: new Date().toISOString()
    };

    this.jsonData.users.push(newUser);
    this.saveJsonFallback();

    // Mirror to SQLite if available
    if (this.sqlite) {
      try {
        const role = (newUser.role === 'student' || newUser.role === 'aluno') ? 'aluno' : newUser.role;
        this.sqlite.prepare(`
          INSERT INTO usuarios (id, nome_completo, email, cpf, senha_hash, role, ativo, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'));
        `).run(newUser.id, newUser.name, newUser.email, newUser.cpf, finalHash, role);

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
    let found = users.find(u => u.id === id);
    if (!found) {
      if (id === 'usr-admin') {
        found = users.find(u => u.id === 'usr-adm-fac');
      } else if (id === 'usr-adm-fac') {
        found = users.find(u => u.id === 'usr-admin');
      }
    }
    return found || null;
  }

  findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    let found = users.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
    if (!found) {
      if (cleanEmail === 'admin@metropolitana.edu.br') {
        found = users.find(u => u.id === 'usr-adm-fac' || u.id === 'usr-admin' || (u.email && u.email.toLowerCase() === 'roberto.ti@metropolitana.edu.br'));
      } else if (cleanEmail === 'roberto.ti@metropolitana.edu.br') {
        found = users.find(u => u.id === 'usr-adm-fac' || u.id === 'usr-admin');
      }
    }
    return found || null;
  }

  authenticate(email, password, expectedRole = null) {
    if (!email) {
      const err = new Error('O e-mail é obrigatório para autenticação.');
      err.statusCode = 400;
      throw err;
    }

    if (!password) {
      const err = new Error('A senha é obrigatória para autenticação.');
      err.statusCode = 401;
      throw err;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = this.findUserByEmail(cleanEmail);

    if (!user) {
      const err = new Error(`O e-mail institucional "${cleanEmail}" não foi encontrado no sistema.`);
      err.statusCode = 401;
      throw err;
    }

    if (user.ativo === false) {
      const err = new Error('Acesso suspenso ou inativado. Entre em contato com a secretaria acadêmica.');
      err.statusCode = 401;
      throw err;
    }

    // Validação estrita da senha contra o hash Scrypt/PBKDF2 gravado
    const storedHash = this.getUserPasswordHash(user.id);
    const isPasswordValid = verifyPassword(password, storedHash);

    if (!isPasswordValid) {
      const err = new Error('Credenciais inválidas. Verifique sua senha institucional.');
      err.statusCode = 401;
      throw err;
    }

    // Verificação de papel se requisitado
    if (expectedRole) {
      const isStudentRole = expectedRole === 'student' || expectedRole === 'aluno';
      const isAttendantRole = expectedRole === 'attendant' || expectedRole === 'tecnico';
      const isAdminRole = expectedRole === 'admin' || expectedRole === 'admin_faculdade' || expectedRole === 'admin_software';

      const userIsStudent = user.role === 'student' || user.role === 'aluno';
      const userIsAttendant = user.role === 'attendant' || user.role === 'tecnico' || user.role === 'admin' || user.role === 'admin_faculdade' || user.role === 'admin_software';
      const userIsAdmin = user.role === 'admin' || user.role === 'admin_faculdade' || user.role === 'admin_software';

      if (isStudentRole && !userIsStudent) {
        const err = new Error('Este e-mail pertence a um atendente ou administrador.');
        err.statusCode = 401;
        throw err;
      }
      if (isAttendantRole && !userIsAttendant) {
        const err = new Error('Este e-mail pertence a um aluno.');
        err.statusCode = 401;
        throw err;
      }
      if (isAdminRole && !userIsAdmin) {
        const err = new Error('Acesso restrito exclusivamente a administradores institucionais.');
        err.statusCode = 401;
        throw err;
      }
    }

    // Geração de token de sessão criptográfico seguro HMAC-SHA256
    const token = generateSessionToken(user, INSTANCE_SECRET);
    return {
      user,
      token
    };
  }

  getCategories() {
    return this.jsonData.categories || [
      { id: "cat-1", name: "Secretaria Acadêmica", slaHours: 24, defaultPriority: "medium" },
      { id: "cat-2", name: "Financeiro & Bolsas (FIES/Prouni)", slaHours: 12, defaultPriority: "high" },
      { id: "cat-3", name: "Suporte AVA & TI (Moodle/Portal)", slaHours: 6, defaultPriority: "high" }
    ];
  }

  getTickets(filters = {}) {
    let tickets = this.jsonData.tickets || [];
    if (filters.studentId) {
      tickets = tickets.filter(t => t.studentId === filters.studentId);
    }
    if (filters.attendantId) {
      tickets = tickets.filter(t => t.attendantId === filters.attendantId);
    }
    if (filters.status && filters.status !== 'all') {
      const s = filters.status.toLowerCase();
      tickets = tickets.filter(t => {
        const ts = (t.status || '').toLowerCase();
        if (s === 'open' || s === 'aberto') return ts === 'open' || ts === 'aberto';
        if (s === 'in_progress' || s === 'em_atendimento') return ts === 'in_progress' || ts === 'em_atendimento';
        if (s === 'resolved' || s === 'finalizado') return ts === 'resolved' || ts === 'finalizado';
        return ts === s;
      });
    }
    if (filters.categoryId) {
      tickets = tickets.filter(t => t.categoryId === filters.categoryId);
    }
    return tickets;
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
    let items = this.jsonData.knowledgeBase || [];
    if (categoryId) {
      items = items.filter(item => item.categoryId === categoryId);
    }
    if (query && typeof query === 'string' && query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter(item =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.content && item.content.toLowerCase().includes(q)) ||
        (Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    return items;
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
