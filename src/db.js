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
const ARCHIVE_JSON_FILE = path.join(DATA_DIR, 'chats_archive.json');

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
    this.compactExistingFinalizedChats();
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

  loadArchiveData() {
    if (fs.existsSync(ARCHIVE_JSON_FILE)) {
      try {
        const raw = fs.readFileSync(ARCHIVE_JSON_FILE, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        return { tickets: {}, chatSessions: {} };
      }
    }
    return { tickets: {}, chatSessions: {} };
  }

  saveToArchive(type, id, data) {
    try {
      const archive = this.loadArchiveData();
      if (!archive[type]) archive[type] = {};
      archive[type][id] = {
        ...data,
        archivedAt: new Date().toISOString()
      };
      fs.writeFileSync(ARCHIVE_JSON_FILE, JSON.stringify(archive, null, 2), 'utf8');
    } catch (err) {
      console.warn('Aviso ao gravar arquivo de histórico:', err.message);
    }
  }

  getFromArchive(type, id) {
    try {
      const archive = this.loadArchiveData();
      return archive[type]?.[id] || null;
    } catch (err) {
      return null;
    }
  }

  compactExistingFinalizedChats() {
    let changed = false;
    // 1. Compacta chamados finalizados/resolvidos existentes em memória
    if (Array.isArray(this.jsonData?.tickets)) {
      for (const t of this.jsonData.tickets) {
        const isFin = t.status === 'resolved' || t.status === 'finalizado' || t.status === 'closed';
        if (isFin && (!t.simpleRecord || !t.closed)) {
          const rawMsgs = Array.isArray(t.messages) ? t.messages : [];
          const count = rawMsgs.length;
          const closedAt = t.resolvedAt || t.updatedAt || new Date().toISOString();

          this.saveToArchive('tickets', t.id, {
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            studentId: t.studentId,
            attendantId: t.attendantId,
            closedAt,
            messages: rawMsgs
          });

          t.closed = true;
          t.closedAt = closedAt;
          t.simpleRecord = {
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            studentId: t.studentId,
            studentName: t.studentName || 'Aluno',
            attendantId: t.attendantId,
            attendantName: t.attendantName || 'Atendente',
            status: t.status,
            closed: true,
            closedAt,
            resolvedAt: t.resolvedAt || closedAt,
            totalMessages: count,
            summary: `Atendimento finalizado com ${count} mensagem(ns). Registro simplificado mantido em memória.`
          };
          t.messages = [
            {
              id: `msg-summary-${t.id}`,
              senderRole: 'system',
              senderName: 'Registro Simples',
              message: `Atendimento finalizado e fechado. Total de mensagens processadas: ${count}. Registro simples mantido em memória.`,
              createdAt: closedAt,
              isSimpleRecord: true
            }
          ];
          t.isCompact = true;
          changed = true;
        }
      }
    }

    // 2. Compacta sessões de chat com bot/atendente finalizadas existentes em memória
    if (Array.isArray(this.jsonData?.chatSessions)) {
      for (const s of this.jsonData.chatSessions) {
        const isFin = s.status === 'finalizado' || s.status === 'resolved' || s.status === 'closed';
        if (isFin && (!s.simpleRecord || !s.closed)) {
          const rawMsgs = Array.isArray(s.messages) ? s.messages : [];
          const count = rawMsgs.length;
          const closedAt = s.closedAt || new Date().toISOString();

          this.saveToArchive('chatSessions', s.id, {
            id: s.id,
            studentId: s.studentId,
            closedAt,
            messages: rawMsgs
          });

          s.closed = true;
          s.closedAt = closedAt;
          s.simpleRecord = {
            id: s.id,
            studentId: s.studentId,
            studentName: s.studentName,
            status: 'finalizado',
            closed: true,
            closedAt,
            totalMessages: count,
            summary: `Chat finalizado com ${count} mensagem(ns). Registro simples mantido em memória.`
          };
          s.messages = [
            {
              id: `cmsg-summary-${s.id}`,
              sender: 'system',
              senderName: 'Registro Simples',
              text: `Chat finalizado e fechado. Mantido registro simples em memória.`,
              timestamp: closedAt,
              isSimpleRecord: true
            }
          ];
          s.isCompact = true;
          changed = true;
        }
      }
    }

    if (changed) {
      this.saveJsonFallback();
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
    const id = 'avt-' + Date.now();
    const now = new Date().toISOString();
    const safeNota = Math.max(1, Math.min(5, Number(nota) || 5));

    const tecId = (tecnicoId || 'usr-tec-1').replace('usr-att-', 'usr-tec-');
    const aluId = (alunoId || 'usr-alu-1').replace('usr-stu-', 'usr-alu-');

    if (this.sqlite) {
      try {
        const chk = this.sqlite.prepare('SELECT id FROM chamados WHERE id = ?').get(chamadoId);
        if (!chk) {
          try {
            this.sqlite.prepare(`
              INSERT OR IGNORE INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em)
              VALUES (?, ?, ?, 'Atendimento Finalizado', 'Atendimento UniDesk', 'finalizado', 'Geral', ?)
            `).run(chamadoId, aluId, tecId, now);
          } catch (_) {}
        }

        this.sqlite.prepare(`
          INSERT INTO avaliacoes_tecnico (id, chamado_id, aluno_id, tecnico_id, nota, comentario, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chamado_id) DO UPDATE SET nota = excluded.nota, comentario = excluded.comentario;
        `).run(id, chamadoId, aluId, tecId, safeNota, comentario || '', now);
      } catch (err) {
        console.warn('Aviso ao registrar avaliacao_tecnico no SQLite:', err.message);
      }
    }

    if (!this.jsonData) {
      this.jsonData = {};
    }
    if (!Array.isArray(this.jsonData.ratings)) {
      this.jsonData.ratings = [];
    }

    const existingIdx = this.jsonData.ratings.findIndex(r => r.chamadoId === chamadoId);
    if (existingIdx >= 0) {
      this.jsonData.ratings[existingIdx] = {
        ...this.jsonData.ratings[existingIdx],
        nota: safeNota,
        comentario: comentario || '',
        atualizadoEm: now
      };
    } else {
      this.jsonData.ratings.push({ id, chamadoId, alunoId, tecnicoId, nota: safeNota, comentario: comentario || '', criadoEm: now });
    }

    // Sincroniza csatScore diretamente no objeto do chamado para exibição imediata
    const ticket = this.getTicketById(chamadoId);
    if (ticket) {
      ticket.csatScore = safeNota;
      ticket.ratingComment = comentario || '';
      ticket.ratedAt = now;
    }

    this.saveJsonFallback();

    return { id, chamadoId, nota: safeNota, comentario };
  }

  avaliarAluno({ chamadoId, tecnicoId, alunoId, nota, comentario }) {
    const id = 'ava-' + Date.now();
    const now = new Date().toISOString();
    const safeNota = Math.max(1, Math.min(5, Number(nota) || 5));

    const tecId = (tecnicoId || 'usr-tec-1').replace('usr-att-', 'usr-tec-');
    const aluId = (alunoId || 'usr-alu-1').replace('usr-stu-', 'usr-alu-');

    if (this.sqlite) {
      try {
        const chk = this.sqlite.prepare('SELECT id FROM chamados WHERE id = ?').get(chamadoId);
        if (!chk) {
          try {
            this.sqlite.prepare(`
              INSERT OR IGNORE INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em)
              VALUES (?, ?, ?, 'Atendimento Finalizado', 'Atendimento UniDesk', 'finalizado', 'Geral', ?)
            `).run(chamadoId, aluId, tecId, now);
          } catch (_) {}
        }

        this.sqlite.prepare(`
          INSERT INTO avaliacoes_aluno (id, chamado_id, tecnico_id, aluno_id, nota, comentario, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chamado_id) DO UPDATE SET nota = excluded.nota, comentario = excluded.comentario;
        `).run(id, chamadoId, tecId, aluId, safeNota, comentario || '', now);
      } catch (err) {
        console.warn('Aviso ao registrar avaliacao_aluno no SQLite:', err.message);
      }
    }

    if (!this.jsonData) {
      this.jsonData = {};
    }
    if (!Array.isArray(this.jsonData.studentRatings)) {
      this.jsonData.studentRatings = [];
    }

    const existingIdx = this.jsonData.studentRatings.findIndex(r => r.chamadoId === chamadoId);
    if (existingIdx >= 0) {
      this.jsonData.studentRatings[existingIdx] = {
        ...this.jsonData.studentRatings[existingIdx],
        nota: safeNota,
        comentario: comentario || '',
        atualizadoEm: now
      };
    } else {
      this.jsonData.studentRatings.push({ id, chamadoId, tecnicoId, alunoId, nota: safeNota, comentario: comentario || '', criadoEm: now });
    }

    this.saveJsonFallback();

    return { id, chamadoId, nota: safeNota, comentario };
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
          if (role === 'aluno' || role === 'student') {
            query += ' WHERE role IN (?, ?)';
            params.push('aluno', 'student');
          } else if (role === 'tecnico' || role === 'attendant') {
            query += ' WHERE role IN (?, ?)';
            params.push('tecnico', 'attendant');
          } else if (role === 'admin' || role === 'admin_faculdade' || role === 'admin_software') {
            query += ' WHERE role IN (?, ?, ?)';
            params.push('admin', 'admin_faculdade', 'admin_software');
          } else {
            query += ' WHERE role = ?';
            params.push(role);
          }
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
            ? (r.id === 'usr-alu-2' ? "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80" : r.id === 'usr-alu-3' ? "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80" : "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80")
            : r.role === 'tecnico'
            ? (r.id === 'usr-tec-3' ? "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80" : r.id === 'usr-tec-2' ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80")
            : (r.id === 'usr-adm-soft' ? "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80" : "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80")
        }));
      } catch (err) {
        console.warn('Fallback para usuarios JSON devido a erro SQLite:', err.message);
      }
    }
    const users = this.jsonData.users || [];
    if (role) {
      if (role === 'aluno' || role === 'student') {
        return users.filter(u => u.role === 'student' || u.role === 'aluno');
      }
      if (role === 'tecnico' || role === 'attendant') {
        return users.filter(u => u.role === 'attendant' || u.role === 'tecnico' || u.role === 'gestor' || u.role === 'gestor_setor');
      }
      if (role === 'admin' || role === 'admin_faculdade' || role === 'admin_software') {
        return users.filter(u => u.role === 'admin' || u.role === 'admin_faculdade' || u.role === 'admin_software');
      }
      return users.filter(u => u.role === role);
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
    if (!id) return null;
    const users = this.getUsers();
    let found = users.find(u => u.id === id);
    if (!found) {
      const aliasMap = {
        'usr-stu-1': 'usr-alu-1',
        'usr-stu-2': 'usr-alu-2',
        'usr-stu-3': 'usr-alu-3',
        'usr-alu-1': 'usr-stu-1',
        'usr-alu-2': 'usr-stu-2',
        'usr-alu-3': 'usr-stu-3',
        'usr-att-1': 'usr-tec-1',
        'usr-att-2': 'usr-tec-2',
        'usr-att-3': 'usr-tec-3',
        'usr-tec-1': 'usr-att-1',
        'usr-tec-2': 'usr-att-2',
        'usr-tec-3': 'usr-att-3',
        'usr-admin': 'usr-adm-fac',
        'usr-adm-fac': 'usr-admin'
      };
      const mappedId = aliasMap[id];
      if (mappedId) {
        found = users.find(u => u.id === mappedId);
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
      if (cleanEmail === 'admin@metropolitana.edu.br' || cleanEmail === 'roberto.ti@metropolitana.edu.br') {
        found = users.find(u => u.id === 'usr-adm-fac' || u.id === 'usr-admin' || (u.email && (u.email.toLowerCase() === 'roberto.ti@metropolitana.edu.br' || u.email.toLowerCase() === 'admin@metropolitana.edu.br')));
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
      { id: 'cat-ti', name: 'Suporte de T.I.', slaHours: 6, defaultPriority: 'medium', icon: 'laptop' }
    ];
  }

  getTickets(filters = {}) {
    let tickets = this.jsonData.tickets || [];
    if (filters.studentId) {
      const aliasMap = {
        'usr-stu-1': 'usr-alu-1',
        'usr-stu-2': 'usr-alu-2',
        'usr-stu-3': 'usr-alu-3',
        'usr-alu-1': 'usr-stu-1',
        'usr-alu-2': 'usr-stu-2',
        'usr-alu-3': 'usr-stu-3'
      };
      const altStudentId = aliasMap[filters.studentId];
      tickets = tickets.filter(t => t.studentId === filters.studentId || (altStudentId && t.studentId === altStudentId));
    }
    if (filters.attendantId) {
      const aliasMap = {
        'usr-att-1': 'usr-tec-1',
        'usr-att-2': 'usr-tec-2',
        'usr-att-3': 'usr-tec-3',
        'usr-tec-1': 'usr-att-1',
        'usr-tec-2': 'usr-att-2',
        'usr-tec-3': 'usr-att-3'
      };
      const altAttendantId = aliasMap[filters.attendantId];
      tickets = tickets.filter(t => t.attendantId === filters.attendantId || (altAttendantId && t.attendantId === altAttendantId));
    }
    if (filters.status && filters.status !== 'all') {
      const s = filters.status.toLowerCase();
      tickets = tickets.filter(t => {
        const ts = (t.status || '').toLowerCase();
        if (s === 'open' || s === 'aberto') return ts === 'open' || ts === 'aberto';
        if (s === 'in_progress' || s === 'em_atendimento') return ts === 'in_progress' || ts === 'em_atendimento';
        if (s === 'resolved' || s === 'finalizado' || s === 'closed' || s === 'fechado') {
          return ts === 'resolved' || ts === 'finalizado' || ts === 'closed' || t.closed === true;
        }
        return ts === s;
      });
    }
    if (filters.categoryId) {
      tickets = tickets.filter(t => t.categoryId === filters.categoryId);
    }
    return tickets;
  }

  getTicketById(id, { full = false } = {}) {
    const tickets = this.getTickets();
    const ticket = tickets.find(t => t.id === id || String(t.ticketNumber) === String(id));
    if (!ticket) return null;
    if (full && ticket.isCompact) {
      const archived = this.getFromArchive('tickets', ticket.id);
      if (archived && archived.messages) {
        return {
          ...ticket,
          messages: archived.messages
        };
      }
    }
    return ticket;
  }

  createTicket(params) {
    if (!this.jsonData.tickets) this.jsonData.tickets = [];
    const ticketNumber = 1000 + this.jsonData.tickets.length + 1;
    const now = new Date();
    const student = this.getUserById(params.studentId);
    const studentName = params.studentName || (student ? student.name : "Aluno");
    const studentRole = student ? student.role : "student";
    const resolvedStudentId = student ? student.id : params.studentId;

    const newTicket = {
      id: "tkt-" + ticketNumber,
      ticketNumber,
      studentId: resolvedStudentId,
      studentName: studentName,
      attendantId: params.attendantId || "usr-tec-1",
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
          senderId: resolvedStudentId,
          senderName: studentName,
          senderRole: studentRole,
          message: params.description,
          isInternalNote: false,
          attachments: params.attachments || [],
          createdAt: now.toISOString()
        }
      ]
    };
    this.jsonData.tickets.unshift(newTicket);
    this.saveJsonFallback();

    // Mirror to SQLite if available
    if (this.sqlite) {
      try {
        const aluId = (resolvedStudentId.startsWith('usr-stu-'))
          ? resolvedStudentId.replace('usr-stu-', 'usr-alu-')
          : resolvedStudentId;
        this.sqlite.prepare(`
          INSERT INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em)
          VALUES (?, ?, NULL, ?, ?, 'aberto', ?, ?);
        `).run(newTicket.id, aluId, params.subject, params.description, params.categoryId, now.toISOString());
      } catch (err) {
        console.warn('Aviso ao espelhar chamado no SQLite:', err.message);
      }
    }

    return newTicket;
  }

  addTicketMessage(ticketId, { senderId, senderName, senderRole, message, isInternalNote, attachments }) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return null;

    const sender = this.getUserById(senderId);
    const resolvedRole = sender ? sender.role : (senderRole || 'student');
    const isStudent = resolvedRole === 'student' || resolvedRole === 'aluno';
    let resolvedName = sender ? sender.name : senderName;
    if (!resolvedName || resolvedName === 'Aluno' || resolvedName === 'Usuário') {
      if (isStudent && ticket.studentName && ticket.studentName !== 'Aluno') {
        resolvedName = ticket.studentName;
      } else {
        resolvedName = isStudent ? 'Aluno' : 'Atendente';
      }
    }
    const now = new Date();

    const newMsg = {
      id: "msg-" + Date.now(),
      senderId: sender ? sender.id : senderId,
      senderName: resolvedName,
      senderRole: resolvedRole,
      message,
      isInternalNote: !!isInternalNote,
      attachments: attachments || [],
      createdAt: now.toISOString()
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = now.toISOString();

    if ((resolvedRole === 'tecnico' || resolvedRole === 'attendant') && !ticket.firstResponseAt) {
      ticket.firstResponseAt = now.toISOString();
      if (ticket.status === 'open' || ticket.status === 'aberto') ticket.status = 'in_progress';
    }

    this.saveJsonFallback();
    return newMsg;
  }

  updateTicketStatus(ticketId, status, csatScore) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return null;

    const isFinalizing = status === 'resolved' || status === 'finalizado' || status === 'closed';
    const nowIso = new Date().toISOString();

    ticket.status = status;
    ticket.updatedAt = nowIso;
    if (csatScore) {
      ticket.csatScore = csatScore;
    }

    if (isFinalizing) {
      ticket.resolvedAt = ticket.resolvedAt || nowIso;
      ticket.closed = true;
      ticket.closedAt = ticket.closedAt || nowIso;

      const rawMessages = Array.isArray(ticket.messages) ? ticket.messages : [];
      const totalMessages = rawMessages.length;
      const firstMsg = rawMessages[0]?.message || ticket.description || '';
      const lastMsg = rawMessages[totalMessages - 1]?.message || '';

      // Arquiva o histórico detalhado de mensagens em disco antes de descarregar a memória
      this.saveToArchive('tickets', ticket.id, {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        studentId: ticket.studentId,
        studentName: ticket.studentName,
        attendantId: ticket.attendantId,
        attendantName: ticket.attendantName,
        closedAt: ticket.closedAt,
        messages: rawMessages
      });

      // Registro simples mantido na memória do software
      ticket.simpleRecord = {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        studentId: ticket.studentId,
        studentName: ticket.studentName || 'Aluno',
        attendantId: ticket.attendantId,
        attendantName: ticket.attendantName || 'Atendente',
        status: ticket.status,
        closed: true,
        closedAt: ticket.closedAt,
        resolvedAt: ticket.resolvedAt,
        totalMessages,
        firstMessageSnippet: firstMsg.slice(0, 80),
        lastMessageSnippet: lastMsg.slice(0, 80),
        summary: `Atendimento finalizado com ${totalMessages} mensagem(ns). Histórico arquivado em disco e registro simples mantido em memória.`
      };

      // Compactação em memória: substitui o array pesado por uma entrada sintética leve
      ticket.messages = [
        {
          id: `msg-summary-${ticket.id}`,
          senderRole: 'system',
          senderName: 'Registro Simples',
          message: `Atendimento finalizado e fechado em ${new Date(ticket.closedAt).toLocaleString('pt-BR')}. Total de mensagens processadas: ${totalMessages}. Histórico arquivado em disco; mantido registro simples em memória para otimização de recursos.`,
          createdAt: ticket.closedAt,
          isSimpleRecord: true
        }
      ];

      ticket.isCompact = true;

      // Sincroniza fechamento com SQLite Relacional se ativo
      if (this.sqlite) {
        try {
          this.sqlite.prepare(`
            UPDATE chamados
            SET status = 'finalizado', finalizado_em = COALESCE(finalizado_em, ?)
            WHERE id = ?
          `).run(ticket.closedAt, ticket.id);
        } catch (err) {
          console.warn('Aviso ao sincronizar fechamento no SQLite:', err.message);
        }
      }
    }

    this.saveJsonFallback();
    return ticket;
  }

  getChatSessions() {
    return this.jsonData.chatSessions || [];
  }

  getChatSession(id, { full = false } = {}) {
    const session = (this.jsonData.chatSessions || []).find(s => s.id === id);
    if (!session) return null;
    if (full && session.isCompact) {
      const archived = this.getFromArchive('chatSessions', session.id);
      if (archived && archived.messages) {
        return {
          ...session,
          messages: archived.messages
        };
      }
    }
    return session;
  }

  closeChatSession(sessionId) {
    const session = this.getChatSession(sessionId);
    if (!session) return null;

    const rawMessages = Array.isArray(session.messages) ? session.messages : [];
    const totalMessages = rawMessages.length;
    const nowIso = new Date().toISOString();

    // Arquivar histórico detalhado em disco
    this.saveToArchive('chatSessions', session.id, {
      ...session,
      closedAt: nowIso,
      messages: rawMessages
    });

    session.status = 'finalizado';
    session.closed = true;
    session.closedAt = nowIso;
    session.simpleRecord = {
      id: session.id,
      studentId: session.studentId,
      studentName: session.studentName || 'Aluno',
      department: session.department || 'Geral',
      status: 'finalizado',
      closed: true,
      closedAt: nowIso,
      totalMessages,
      summary: `Chat finalizado com ${totalMessages} mensagem(ns). Histórico arquivado em disco e mantido registro simples em memória.`
    };

    // Compacta mensagens em memória para liberar RAM
    session.messages = [
      {
        id: `cmsg-summary-${session.id}`,
        sender: 'system',
        senderName: 'Registro Simples',
        text: `Chat finalizado e fechado em ${new Date(nowIso).toLocaleString('pt-BR')}. Total de mensagens: ${totalMessages}. Mantido registro simples em memória.`,
        timestamp: nowIso,
        isSimpleRecord: true
      }
    ];

    session.isCompact = true;
    this.saveJsonFallback();
    return session;
  }

  createChatSession(studentId, department, requestedStudentName = null) {
    if (!this.jsonData.chatSessions) this.jsonData.chatSessions = [];
    const student = this.getUserById(studentId);
    const studentName = requestedStudentName || (student ? student.name : "Aluno");
    const greetingName = studentName && studentName !== 'Aluno' ? `, ${studentName.split(' ')[0]}` : '';
    const newSession = {
      id: "chat-sess-" + Date.now(),
      studentId: student ? student.id : (studentId || "usr-alu-2"),
      studentName: studentName,
      department: department || "Geral",
      status: "bot",
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: "cmsg-" + Date.now(),
          sender: "bot",
          senderName: "Sophia (IA UMI)",
          text: `Olá${greetingName}! Como posso ajudar você hoje?`,
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

    let finalSenderName = senderName;
    const isStudent = sender === 'student' || sender === 'aluno';
    if (isStudent) {
      if (!finalSenderName || finalSenderName === 'Aluno' || finalSenderName === 'Você') {
        const student = this.getUserById(session.studentId);
        finalSenderName = (student && student.name) || (session.studentName && session.studentName !== 'Aluno' ? session.studentName : 'Aluno');
      }
      if (session.studentName === 'Aluno' && finalSenderName && finalSenderName !== 'Aluno') {
        session.studentName = finalSenderName;
      }
    }

    const msg = {
      id: "cmsg-" + Date.now(),
      sender,
      senderName: finalSenderName || (sender === 'bot' ? 'Sophia (IA UMI)' : (isStudent ? 'Aluno' : 'Atendente')),
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
        "Suporte de T.I.": abertos + resolvidos
      }
    };
  }
}

export const db = new Database();
