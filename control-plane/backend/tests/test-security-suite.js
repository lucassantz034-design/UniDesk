const assert = require('node:assert');
const { 
  issueLicenseToken, 
  verifyLicenseToken, 
  getPublicKey, 
  CANONICAL_PUBLIC_KEY 
} = require('../src/services/cryptoService');
const { 
  hashPassword, 
  verifyPassword, 
  issueMasterJwt, 
  verifyMasterJwt, 
  authenticateMaster, 
  requireMasterAuth 
} = require('../src/services/authService');
const webhookController = require('../src/controllers/webhookController');
const db = require('../src/db');

// Helper para mock de req/res Express
function createMockHttp(reqOptions = {}) {
  const req = {
    headers: {},
    body: {},
    params: {},
    query: {},
    ...reqOptions
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

async function runSecuritySuite() {
  console.log('===============================================================');
  console.log('🛡️  SUITE DE TESTES DE SEGURANÇA - UNIDESK CONTROL PLANE');
  console.log('===============================================================\n');

  // 1. Chave Ed25519 Canônica
  console.log('[1] Verificando par de chaves Ed25519 Canônicas...');
  const activePubKey = getPublicKey().trim();
  const expectedPubKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAZ5dhu9LsFuBHukWjqwXWYyGQyF16YhLGZ89Qz4R36Sw=
-----END PUBLIC KEY-----`.trim();

  assert.strictEqual(activePubKey, expectedPubKey, 'A chave pública ativa deve coincidir estritamente com a chave canônica.');
  assert(activePubKey.includes('MCowBQYDK2VwAyEAZ5dhu9LsFuBHukWjqwXWYyGQyF16YhLGZ89Qz4R36Sw='), 'Chave canônica Ed25519 correta');
  console.log('✅ Chave pública canônica Ed25519 confirmada e ativa.');

  // 2. Hash PBKDF2 e Autenticação de Senhas
  console.log('\n[2] Testando Hashing Seguro de Senha (PBKDF2 + Salt)...');
  const rawSecret = 'SenhaMasterForte#2026';
  const hashedPassword = hashPassword(rawSecret);
  assert(hashedPassword.includes(':'), 'Hash deve conter salt e hash separados por dois-pontos');
  assert(verifyPassword(rawSecret, hashedPassword), 'Senha original deve ser validada');
  assert(!verifyPassword('SenhaIncorreta123', hashedPassword), 'Senha incorreta deve ser rejeitada');
  console.log('✅ Hashing PBKDF2 com timing-safe comparison validado.');

  // 3. Emissão e Validação de JWT Real
  console.log('\n[3] Testando emissão e validação de JWT Real HS256...');
  const userPayload = { sub: 'admin-01', username: 'admin', role: 'SUPER_ADMIN' };
  const realJwt = issueMasterJwt(userPayload, 3600);
  assert.strictEqual(typeof realJwt, 'string');
  assert.strictEqual(realJwt.split('.').length, 3, 'JWT deve conter 3 partes (header.payload.signature)');

  const verifiedUser = verifyMasterJwt(realJwt);
  assert.strictEqual(verifiedUser.sub, 'admin-01');
  assert.strictEqual(verifiedUser.role, 'SUPER_ADMIN');
  console.log('✅ JWT real emitido e validado com sucesso.');

  // Teste de rejeição de JWT adulterado
  let jwtTampered = false;
  try {
    const tampered = realJwt.slice(0, -6) + 'XXXXXX';
    verifyMasterJwt(tampered);
  } catch (err) {
    jwtTampered = true;
  }
  assert(jwtTampered, 'JWT adulterado deve falhar na verificação criptográfica');
  console.log('✅ Adulteração de assinatura JWT rejeitada.');

  // 4. Proteção de Rotas com requireMasterAuth
  console.log('\n[4] Testando Middleware requireMasterAuth...');
  
  // 4a. Sem token -> 401
  const noToken = createMockHttp();
  let nextCalled = false;
  requireMasterAuth(noToken.req, noToken.res, () => { nextCalled = true; });
  assert.strictEqual(noToken.res.statusCode, 401, 'Requisição sem token deve retornar 401');
  assert.strictEqual(nextCalled, false);

  // 4b. Com token estático/fake antigo 'jwt_master_authorized_session' -> 401
  const fakeToken = createMockHttp({
    headers: { authorization: 'Bearer jwt_master_authorized_session' }
  });
  nextCalled = false;
  requireMasterAuth(fakeToken.req, fakeToken.res, () => { nextCalled = true; });
  assert.strictEqual(fakeToken.res.statusCode, 401, 'Token estático fake deve ser recusado com 401');
  assert.strictEqual(nextCalled, false);

  // 4c. Com token real válido -> 200 / Next
  const validTokenHttp = createMockHttp({
    headers: { authorization: `Bearer ${realJwt}` }
  });
  nextCalled = false;
  requireMasterAuth(validTokenHttp.req, validTokenHttp.res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Token real válido deve prosseguir via next()');
  assert.strictEqual(validTokenHttp.req.user.role, 'SUPER_ADMIN');
  console.log('✅ Middleware requireMasterAuth bloqueia acessos inválidos e libera tokens legítimos.');

  // 5. Webhook Asaas Seguro (Bloqueio por Padrão)
  console.log('\n[5] Testando Webhook Asaas seguro (bloqueio por padrão)...');
  
  // 5a. Sem header asaas-access-token -> 401
  const noWebhookToken = createMockHttp({
    body: { event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 100 } }
  });
  await webhookController.handleAsaas(noWebhookToken.req, noWebhookToken.res);
  assert.strictEqual(noWebhookToken.res.statusCode, 401, 'Webhook sem token deve retornar 401');

  // 5b. Com token incorreto -> 401
  const wrongWebhookToken = createMockHttp({
    headers: { 'asaas-access-token': 'token_falso_hacker' },
    body: { event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 100 } }
  });
  await webhookController.handleAsaas(wrongWebhookToken.req, wrongWebhookToken.res);
  assert.strictEqual(wrongWebhookToken.res.statusCode, 401, 'Webhook com token incorreto deve retornar 401');

  // 5c. Quando ASAAS_WEBHOOK_SECRET não estiver configurado -> 401
  const savedSecret = process.env.ASAAS_WEBHOOK_SECRET;
  delete process.env.ASAAS_WEBHOOK_SECRET;

  const noSecretConfigured = createMockHttp({
    headers: { 'asaas-access-token': 'qualquer_coisa' },
    body: { event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 100 } }
  });
  await webhookController.handleAsaas(noSecretConfigured.req, noSecretConfigured.res);
  assert.strictEqual(noSecretConfigured.res.statusCode, 401, 'Webhook sem ASAAS_WEBHOOK_SECRET deve recusar com 401');

  // Restaura segredo
  process.env.ASAAS_WEBHOOK_SECRET = savedSecret;

  // 5d. Com token correto -> 200
  const correctWebhookToken = createMockHttp({
    headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_SECRET },
    body: {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_test_001',
        customer: 'cus_000005829101',
        value: 690.00,
        billingType: 'PIX',
        confirmedDate: new Date().toISOString()
      }
    }
  });
  await webhookController.handleAsaas(correctWebhookToken.req, correctWebhookToken.res);
  assert.strictEqual(correctWebhookToken.res.statusCode, 200, 'Webhook com segredo e token válidos deve retornar 200');
  console.log('✅ Webhook Asaas bloqueado por padrão e estritamente protegido.');

  // 6. Contrato de Chamados de Suporte (title + subject e X-Tenant-License-Key)
  console.log('\n[6] Testando Contrato de Chamados de Suporte...');
  const routes = require('../src/routes/api');
  
  // Teste de binding do tenant_id via header X-Tenant-License-Key
  const registeredLicense = await db.getLicenseByKey('UNIDESK-TEST-KEY-2026');
  assert(registeredLicense, 'Licença de teste deve existir');

  // Requisição enviando 'title' e header 'X-Tenant-License-Key'
  const postTicketReq = createMockHttp({
    headers: {
      'x-tenant-license-key': 'UNIDESK-TEST-KEY-2026'
    },
    body: {
      title: 'Problema na emissão de boletos na filial',
      description: 'Falha 502 ao tentar gerar segunda via',
      priority: 'HIGH',
      diagnostics: { os: 'linux', appVersion: 'v2.4.1' }
    }
  });

  // Encontra a rota de POST /support/tickets
  const postTicketRoute = routes.stack.find(s => s.route && s.route.path === '/support/tickets' && s.route.methods.post);
  assert(postTicketRoute, 'Rota POST /support/tickets deve estar registrada');

  await postTicketRoute.route.stack[0].handle(postTicketReq.req, postTicketReq.res);
  assert.strictEqual(postTicketReq.res.statusCode, 201, 'Ticket deve ser criado com status 201');
  assert.strictEqual(postTicketReq.res.body.tenant_id, registeredLicense.tenant_id, 'tenant_id deve ser vinculado automaticamente à licença');
  assert.strictEqual(postTicketReq.res.body.title, 'Problema na emissão de boletos na filial');
  console.log(`✅ Chamado criado com sucesso vinculado ao tenant ${postTicketReq.res.body.tenant_id} via X-Tenant-License-Key.`);

  // Teste aceitando 'subject' no lugar de 'title'
  const postTicketSubjectReq = createMockHttp({
    headers: {
      'x-tenant-license-key': 'UNIDESK-TEST-KEY-2026'
    },
    body: {
      subject: 'Dúvida sobre webhook de faturamento',
      description: 'Como funciona a tolerância de 15 dias?'
    }
  });
  await postTicketRoute.route.stack[0].handle(postTicketSubjectReq.req, postTicketSubjectReq.res);
  assert.strictEqual(postTicketSubjectReq.res.statusCode, 201);
  assert.strictEqual(postTicketSubjectReq.res.body.title, 'Dúvida sobre webhook de faturamento');
  console.log('✅ Endpoint aceita tanto "title" quanto "subject" perfeitamente.');

  // 7. Persistência em Produção (NODE_ENV=production sem DATABASE_URL)
  console.log('\n[7] Testando trava de persistência para produção (NODE_ENV=production)...');
  const { execSync } = require('child_process');
  let prodGuardFailed = false;
  try {
    // Executa subprocesso com NODE_ENV=production e DATABASE_URL vazio
    execSync('node -e "process.env.NODE_ENV=\'production\'; delete process.env.DATABASE_URL; require(\'./src/db/index.js\');"', {
      cwd: require('path').resolve(__dirname, '..'),
      stdio: 'pipe'
    });
  } catch (err) {
    prodGuardFailed = true;
    assert(err.stderr.toString().includes('DATABASE_URL é obrigatória em ambiente de produção'));
  }
  assert(prodGuardFailed, 'Em produção, a inicialização sem DATABASE_URL DEVE lançar erro fatal');
  console.log('✅ Trava de segurança ativa: Inicialização em produção é recusada sem DATABASE_URL.');

  console.log('\n🎉 TODOS OS TESTES DA SUITE DE SEGURANÇA FORAM APROVADOS COM SUCESSO (100% OK)!');
}

runSecuritySuite().catch(err => {
  console.error('\n❌ ERRO NA SUITE DE SEGURANÇA:', err);
  process.exit(1);
});
