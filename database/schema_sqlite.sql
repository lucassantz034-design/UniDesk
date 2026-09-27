-- ============================================================================
-- SPEC DE BANCO DE DADOS — HELPDESK UNIVERSITÁRIO (POR PERFIL DE USUÁRIO)
-- Dialeto: SQLite (Instâncias Locais / Plug-and-Play)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Tabela de Faculdades
CREATE TABLE IF NOT EXISTS faculdades (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    sigla TEXT,
    cnpj TEXT UNIQUE,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now')),
    atualizado_em TEXT DEFAULT (datetime('now'))
);

-- 2. Tabela Central de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('aluno', 'tecnico', 'admin_faculdade', 'admin_software')),
    faculdade_id TEXT NULL REFERENCES faculdades(id) ON DELETE SET NULL,
    ativo INTEGER DEFAULT 1,
    token_version INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now')),
    atualizado_em TEXT DEFAULT (datetime('now')),
    criado_por TEXT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    inativado_em TEXT NULL,
    inativado_por TEXT NULL REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 3. Tabelas Específicas por Papel (1:1 com usuarios)
CREATE TABLE IF NOT EXISTS alunos (
    usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    matricula TEXT,
    curso TEXT
);

CREATE TABLE IF NOT EXISTS tecnicos (
    usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    especialidade TEXT,
    nota_media REAL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS admins_faculdade (
    usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    cargo TEXT DEFAULT 'Diretor de T.I.'
);

CREATE TABLE IF NOT EXISTS admins_software (
    usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 4. Tabela de Chamados (Tickets)
CREATE TABLE IF NOT EXISTS chamados (
    id TEXT PRIMARY KEY,
    aluno_id TEXT NOT NULL REFERENCES alunos(usuario_id) ON DELETE RESTRICT,
    tecnico_id TEXT NULL REFERENCES tecnicos(usuario_id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'finalizado', 'cancelado')),
    categoria TEXT,
    criado_em TEXT DEFAULT (datetime('now')),
    aceito_em TEXT NULL,
    finalizado_em TEXT NULL
);

-- 5. Tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS mensagens_chat (
    id TEXT PRIMARY KEY,
    chamado_id TEXT NULL REFERENCES chamados(id) ON DELETE CASCADE,
    remetente_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    remetente_role TEXT NOT NULL CHECK (remetente_role IN ('aluno', 'tecnico', 'admin_faculdade', 'admin_software', 'bot')),
    mensagem TEXT NOT NULL,
    enviado_em TEXT DEFAULT (datetime('now'))
);

-- 6. Tabelas de Avaliações
CREATE TABLE IF NOT EXISTS avaliacoes_tecnico (
    id TEXT PRIMARY KEY,
    chamado_id TEXT NOT NULL UNIQUE REFERENCES chamados(id) ON DELETE CASCADE,
    aluno_id TEXT NOT NULL REFERENCES alunos(usuario_id) ON DELETE CASCADE,
    tecnico_id TEXT NOT NULL REFERENCES tecnicos(usuario_id) ON DELETE CASCADE,
    nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS avaliacoes_aluno (
    id TEXT PRIMARY KEY,
    chamado_id TEXT NOT NULL UNIQUE REFERENCES chamados(id) ON DELETE CASCADE,
    tecnico_id TEXT NOT NULL REFERENCES tecnicos(usuario_id) ON DELETE CASCADE,
    aluno_id TEXT NOT NULL REFERENCES alunos(usuario_id) ON DELETE CASCADE,
    nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);

-- 7. Tabela de Auditoria Administrativa
CREATE TABLE IF NOT EXISTS logs_admin (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_alvo_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    acao TEXT NOT NULL CHECK (acao IN ('criar_usuario', 'redefinir_senha', 'inativar_usuario', 'reativar_usuario')),
    criado_em TEXT DEFAULT (datetime('now'))
);

-- 8. Índices
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_tecnico ON chamados(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_chamados_aluno ON chamados(aluno_id);
CREATE INDEX IF NOT EXISTS idx_chamados_criado ON chamados(criado_em);

CREATE INDEX IF NOT EXISTS idx_mensagens_chamado ON mensagens_chat(chamado_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON mensagens_chat(remetente_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);

CREATE INDEX IF NOT EXISTS idx_logs_admin_alvo ON logs_admin(usuario_alvo_id);

-- 9. Views
DROP VIEW IF EXISTS vw_chamados_resolvidos_count;
CREATE VIEW vw_chamados_resolvidos_count AS
SELECT COUNT(*) AS total_resolvidos
FROM chamados
WHERE status = 'finalizado';

DROP VIEW IF EXISTS vw_chamados_abertos_tempo_real;
CREATE VIEW vw_chamados_abertos_tempo_real AS
SELECT COUNT(*) AS total_abertos_tempo_real
FROM chamados
WHERE status IN ('aberto', 'em_atendimento');

DROP VIEW IF EXISTS vw_nota_media_tecnico;
CREATE VIEW vw_nota_media_tecnico AS
SELECT 
    t.usuario_id AS tecnico_id,
    u.nome_completo AS nome_tecnico,
    t.especialidade,
    COUNT(at.id) AS total_avaliacoes,
    ROUND(COALESCE(AVG(at.nota), 0), 2) AS nota_media
FROM tecnicos t
JOIN usuarios u ON t.usuario_id = u.id
LEFT JOIN avaliacoes_tecnico at ON t.usuario_id = at.tecnico_id
GROUP BY t.usuario_id;

DROP VIEW IF EXISTS vw_nota_media_aluno;
CREATE VIEW vw_nota_media_aluno AS
SELECT 
    a.usuario_id AS aluno_id,
    u.nome_completo AS nome_aluno,
    a.matricula,
    a.curso,
    COUNT(aa.id) AS total_avaliacoes,
    ROUND(COALESCE(AVG(aa.nota), 0), 2) AS nota_media
FROM alunos a
JOIN usuarios u ON a.usuario_id = u.id
LEFT JOIN avaliacoes_aluno aa ON a.usuario_id = aa.aluno_id
GROUP BY a.usuario_id;

DROP VIEW IF EXISTS vw_usuarios_por_role;
CREATE VIEW vw_usuarios_por_role AS
SELECT 
    u.id,
    u.nome_completo,
    u.cpf,
    u.email,
    u.role,
    u.ativo,
    u.faculdade_id,
    u.criado_em,
    u.inativado_em,
    a.matricula,
    a.curso,
    t.especialidade,
    t.nota_media,
    af.cargo AS cargo_admin_faculdade
FROM usuarios u
LEFT JOIN alunos a ON u.id = a.usuario_id
LEFT JOIN tecnicos t ON u.id = t.usuario_id
LEFT JOIN admins_faculdade af ON u.id = af.usuario_id;

-- 10. Triggers para recalcular nota_media do técnico automaticamente
DROP TRIGGER IF EXISTS trg_atualiza_nota_media_tecnico_insert;
CREATE TRIGGER trg_atualiza_nota_media_tecnico_insert AFTER INSERT ON avaliacoes_tecnico
BEGIN
    UPDATE tecnicos
    SET nota_media = (
        SELECT ROUND(AVG(nota), 2)
        FROM avaliacoes_tecnico
        WHERE tecnico_id = NEW.tecnico_id
    )
    WHERE usuario_id = NEW.tecnico_id;
END;
