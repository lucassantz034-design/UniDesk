const assert = require('node:assert');
const { issueLicenseToken, verifyLicenseToken, getPublicKey } = require('../src/services/cryptoService');
const asaasService = require('../src/services/asaasService');
const db = require('../src/db');

async function runTests() {
  console.log('--- 🧪 INICIANDO TESTES DO UNIDESK CONTROL PLANE ---');

  // Teste 1: Criptografia Ed25519
  console.log('\n[1] Testando geração e assinatura Ed25519...');
  const pubKey = getPublicKey();
  assert(pubKey.includes('BEGIN PUBLIC KEY'), 'Chave pública Ed25519 deve conter cabeçalho PEM');
  console.log('✅ Chave pública gerada com sucesso.');

  const testPayload = {
    tenant_id: 'tenant-123',
    license_key: 'UNIDESK-TEST-KEY-2026',
    instance_uuid: 'inst-pc-01',
    status: 'ACTIVE',
    valid_until: '2026-11-14T00:00:00.000Z'
  };

  const token = issueLicenseToken(testPayload);
  assert(typeof token === 'string' && token.split('.').length === 3, 'Token deve ter 3 partes separadas por ponto');
  console.log('✅ Token Ed25519 assinado com sucesso:\n', token.substring(0, 50) + '...');

  const verified = verifyLicenseToken(token);
  assert.strictEqual(verified.tenant_id, testPayload.tenant_id);
  assert.strictEqual(verified.instance_uuid, testPayload.instance_uuid);
  assert.strictEqual(verified.status, 'ACTIVE');
  console.log('✅ Token Ed25519 verificado e dados decodificados com integridade garantida.');

  // Teste de adulteração
  let tamperFailed = false;
  try {
    const tampered = token.slice(0, -5) + 'AAAAA';
    verifyLicenseToken(tampered);
  } catch (err) {
    tamperFailed = true;
    console.log('✅ Adulteração detectada e rejeitada corretamente:', err.message);
  }
  assert(tamperFailed, 'Assinatura inválida deveria ter gerado erro!');

  // Teste 2: Ativação de Licença no banco/store
  console.log('\n[2] Testando ativação de licença...');
  const licBefore = await db.getLicenseByKey('UNIDESK-TEST-KEY-2026');
  assert(licBefore !== null, 'Licença de teste padrão deve existir');

  const activatedLic = await db.updateLicense('UNIDESK-TEST-KEY-2026', {
    instance_uuid: 'inst-pc-servidor-01',
    activated_at: new Date().toISOString()
  });
  assert.strictEqual(activatedLic.instance_uuid, 'inst-pc-servidor-01');
  console.log('✅ Licença vinculada à instância inst-pc-servidor-01 com sucesso.');

  // Teste 3: Processamento do Webhook Asaas - PAYMENT_OVERDUE (Grace Period de 15 dias)
  console.log('\n[3] Testando Webhook Asaas: PAYMENT_OVERDUE (Grace Period 15 dias)...');
  const overdueWebhook = {
    event: 'PAYMENT_OVERDUE',
    payment: {
      id: 'pay_0001',
      customer: 'cus_000005829101',
      value: 199.90,
      dueDate: '2026-10-10',
      status: 'OVERDUE',
      billingType: 'PIX'
    }
  };

  const overdueRes = await asaasService.processWebhookEvent(overdueWebhook.event, overdueWebhook.payment);
  assert.strictEqual(overdueRes.status, 'GRACE_PERIOD');
  const licGrace = await db.getLicenseByKey('UNIDESK-TEST-KEY-2026');
  assert.strictEqual(licGrace.status, 'GRACE_PERIOD');
  assert(licGrace.grace_until !== null, 'grace_until deve estar preenchido');
  console.log(`✅ Licença colocada em GRACE_PERIOD com tolerância até ${licGrace.grace_until}.`);

  // Teste 4: Processamento do Webhook Asaas - PAYMENT_RECEIVED (Renovação)
  console.log('\n[4] Testando Webhook Asaas: PAYMENT_RECEIVED (Ativação/Renovação)...');
  const paymentWebhook = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_0002',
      customer: 'cus_000005829101',
      value: 199.90,
      dueDate: '2026-10-14',
      confirmedDate: new Date().toISOString(),
      status: 'RECEIVED',
      billingType: 'PIX'
    }
  };

  const paymentRes = await asaasService.processWebhookEvent(paymentWebhook.event, paymentWebhook.payment);
  assert.strictEqual(paymentRes.status, 'ACTIVE');
  const licActive = await db.getLicenseByKey('UNIDESK-TEST-KEY-2026');
  assert.strictEqual(licActive.status, 'ACTIVE');
  assert.strictEqual(licActive.grace_until, null, 'grace_until deve ser limpo ao pagar');
  console.log(`✅ Licença renovada e status ativo restaurado até ${licActive.valid_until}.`);

  // Teste 5: Processamento do Webhook Asaas - SUBSCRIPTION_CANCELLED (Suspensão)
  console.log('\n[5] Testando Webhook Asaas: SUBSCRIPTION_CANCELLED (Suspensão)...');
  const cancelWebhook = {
    event: 'SUBSCRIPTION_CANCELLED',
    payment: {
      id: 'pay_0003',
      customer: 'cus_000005829101',
      value: 199.90,
      dueDate: '2026-10-14',
      status: 'CANCELLED',
      billingType: 'PIX'
    }
  };

  const cancelRes = await asaasService.processWebhookEvent(cancelWebhook.event, cancelWebhook.payment);
  assert.strictEqual(cancelRes.status, 'SUSPENDED');
  const licSuspended = await db.getLicenseByKey('UNIDESK-TEST-KEY-2026');
  assert.strictEqual(licSuspended.status, 'SUSPENDED');
  console.log('✅ Licença suspensa com sucesso após cancelamento.');

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO (100% OK)!');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
