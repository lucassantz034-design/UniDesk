import http from 'http';
import express from 'express';
import { apiRouter } from './src/routes/api.js';
import { db } from './src/db.js';
import { licenseVerifier } from './src/licensing/licenseVerifier.js';
import { backupService } from './src/services/backupService.js';
import { verifySessionToken, INSTANCE_SECRET } from './src/middleware/auth.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opt = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(opt, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({ status: res.statusCode, body, json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTestSuite() {
  const server = app.listen(0);
  console.log('--- INICIANDO BATERIA DE TESTES DE SEGURANÇA UNIDESK ---');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TESTE 1: Autenticação e Hash de Senha (PBKDF2/Scrypt)
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Autenticação e Hash de Senha em src/db.js');

    // 1.1 Login correto do Admin com senha padrão '123456'
    const loginAdminRes = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'admin@metropolitana.edu.br', password: '123456' }
    });
    assert(loginAdminRes.status === 200, 'Login do admin com senha padrão 123456 deve retornar 200');
    assert(loginAdminRes.json?.success === true, 'Login deve retornar success: true');
    assert(loginAdminRes.json?.token && loginAdminRes.json?.token.startsWith('udt_'), 'Token deve possuir prefixo udt_');
    const adminToken = loginAdminRes.json?.token;

    // 1.2 Login de Aluno com senha padrão '123456'
    const loginAlunoRes = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'larissa.vianna@aluno.metropolitana.edu.br', password: '123456' }
    });
    assert(loginAlunoRes.status === 200, 'Login do aluno com senha padrão 123456 deve retornar 200');
    const alunoToken = loginAlunoRes.json?.token;

    // 1.3 Login com senha errada deve retornar 401
    const loginWrongPass = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'admin@metropolitana.edu.br', password: 'senha_incorreta_xyz' }
    });
    assert(loginWrongPass.status === 401, 'Login com senha incorreta deve retornar 401');

    // 1.4 Login sem senha deve retornar 401
    const loginNoPass = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'admin@metropolitana.edu.br' }
    });
    assert(loginNoPass.status === 401, 'Login sem senha deve retornar 401');

    // -------------------------------------------------------------
    // TESTE 2: Geração e Validação de Tokens HMAC-SHA256
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Tokens HMAC-SHA256 e Verificação de Forjamento');

    const adminPayload = verifySessionToken(adminToken, INSTANCE_SECRET);
    assert(adminPayload && adminPayload.userId, 'Token de admin válido deve decodificar corretamente');

    // 2.1 Forjamento de token base64 antigo ('udt_...' sem assinatura HMAC válida)
    const fakeToken = 'udt_' + Buffer.from('usr-adm-fac:1799999999:admin@metropolitana.edu.br').toString('base64');
    const fakePayload = verifySessionToken(fakeToken, INSTANCE_SECRET);
    assert(fakePayload === null, 'Token forjado em base64 simples deve ser rejeitado (null)');

    const meWithFake = await request(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${fakeToken}` }
    });
    assert(meWithFake.status === 401, 'GET /api/auth/me com token forjado deve retornar 401');

    const meWithAdmin = await request(server, '/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(meWithAdmin.status === 200 && meWithAdmin.json?.user, 'GET /api/auth/me com token legítimo deve retornar 200');

    // -------------------------------------------------------------
    // TESTE 3: Proteção das Rotas Administrativas e Sanitização de Config
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Proteção de Rotas Administrativas e Sanitização');

    // 3.1 Sanitização pública de GET /api/config (sem token)
    const pubConfigRes = await request(server, '/api/config');
    assert(pubConfigRes.status === 200, 'GET /api/config deve ser acessível publicamente');
    assert(pubConfigRes.json?.aiApiKey !== 'sk-unidesk-real-secret-key-12345', 'GET /api/config público não deve vazar aiApiKey real');
    assert(!pubConfigRes.json?.aiApiKey || pubConfigRes.json?.aiApiKey.includes('••••'), 'aiApiKey deve vir mascarada ou limpa na rota pública');

    // 3.2 Endpoint restrito GET /api/admin/config
    const admConfigNoToken = await request(server, '/api/admin/config');
    assert(admConfigNoToken.status === 401, 'GET /api/admin/config sem token deve retornar 401');

    const admConfigAluno = await request(server, '/api/admin/config', {
      headers: { Authorization: `Bearer ${alunoToken}` }
    });
    assert(admConfigAluno.status === 403, 'GET /api/admin/config com token de aluno deve retornar 403');

    const admConfigAdmin = await request(server, '/api/admin/config', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(admConfigAdmin.status === 200, 'GET /api/admin/config com token de admin deve retornar 200');

    // 3.3 PUT /api/config (Proteção)
    const putConfigNoToken = await request(server, '/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'Universidade Hackeada' }
    });
    assert(putConfigNoToken.status === 401, 'PUT /api/config sem token deve retornar 401');

    const putConfigAluno = await request(server, '/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alunoToken}` },
      body: { name: 'Universidade Hackeada' }
    });
    assert(putConfigAluno.status === 403, 'PUT /api/config com perfil de aluno deve retornar 403');

    const putConfigAdmin = await request(server, '/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: { tagline: 'Central de Atendimento Segura' }
    });
    assert(putConfigAdmin.status === 200 && putConfigAdmin.json?.success === true, 'PUT /api/config com token de admin deve retornar 200');

    // 3.4 /api/sql/users e /api/admin/metrics
    const sqlUsersNoToken = await request(server, '/api/sql/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { nomeCompleto: 'Teste', cpf: '00011122233', email: 'teste@teste.com', role: 'aluno' }
    });
    assert(sqlUsersNoToken.status === 401, 'POST /api/sql/users sem token deve retornar 401');

    const adminMetricsNoToken = await request(server, '/api/admin/metrics');
    assert(adminMetricsNoToken.status === 401, 'GET /api/admin/metrics sem token deve retornar 401');

    const adminMetricsAluno = await request(server, '/api/admin/metrics', {
      headers: { Authorization: `Bearer ${alunoToken}` }
    });
    assert(adminMetricsAluno.status === 403, 'GET /api/admin/metrics com token de aluno deve retornar 403');

    const adminMetricsAdmin = await request(server, '/api/admin/metrics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminMetricsAdmin.status === 200, 'GET /api/admin/metrics com token de admin deve retornar 200');

    // -------------------------------------------------------------
    // TESTE 4: Rota de Simulação em Produção
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Desativação da Simulação de Licenciamento em Produção');

    // 4.1 Sem token
    const simNoToken = await request(server, '/api/licensing/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { status: 'ACTIVE' }
    });
    assert(simNoToken.status === 401, 'POST /api/licensing/simulate sem token deve retornar 401');

    // 4.2 Em ambiente de produção (NODE_ENV=production)
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const simProdRes = await request(server, '/api/licensing/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: { status: 'ACTIVE' }
    });
    assert(simProdRes.status === 403, 'POST /api/licensing/simulate em produção (NODE_ENV=production) deve retornar 403');
    assert(simProdRes.json?.error.includes('desativada em ambiente de produção'), 'Mensagem explícita de desativação em produção');

    // 4.3 Restaura ambiente e testa em modo desenvolvimento
    process.env.NODE_ENV = 'development';
    const simDevRes = await request(server, '/api/licensing/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: { status: 'ACTIVE' }
    });
    assert(simDevRes.status === 200, 'POST /api/licensing/simulate em desenvolvimento com admin deve retornar 200');
    process.env.NODE_ENV = prevNodeEnv;

    // -------------------------------------------------------------
    // TESTE 5: Sincronização da Chave Pública Ed25519
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Sincronização da Chave Pública Ed25519');

    const expectedCanonicalKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAZ5dhu9LsFuBHukWjqwXWYyGQyF16YhLGZ89Qz4R36Sw=
-----END PUBLIC KEY-----`;

    assert(
      licenseVerifier.publicKeyPem.trim() === expectedCanonicalKey.trim(),
      'licenseVerifier deve utilizar a chave pública Ed25519 canônica da Central'
    );

    // -------------------------------------------------------------
    // TESTE 6: Backup Transacional VACUUM INTO do SQLite
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Backup Transacional do SQLite');

    const backupResult = await backupService.createBackup();
    assert(backupResult.success === true, 'createBackup deve executar com sucesso');
    assert(backupResult.filename.endsWith('.sqlite.gz'), 'Backup gerado deve ter extensão .sqlite.gz');
    assert(Number(backupResult.sizeBytes) > 0, 'Tamanho do backup deve ser maior que 0 bytes');

    // -------------------------------------------------------------
    // SUMÁRIO DOS TESTES
    // -------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`TOTAL DE TESTES: ${passed + failed}`);
    console.log(`PASSOU: ${passed}`);
    console.log(`FALHOU: ${failed}`);
    console.log('======================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Erro fatal executando bateria de testes:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTestSuite();
