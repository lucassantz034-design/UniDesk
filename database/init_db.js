import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'unidesk.db');
const SCHEMA_FILE = path.join(__dirname, 'schema_sqlite.sql');
const SEEDS_FILE = path.join(__dirname, 'seeds.sql');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('----------------------------------------------------');
console.log('🔧 INICIALIZANDO BANCO DE DADOS UNIDESK');
console.log(`📁 Arquivo: ${DB_PATH}`);
console.log('----------------------------------------------------');

// Remove existing test db to run a fresh initialization
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// 1. Execute Schema
console.log('▶ Executando DDL (schema_sqlite.sql)...');
const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
db.exec(schemaSql);
console.log('✓ Tabelas, Chaves Estrangeiras, Índices, Views e Triggers criados com sucesso.');

// 2. Execute Seeds
console.log('▶ Inserindo dados iniciais e perfis (seeds.sql)...');
const seedsSql = fs.readFileSync(SEEDS_FILE, 'utf8');
db.exec(seedsSql);
console.log('✓ Seeds inseridos com sucesso.');

// 3. Validation & Integrity Tests
console.log('\n----------------------------------------------------');
console.log('📊 TESTES DE VALIDAÇÃO DAS VIEWS E CONSULTAS');
console.log('----------------------------------------------------');

// Test vw_chamados_abertos_tempo_real
const abertos = db.prepare('SELECT * FROM vw_chamados_abertos_tempo_real;').get();
console.log(`• Chamados Abertos em Tempo Real: ${abertos.total_abertos_tempo_real}`);

// Test vw_chamados_resolvidos_count
const resolvidos = db.prepare('SELECT * FROM vw_chamados_resolvidos_count;').get();
console.log(`• Chamados Resolvidos: ${resolvidos.total_resolvidos}`);

// Test vw_nota_media_tecnico
console.log('\n• Notas Médias dos Técnicos (vw_nota_media_tecnico):');
const notasTecnicos = db.prepare('SELECT * FROM vw_nota_media_tecnico;').all();
for (const t of notasTecnicos) {
  console.log(`  - [Técnico] ${t.nome_tecnico} (${t.especialidade}): Média ${t.nota_media} (${t.total_avaliacoes} avaliações)`);
}

// Test vw_nota_media_aluno
console.log('\n• Notas dos Alunos dadas pelos Técnicos (vw_nota_media_aluno):');
const notasAlunos = db.prepare('SELECT * FROM vw_nota_media_aluno;').all();
for (const a of notasAlunos) {
  console.log(`  - [Aluno] ${a.nome_aluno} (Matrícula: ${a.matricula}): Média ${a.nota_media} (${a.total_avaliacoes} avaliações)`);
}

// Test vw_usuarios_por_role
console.log('\n• Usuários Cadastrados por Papel (vw_usuarios_por_role):');
const usuarios = db.prepare('SELECT id, nome_completo, cpf, role, ativo FROM vw_usuarios_por_role;').all();
for (const u of usuarios) {
  console.log(`  - [${u.role.padEnd(14)}] ${u.nome_completo.padEnd(28)} | CPF: ${u.cpf} | Ativo: ${u.ativo ? 'SIM' : 'NÃO'}`);
}

// Test Auditoria Logs
console.log('\n• Auditoria de Ações Administrativas (logs_admin):');
const logs = db.prepare('SELECT id, admin_id, usuario_alvo_id, acao, criado_em FROM logs_admin;').all();
for (const l of logs) {
  console.log(`  - ${l.criado_em}: Admin [${l.admin_id}] executou [${l.acao}] no usuário [${l.usuario_alvo_id}]`);
}

console.log('\n====================================================');
console.log('✅ BANCO DE DADOS CRIADO E VALIDADO COM SUCESSO!');
console.log('====================================================');
