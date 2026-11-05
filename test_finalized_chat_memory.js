import assert from 'assert';
import http from 'http';
import express from 'express';
import { apiRouter } from './src/routes/api.js';
import { db } from './src/db.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
const server = http.createServer(app);

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (e) {}
          resolve({ status: res.statusCode, body, json, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  console.log('--- TESTANDO ENCERRAMENTO DE CHATS E REGISTRO SIMPLES EM MEMÓRIA ---');

  // 1. Criar novo chamado com múltiplas mensagens volumosas
  const newTicket = db.createTicket({
    studentId: 'usr-alu-1',
    studentName: 'Carlos Silva',
    subject: 'Problema na emissão de histórico escolar',
    description: 'Solicito a emissão urgente do meu histórico com carimbo digital.',
    categoryId: 'cat-sec',
    priority: 'high'
  });

  // Adicionar 5 mensagens com payloads
  for (let i = 1; i <= 5; i++) {
    db.addTicketMessage(newTicket.id, {
      senderId: i % 2 === 0 ? 'usr-tec-1' : 'usr-alu-1',
      senderName: i % 2 === 0 ? 'Mariana Atendente' : 'Carlos Silva',
      senderRole: i % 2 === 0 ? 'tecnico' : 'student',
      message: `Mensagem de detalhamento volumosa ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Dados extras da transação ${Date.now()}`
    });
  }

  const activeTicket = db.getTicketById(newTicket.id);
  assert.strictEqual(activeTicket.messages.length, 6, 'Chamado em aberto possui 6 mensagens completas');
  assert.strictEqual(activeTicket.closed, undefined, 'Chamado em aberto não está fechado');

  // 2. Finalizar chamado
  const updateRes = await request(server, `/api/tickets/${newTicket.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: { status: 'finalizado', csatScore: 5 }
  });
  assert.strictEqual(updateRes.status, 200, 'Status do chamado atualizado com sucesso');

  // 3. Validar se o chamado em memória foi fechado mantendo um registro simples
  const finalizedInMemory = db.getTicketById(newTicket.id);
  assert.strictEqual(finalizedInMemory.closed, true, 'Chamado marcado como closed: true');
  assert.strictEqual(finalizedInMemory.status, 'finalizado', 'Status é finalizado');
  assert.ok(finalizedInMemory.closedAt, 'Possui data de fechamento closedAt');
  assert.ok(finalizedInMemory.simpleRecord, 'Possui registro simples (simpleRecord) em memória');
  assert.strictEqual(finalizedInMemory.simpleRecord.totalMessages, 6, 'Registro simples contabiliza 6 mensagens');
  assert.strictEqual(finalizedInMemory.messages.length, 1, 'Memória RAM compactada: apenas 1 mensagem sintética de resumo');
  assert.strictEqual(finalizedInMemory.messages[0].isSimpleRecord, true, 'Mensagem em memória é identificada como isSimpleRecord');
  console.log('✓ PASS: Chamado de atendimento finalizado é fechado com registro simples na memória do software');

  // 4. Validar se mensagens detalhadas foram arquivadas em disco e recuperáveis com ?full=true
  const fullRes = await request(server, `/api/tickets/${newTicket.id}?full=true`);
  assert.strictEqual(fullRes.status, 200);
  assert.strictEqual(fullRes.json.messages.length, 6, 'Histórico completo preservado em arquivo de arquivo em disco');
  console.log('✓ PASS: Histórico completo pode ser recuperado sob demanda sem poluir a memória ativa');

  // 5. Validar bloqueio de novas mensagens para chamados já fechados
  const rejectedMsgRes = await request(server, `/api/tickets/${newTicket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      senderId: 'usr-alu-1',
      message: 'Tentando enviar mensagem após encerramento'
    }
  });
  assert.strictEqual(rejectedMsgRes.status, 400, 'Envio de mensagem para chamado fechado é rejeitado');
  console.log('✓ PASS: Chamado fechado não aceita novas mensagens');

  // 6. Testar Sessão de Chat Sophia IA
  const chatStartRes = await request(server, '/api/chat/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { studentId: 'usr-alu-1', department: 'Geral', studentName: 'Carlos Silva' }
  });
  assert.strictEqual(chatStartRes.status, 201);
  const sessionId = chatStartRes.json.id;

  // Enviar mensagens no chat
  await request(server, `/api/chat/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { sender: 'student', text: 'Como emitir minha carteirinha estudantil?' }
  });

  const activeSession = db.getChatSession(sessionId);
  assert.strictEqual(activeSession.messages.length, 3, 'Sessão de chat ativa possui 3 mensagens');

  // Fechar e finalizar o chat
  const closeChatRes = await request(server, `/api/chat/${sessionId}/close`, {
    method: 'POST'
  });
  assert.strictEqual(closeChatRes.status, 200, 'Chat finalizado via endpoint /chat/:id/close');

  const closedSession = db.getChatSession(sessionId);
  assert.strictEqual(closedSession.closed, true, 'Sessão de chat marcada como fechada (closed: true)');
  assert.strictEqual(closedSession.status, 'finalizado', 'Status da sessão é finalizado');
  assert.ok(closedSession.simpleRecord, 'Sessão possui registro simples na memória');
  assert.strictEqual(closedSession.simpleRecord.totalMessages, 3, 'Registro simples contém o número exato de mensagens');
  assert.strictEqual(closedSession.messages.length, 1, 'Memória da sessão compactada para 1 entrada sintética');
  console.log('✓ PASS: Sessão de chat com Sophia IA finalizada é fechada com registro simples na memória');

  // 7. Rejeição de novas mensagens no chat fechado
  const sendToClosedChat = await request(server, `/api/chat/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { sender: 'student', text: 'Mensagem após fechamento' }
  });
  assert.strictEqual(sendToClosedChat.status, 400, 'Envio de mensagem para chat finalizado é rejeitado');
  console.log('✓ PASS: Chat finalizado rejeita novas mensagens com feedback claro');

  server.close();
  console.log('\n======================================================');
  console.log('TODOS OS TESTES DE OTIMIZAÇÃO DE MEMÓRIA PASSARAM! ✅');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
