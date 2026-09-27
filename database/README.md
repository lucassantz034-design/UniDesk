# 🗄️ Especificação e Implementação do Banco de Dados — Unidesk

Este diretório contém a modelagem, scripts DDL e dados de teste (seeds) para a plataforma **Unidesk**, em estrita conformidade com a **Spec de Banco de Dados — Helpdesk Universitário (por perfil de usuário)**.

---

## 📋 Estrutura de Arquivos

| Arquivo | Descrição |
|---|---|
| [`schema.sql`](file:///C:/Users/Lucas/Desktop/Unidesk/database/schema.sql) | DDL completo para **PostgreSQL**, contendo tipos ENUMs, tabelas, constraints de integridade, índices e views. |
| [`schema_sqlite.sql`](file:///C:/Users/Lucas/Desktop/Unidesk/database/schema_sqlite.sql) | DDL adaptado para **SQLite**, com constraints `CHECK`, `PRAGMA foreign_keys = ON`, views e triggers de recálculo de nota média. |
| [`seeds.sql`](file:///C:/Users/Lucas/Desktop/Unidesk/database/seeds.sql) | Carga inicial de teste com os 4 perfis (`admin_software`, `admin_faculdade`, `tecnico`, `aluno`), chamados, chats, avaliações e logs. |
| [`init_db.js`](file:///C:/Users/Lucas/Desktop/Unidesk/database/init_db.js) | Script de automação em Node.js (utilizando o driver nativo `node:sqlite`) que gera o banco em `data/unidesk.db` e executa os testes de integridade. |

---

## 👥 Perfis de Usuário e Modelo de Tabelas

A modelagem utiliza o padrão de **tabela única de usuários central** (`usuarios`) combinada com **tabelas de papel 1:1** (`alunos`, `tecnicos`, `admins_faculdade`, `admins_software`):

```
usuarios (tabela-mãe)
 ├── alunos          (1:1, matricula, curso)
 ├── tecnicos        (1:1, especialidade, nota_media)
 ├── admins_faculdade(1:1, cargo)
 └── admins_software (1:1)
```

### Regras de Negócio e Segurança
1. **1 Cadastro por CPF**: Coluna `cpf VARCHAR(11) NOT NULL UNIQUE`.
2. **Hash de Senha**: Senhas armazenadas com hash bcrypt (`senha_hash VARCHAR(60)`).
3. **Invalidação de Sessão**: Coluna `token_version INTEGER DEFAULT 1`, incrementada automaticamente na redefinição de senha para revogar tokens JWT anteriores.
4. **Desativação Suave (Soft Delete)**: Coluna `ativo BOOLEAN DEFAULT true` com timestamp de inativação e auditoria (`inativado_por`).

---

## 🎫 Chamados, Chat e Avaliações Separadas

- **`chamados`**: Aluno cria o chamado (`status = 'aberto'`), técnico aceita (`status = 'em_atendimento'`) e finaliza (`status = 'finalizado'`).
- **`mensagens_chat`**: Histórico em tempo real vinculado ao chamado ou pré-atendimento.
- **`avaliacoes_tecnico`**: Avaliação do técnico feita pelo aluno (nota 1 a 5 + comentário). Alimenta a nota pública do técnico.
- **`avaliacoes_aluno`**: Avaliação do aluno feita pelo técnico (nota 1 a 5 + comentário). Visível exclusivamente para a diretoria/administração.
- **`logs_admin`**: Registro de auditoria para ações sensíveis de administradores (`criar_usuario`, `redefinir_senha`, `inativar_usuario`).

---

## 📊 Views Disponíveis

1. `vw_chamados_resolvidos_count`: Total de chamados com status `finalizado`.
2. `vw_chamados_abertos_tempo_real`: Total de chamados em `aberto` ou `em_atendimento`.
3. `vw_nota_media_tecnico`: Média de avaliação de cada técnico e quantidade de atendimentos avaliados.
4. `vw_nota_media_aluno`: Média de avaliação dos alunos atribuída pelos técnicos.
5. `vw_usuarios_por_role`: Relação consolidada de usuários com suas respectivas informações de matrícula, especialidade ou cargo.
