-- ============================================================================
-- SPEC DE BANCO DE DADOS — HELPDESK UNIVERSITÁRIO (POR PERFIL DE USUÁRIO)
-- Dialeto: PostgreSQL (Produção / Self-Hosted)
-- ============================================================================

-- 0. Extensões e Tipos ENUM
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('aluno', 'tecnico', 'admin_faculdade', 'admin_software');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chamado_status AS ENUM ('aberto', 'em_atendimento', 'finalizado', 'cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_remetente_role AS ENUM ('aluno', 'tecnico', 'admin_faculdade', 'admin_software', 'bot');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_action AS ENUM ('criar_usuario', 'redefinir_senha', 'inativar_usuario', 'reativar_usuario');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Tabela de Faculdades / Instituições
CREATE TABLE IF NOT EXISTS faculdades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    sigla VARCHAR(50),
    cnpj VARCHAR(18) UNIQUE,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela Central de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(60) NOT NULL,
    role user_role NOT NULL,
    faculdade_id UUID NULL REFERENCES faculdades(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT true,
    token_version INTEGER DEFAULT 1,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    criado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    inativado_em TIMESTAMP WITH TIME ZONE NULL,
    inativado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 3. Tabelas Específicas por Papel (1:1 com usuarios)
CREATE TABLE IF NOT EXISTS alunos (
    usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    matricula VARCHAR(50),
    curso VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS tecnicos (
    usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    especialidade VARCHAR(255),
    nota_media DECIMAL(3,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS admins_faculdade (
    usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    cargo VARCHAR(100) DEFAULT 'Diretor de T.I.'
);

CREATE TABLE IF NOT EXISTS admins_software (
    usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 4. Tabela de Chamados (Tickets)
CREATE TABLE IF NOT EXISTS chamados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id UUID NOT NULL REFERENCES alunos(usuario_id) ON DELETE RESTRICT,
    tecnico_id UUID NULL REFERENCES tecnicos(usuario_id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status chamado_status DEFAULT 'aberto',
    categoria VARCHAR(100),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    aceito_em TIMESTAMP WITH TIME ZONE NULL,
    finalizado_em TIMESTAMP WITH TIME ZONE NULL
);

-- 5. Tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS mensagens_chat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chamado_id UUID NULL REFERENCES chamados(id) ON DELETE CASCADE,
    remetente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    remetente_role chat_remetente_role NOT NULL,
    mensagem TEXT NOT NULL,
    enviado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabelas de Avaliações (Separadas por sentido e finalidade)
CREATE TABLE IF NOT EXISTS avaliacoes_tecnico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chamado_id UUID NOT NULL UNIQUE REFERENCES chamados(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(usuario_id) ON DELETE CASCADE,
    tecnico_id UUID NOT NULL REFERENCES tecnicos(usuario_id) ON DELETE CASCADE,
    nota SMALLINT NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avaliacoes_aluno (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chamado_id UUID NOT NULL UNIQUE REFERENCES chamados(id) ON DELETE CASCADE,
    tecnico_id UUID NOT NULL REFERENCES tecnicos(usuario_id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(usuario_id) ON DELETE CASCADE,
    nota SMALLINT NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabela de Auditoria Administrativa
CREATE TABLE IF NOT EXISTS logs_admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_alvo_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    acao admin_action NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Índices para Otimização de Performance
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_tecnico ON chamados(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_chamados_aluno ON chamados(aluno_id);
CREATE INDEX IF NOT EXISTS idx_chamados_criado_em ON chamados(criado_em);

CREATE INDEX IF NOT EXISTS idx_mensagens_chamado ON mensagens_chat(chamado_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON mensagens_chat(remetente_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_faculdade ON usuarios(faculdade_id);

CREATE INDEX IF NOT EXISTS idx_logs_admin_alvo ON logs_admin(usuario_alvo_id);
CREATE INDEX IF NOT EXISTS idx_logs_admin_admin ON logs_admin(admin_id);

-- 9. Views / Consultas Derivadas por Permissão
CREATE OR REPLACE VIEW vw_chamados_resolvidos_count AS
SELECT COUNT(*) AS total_resolvidos
FROM chamados
WHERE status = 'finalizado';

CREATE OR REPLACE VIEW vw_chamados_abertos_tempo_real AS
SELECT COUNT(*) AS total_abertos_tempo_real
FROM chamados
WHERE status IN ('aberto', 'em_atendimento');

CREATE OR REPLACE VIEW vw_nota_media_tecnico AS
SELECT 
    t.usuario_id AS tecnico_id,
    u.nome_completo AS nome_tecnico,
    t.especialidade,
    COUNT(at.id) AS total_avaliacoes,
    ROUND(COALESCE(AVG(at.nota), 0), 2) AS nota_media
FROM tecnicos t
JOIN usuarios u ON t.usuario_id = u.id
LEFT JOIN avaliacoes_tecnico at ON t.usuario_id = at.tecnico_id
GROUP BY t.usuario_id, u.nome_completo, t.especialidade;

CREATE OR REPLACE VIEW vw_nota_media_aluno AS
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
GROUP BY a.usuario_id, u.nome_completo, a.matricula, a.curso;

CREATE OR REPLACE VIEW vw_usuarios_por_role AS
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
