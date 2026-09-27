-- ============================================================================
-- SEEDS INICIAIS — HELPDESK UNIVERSITÁRIO
-- Dados de teste para os 4 perfis de usuário, chamados, chats e avaliações
-- ============================================================================

-- 1. Faculdade
INSERT INTO faculdades (id, nome, sigla, cnpj, ativo) VALUES
('fac-1', 'Universidade Metropolitana de Inovação', 'UMI', '12.345.678/0001-90', 1);

-- 2. Usuários
-- Senhas em hash bcrypt simulado (custo 10)
-- admin_software (dono do sistema)
INSERT INTO usuarios (id, nome_completo, cpf, email, senha_hash, role, faculdade_id, ativo, token_version) VALUES
('usr-adm-soft', 'Carlos Eduardo Silveira', '11122233344', 'admin.software@unidesk.com', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'admin_software', NULL, 1, 1);

INSERT INTO admins_software (usuario_id) VALUES
('usr-adm-soft');

-- admin_faculdade (diretor de TI da UMI)
INSERT INTO usuarios (id, nome_completo, cpf, email, senha_hash, role, faculdade_id, ativo, token_version) VALUES
('usr-adm-fac', 'Prof. Dr. Roberto Guimarães', '22233344455', 'roberto.ti@metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'admin_faculdade', 'fac-1', 1, 1);

INSERT INTO admins_faculdade (usuario_id, cargo) VALUES
('usr-adm-fac', 'Diretor de Tecnologia e Informação');

-- técnicos
INSERT INTO usuarios (id, nome_completo, cpf, email, senha_hash, role, faculdade_id, ativo, token_version, criado_por) VALUES
('usr-tec-1', 'Mariana Alencar', '33344455566', 'mariana.suporte@metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'tecnico', 'fac-1', 1, 1, 'usr-adm-fac'),
('usr-tec-2', 'Felipe Castilho', '44455566677', 'felipe.ti@metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'tecnico', 'fac-1', 1, 1, 'usr-adm-fac'),
('usr-tec-3', 'Carla Esteves', '55566677788', 'carla.financeiro@metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'tecnico', 'fac-1', 1, 1, 'usr-adm-fac');

INSERT INTO tecnicos (usuario_id, especialidade, nota_media) VALUES
('usr-tec-1', 'Secretaria Acadêmica & Diplomas', 4.90),
('usr-tec-2', 'Redes & Infraestrutura AVA Moodle', 4.85),
('usr-tec-3', 'Sistemas Financeiros & FIES/Prouni', 5.00);

-- alunos
INSERT INTO usuarios (id, nome_completo, cpf, email, senha_hash, role, faculdade_id, ativo, token_version, criado_por) VALUES
('usr-alu-1', 'Enzo Gabriel Martins', '66677788899', 'enzo.martins@aluno.metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'aluno', 'fac-1', 1, 1, 'usr-adm-fac'),
('usr-alu-2', 'Larissa Vianna Castro', '77788899900', 'larissa.vianna@aluno.metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'aluno', 'fac-1', 1, 1, 'usr-adm-fac'),
('usr-alu-3', 'Rodrigo Sanches Lima', '88899900011', 'rodrigo.sanches@aluno.metropolitana.edu.br', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234', 'aluno', 'fac-1', 1, 1, 'usr-adm-fac');

INSERT INTO alunos (usuario_id, matricula, curso) VALUES
('usr-alu-1', '20240189', 'Engenharia de Software (5º Período)'),
('usr-alu-2', '20230512', 'Medicina (7º Período)'),
('usr-alu-3', '20220891', 'Direito (9º Período)');

-- 3. Chamados (Tickets)
-- Chamado 1: Em atendimento (Aluno 1 com Técnico 1)
INSERT INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em, aceito_em) VALUES
('chm-1001', 'usr-alu-1', 'usr-tec-1', 'Atraso na validação de horas complementares para TCC', 'Enviei certificados de 60 horas extracurriculares há 20 dias e necessito da homologação para agendar a banca.', 'em_atendimento', 'Secretaria Acadêmica', datetime('now', '-2 days'), datetime('now', '-1 day'));

-- Chamado 2: Aberto (Aluno 2 aguardando técnico)
INSERT INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em) VALUES
('chm-1002', 'usr-alu-2', NULL, 'Boleto mensal emitido sem o desconto de bolsa mérito', 'O boleto de outubro veio no valor integral (R$ 9.850,00) em vez do valor com bolsa de 30% concedida pelo edital.', 'aberto', 'Financeiro & Bolsas', datetime('now', '-3 hours'));

-- Chamado 3: Finalizado (Aluno 3 atendido por Técnico 2)
INSERT INTO chamados (id, aluno_id, tecnico_id, titulo, descricao, status, categoria, criado_em, aceito_em, finalizado_em) VALUES
('chm-1003', 'usr-alu-3', 'usr-tec-2', 'Erro 403 de permissão durante envio de prova no AVA', 'O portal travou durante o envio da avaliação de Direito Tributário.', 'finalizado', 'Suporte AVA & TI', datetime('now', '-5 days'), datetime('now', '-5 days', '+1 hour'), datetime('now', '-4 days'));

-- 4. Mensagens do Chat
INSERT INTO mensagens_chat (id, chamado_id, remetente_id, remetente_role, mensagem, enviado_em) VALUES
('msg-1', 'chm-1001', 'usr-alu-1', 'aluno', 'Olá Mariana! Gostaria de saber se o coordenador já deu o aceite nas horas.', datetime('now', '-1 day')),
('msg-2', 'chm-1001', 'usr-tec-1', 'tecnico', 'Boa tarde Enzo! Já notifiquei o coordenador Arnaldo com urgência. Até amanhã estará liberado.', datetime('now', '-20 hours')),
('msg-3', 'chm-1003', 'usr-alu-3', 'aluno', 'Felipe, deu erro na questão 8 e perdi 15 minutos.', datetime('now', '-5 days')),
('msg-4', 'chm-1003', 'usr-tec-2', 'tecnico', 'Restauramos o seu rascunho de respostas e estendemos o prazo em 30 minutos.', datetime('now', '-5 days', '+30 minutes')),
('msg-5', 'chm-1003', 'usr-alu-3', 'aluno', 'Perfeito, prova entregue com sucesso! Obrigado pelo suporte.', datetime('now', '-4 days'));

-- 5. Avaliações (Cruciais: 1 por chamado, sentidos separados)
-- Aluno avalia o técnico (no chamado 1003 finalizado)
INSERT INTO avaliacoes_tecnico (id, chamado_id, aluno_id, tecnico_id, nota, comentario, criado_em) VALUES
('avt-1', 'chm-1003', 'usr-alu-3', 'usr-tec-2', 5, 'Atendimento muito ágil e eficiente, resolveu no meio da minha prova!', datetime('now', '-4 days'));

-- Técnico avalia o aluno (no chamado 1003 finalizado)
INSERT INTO avaliacoes_aluno (id, chamado_id, tecnico_id, aluno_id, nota, comentario, criado_em) VALUES
('ava-1', 'chm-1003', 'usr-tec-2', 'usr-alu-3', 5, 'Aluno educado, enviou print claro do erro o que facilitou o diagnóstico imediato.', datetime('now', '-4 days'));

-- 6. Logs de Auditoria do Admin Faculdade
INSERT INTO logs_admin (id, admin_id, usuario_alvo_id, acao, criado_em) VALUES
('log-1', 'usr-adm-fac', 'usr-tec-1', 'criar_usuario', datetime('now', '-30 days')),
('log-2', 'usr-adm-fac', 'usr-alu-1', 'criar_usuario', datetime('now', '-20 days')),
('log-3', 'usr-adm-fac', 'usr-alu-1', 'redefinir_senha', datetime('now', '-10 days'));
