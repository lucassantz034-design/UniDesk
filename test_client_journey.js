import http from 'http';
import express from 'express';
import { apiRouter } from './src/routes/api.js';
import { db } from './src/db.js';
import { licenseGuardMiddleware } from './src/licensing/licenseGuard.js';
import { heartbeatClient } from './src/licensing/heartbeatClient.js';
import { backupService } from './src/services/backupService.js';

const app = express();
app.use(express.json());
app.use('/api', licenseGuardMiddleware);
app.use('/api', apiRouter);

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const safePath = encodeURI(path);
    const opt = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: safePath,
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

    req.on('error', (err) => {
      console.error('Request error:', err);
      reject(err);
    });
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runClientTests() {
  // Garantir que a licença comece com status ACTIVE
  heartbeatClient.forceState({ status: 'ACTIVE', daysInGrace: 0, invoice: null });

  const server = app.listen(0);
  console.log('================================================================');
  console.log('🎓 UNIDESK — BATERIA DE TESTES DO CLIENTE & AUDITORIA DE QUALIDADE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;
  const issuesFound = [];

  function assert(condition, message, errorDetail = null) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
      issuesFound.push({ message, errorDetail });
    }
  }

  try {
    // -------------------------------------------------------------
    // FASE 1: JORNADA DO ALUNO (ESTUDANTE)
    // -------------------------------------------------------------
    console.log('\n--- [FASE 1] JORNADA DO ALUNO ---');

    // 1.1 Login Aluno
    const studentLogin = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'enzo.martins@aluno.metropolitana.edu.br', password: '123456' }
    });
    assert(studentLogin.status === 200, 'Aluno consegue logar com credenciais institucionais');
    assert(studentLogin.json?.user?.role === 'aluno', 'Perfil do usuário retornado é "aluno"');
    const studentToken = studentLogin.json?.token;
    const studentUser = studentLogin.json?.user;

    // 1.2 Consulta à Base de Conhecimento (FAQ)
    const faqRes = await request(server, '/api/faq?search=matrícula', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(faqRes.status === 200 && Array.isArray(faqRes.json), 'Consulta à base de conhecimento (FAQ) funciona');
    assert(faqRes.json.length > 0, 'FAQ retorna artigos relacionados a matrícula');

    // 1.3 Iniciar Chat com Sophia IA
    const chatStartRes = await request(server, '/api/chat/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { studentId: studentUser.id, department: 'Secretaria Acadêmica' }
    });
    assert(chatStartRes.status === 201, 'Aluno consegue abrir uma nova sessão de chat com a Sophia IA');
    const chatSessionId = chatStartRes.json?.id;

    // 1.4 Mensagem para Sophia IA - Pergunta FAQ
    const chatMsgRes = await request(server, `/api/chat/${chatSessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        sender: 'student',
        senderName: studentUser.name,
        text: 'Como faço para trancar uma matéria?'
      }
    });
    assert(chatMsgRes.status === 200, 'Sophia IA responde mensagem de dúvida acadêmica');
    assert(chatMsgRes.json?.botReply?.text !== undefined, 'Resposta da Sophia IA gerada com sucesso');

    // 1.5 Mensagem para Sophia IA - Gatilho de Escalonamento Humano
    const chatEscalateRes = await request(server, `/api/chat/${chatSessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        sender: 'student',
        senderName: studentUser.name,
        text: 'Não ajudou nada, preciso falar com atendente humano urgente sobre meu boleto!'
      }
    });
    assert(chatEscalateRes.status === 200, 'Mensagem com solicitação de humano é processada');
    assert(chatEscalateRes.json?.botReply?.text.includes('transferindo') || chatEscalateRes.json?.session?.status === 'waiting_human', 'Sophia IA escalou para atendimento humano corretamente');

    // 1.6 Abertura de Chamado Formal pelo Aluno
    const catsRes = await request(server, '/api/categories');
    const categoryId = catsRes.json?.[0]?.id || 'cat-1';

    const newTicketRes = await request(server, '/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        studentId: studentUser.id,
        categoryId: categoryId,
        subject: 'Solicitação de Segunda Via de Carteirinha Estudantil',
        description: 'Perdi minha carteirinha no campus norte e preciso de uma 2ª via urgente para o transporte público.',
        priority: 'high',
        origin: 'web'
      }
    });
    assert(newTicketRes.status === 201, 'Aluno consegue abrir chamado de suporte');
    const createdTicket = newTicketRes.json;
    assert(createdTicket?.id !== undefined, 'Chamado criado possui ID único');

    // 1.7 Aluno envia mensagem dentro do chamado
    const ticketMsgRes = await request(server, `/api/tickets/${createdTicket.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        senderId: studentUser.id,
        message: 'Seguem em anexo os comprovantes solicitados.'
      }
    });
    assert(ticketMsgRes.status === 201, 'Aluno envia mensagem dentro do chamado com sucesso');

    // -------------------------------------------------------------
    // FASE 2: JORNADA DO ATENDENTE / TÉCNICO
    // -------------------------------------------------------------
    console.log('\n--- [FASE 2] JORNADA DO ATENDENTE / TÉCNICO ---');

    // 2.1 Login Atendente
    const attendantLogin = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'mariana.suporte@metropolitana.edu.br', password: '123456' }
    });
    assert(attendantLogin.status === 200, 'Atendente consegue logar com credenciais institucionais');
    const attendantToken = attendantLogin.json?.token;
    const attendantUser = attendantLogin.json?.user;

    // 2.2 Visualizar fila de chamados
    const queueRes = await request(server, '/api/tickets?status=open', {
      headers: { Authorization: `Bearer ${attendantToken}` }
    });
    assert(queueRes.status === 200 && Array.isArray(queueRes.json), 'Atendente consulta fila de chamados abertos');
    const hasOurTicket = queueRes.json.some(t => t.id === createdTicket.id);
    assert(hasOurTicket, 'Chamado criado pelo aluno aparece na fila do atendente');

    // 2.3 Obter Contexto de IA do Aluno (Card de Contexto do Aluno)
    const aiContextRes = await request(server, `/api/students/${studentUser.id}/ai-context`, {
      headers: { Authorization: `Bearer ${attendantToken}` }
    });
    assert(aiContextRes.status === 200, 'Atendente consulta Card de Contexto de IA do Aluno');
    assert(aiContextRes.json?.sentiment !== undefined, 'Card de IA possui análise de sentimento');
    assert(Array.isArray(aiContextRes.json?.pointsOfAttention), 'Card de IA possui pontos de atenção acadêmicos');

    // 2.4 Atendente responde ao aluno
    const attendantReplyRes = await request(server, `/api/tickets/${createdTicket.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendantToken}`
      },
      body: {
        senderId: attendantUser.id,
        message: 'Olá Enzo, recebemos sua solicitação! A 2ª via já foi enviada para impressão.'
      }
    });
    assert(attendantReplyRes.status === 201, 'Atendente envia resposta pública ao chamado');

    // 2.5 Atendente adiciona Nota Interna (isInternalNote: true)
    const internalNoteRes = await request(server, `/api/tickets/${createdTicket.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendantToken}`
      },
      body: {
        senderId: attendantUser.id,
        message: 'Nota interna: Cobrança de taxa de R$ 15,00 isenta devido a bolsa PROUNI.',
        isInternalNote: true
      }
    });
    assert(internalNoteRes.status === 201, 'Atendente registra nota interna com sucesso');

    // 2.6 Atendente atualiza status para "resolved"
    const updateStatusRes = await request(server, `/api/tickets/${createdTicket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendantToken}`
      },
      body: {
        status: 'resolved'
      }
    });
    assert(updateStatusRes.status === 200, 'Atendente atualiza status do chamado para resolvido');
    assert(updateStatusRes.json?.status === 'resolved', 'Status confirmado como resolved');

    // 2.7 Atendente avalia o Aluno (SQL Spec)
    const rateAlunoRes = await request(server, '/api/sql/ratings/aluno', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendantToken}`
      },
      body: {
        chamadoId: createdTicket.id,
        tecnicoId: attendantUser.id,
        alunoId: studentUser.id,
        nota: 5,
        comentario: 'Aluno muito educado e prestativo.'
      }
    });
    assert(rateAlunoRes.status === 201, 'Atendente avalia a conduta do aluno no atendimento');

    // 2.8 Aluno avalia o Atendente (CSAT)
    const rateTecnicoRes = await request(server, '/api/sql/ratings/tecnico', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        chamadoId: createdTicket.id,
        alunoId: studentUser.id,
        tecnicoId: attendantUser.id,
        nota: 5,
        comentario: 'Atendimento muito ágil e eficiente!'
      }
    });
    assert(rateTecnicoRes.status === 201, 'Aluno avalia a qualidade do técnico (CSAT)');

    // -------------------------------------------------------------
    // FASE 3: JORNADA DO ADMINISTRADOR LOCAL DA INSTITUIÇÃO
    // -------------------------------------------------------------
    console.log('\n--- [FASE 3] JORNADA DO ADMINISTRADOR LOCAL ---');

    // 3.1 Login Administrador
    const adminLogin = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'roberto.ti@metropolitana.edu.br', password: '123456' }
    });
    assert(adminLogin.status === 200, 'Administrador local da faculdade autentica com sucesso');
    const adminToken = adminLogin.json?.token;
    const adminUser = adminLogin.json?.user;

    // 3.2 Consulta a Métricas Administrativas
    const metricsRes = await request(server, '/api/admin/metrics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(metricsRes.status === 200, 'Admin acessa métricas gerenciais e SLAs');
    assert(metricsRes.json?.totalTickets !== undefined, 'Métricas contêm total de chamados');

    // 3.3 Consulta a Logs de Auditoria do Administrador
    const auditLogsRes = await request(server, '/api/sql/logs-admin', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(auditLogsRes.status === 200 && Array.isArray(auditLogsRes.json), 'Admin acessa logs de auditoria do sistema');

    // 3.4 Customização de Branding e White-Label
    const brandingUpdateRes = await request(server, '/api/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        name: 'Centro Universitário Metropolitano Teste',
        tagline: 'Portal do Aluno e Suporte Integrado',
        primaryColor: '#0f766e',
        secondaryColor: '#0284c7',
        accentColor: '#eab308'
      }
    });
    assert(brandingUpdateRes.status === 200, 'Admin atualiza configuração de Branding/White-Label');
    assert(brandingUpdateRes.json?.config?.name === 'Centro Universitário Metropolitano Teste', 'Nome da instituição atualizado');

    // 3.5 Cadastro de Novo Usuário pelo Admin
    const uniqueTs = Date.now();
    const newUserRes = await request(server, '/api/sql/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        adminId: adminUser.id,
        nomeCompleto: 'Beatriz Vasconcelos',
        cpf: `999${String(uniqueTs).slice(-8)}`,
        email: `beatriz.${uniqueTs}@aluno.metropolitana.edu.br`,
        role: 'aluno',
        extra: { curso: 'Arquitetura', matricula: `2026${String(uniqueTs).slice(-4)}` }
      }
    });
    assert(newUserRes.status === 201, 'Admin cadastra novo usuário com perfil e dados extras');
    const createdUserId = newUserRes.json?.id;

    // 3.6 Reset de Senha de Usuário pelo Admin
    const resetPassRes = await request(server, `/api/sql/users/${createdUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        adminId: adminUser.id,
        novoHash: 'scrypt:teste_novo_hash'
      }
    });
    assert(resetPassRes.status === 200, 'Admin redefine senha de usuário com registro em log');

    // 3.7 Inativação (Soft Delete) de Usuário pelo Admin
    const inactivateRes = await request(server, `/api/sql/users/${createdUserId}/inactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        adminId: adminUser.id
      }
    });
    assert(inactivateRes.status === 200, 'Admin inativa usuário (Soft Delete) com sucesso');

    // 3.8 Teste de Criação de Backup Transacional SQLite
    const backupRes = await backupService.createBackup();
    assert(backupRes.success === true, 'Admin gera backup criptografado/comprimido do SQLite com sucesso');

    // 3.9 Admin abre Chamado Técnico para o Fornecedor SaaS (Control Plane)
    const vendorTicketRes = await request(server, '/api/admin/support/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        title: 'Dúvida sobre integração do gateway de pagamento',
        category: 'INTEGRACAO',
        description: 'Gostaríamos de validar a documentação para conciliação bancária automática.',
        priority: 'NORMAL'
      }
    });
    assert(vendorTicketRes.status === 201, 'Admin despacha chamado com telemetria higienizada para a Central SaaS');

    // -------------------------------------------------------------
    // FASE 4: BMAD SPEC — LICENCIAMENTO, TOLERÂNCIA 15 DIAS E BLOQUEIO
    // -------------------------------------------------------------
    console.log('\n--- [FASE 4] CONFORMIDADE BMAD (SPEC LICENCIAMENTO & REGRAS AD-1 A AD-6) ---');

    // 4.1 Consulta de Status de Licença
    const licStatusRes = await request(server, '/api/licensing/status');
    assert(licStatusRes.status === 200, 'Endpoint /api/licensing/status acessível');
    assert(licStatusRes.json?.data?.status !== undefined, 'Status da licença retornado');

    // 4.2 Simulação de GRACE_PERIOD (Dias 1 a 15 de Atraso)
    const simGraceRes = await request(server, '/api/licensing/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        status: 'GRACE_PERIOD',
        daysInGrace: 5
      }
    });
    assert(simGraceRes.status === 200, 'Simulação de tolerância (Grace Period) acionada');

    // 4.3 Verificação de operação durante Grace Period: Aluno deve continuar operando!
    const studentInGraceRes = await request(server, '/api/tickets', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(studentInGraceRes.status === 200, 'Durante Grace Period (dias 1-15), portal do aluno continua 100% operacional');

    // 4.4 Verificação de aviso exclusivo para Administrador durante Grace Period
    const adminInGraceRes = await request(server, '/api/admin/metrics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminInGraceRes.status === 200, 'Admin acessa o sistema normalmente durante Grace Period');
    assert(adminInGraceRes.headers['x-license-warning'] === 'GRACE_PERIOD_ACTIVE', 'Header X-License-Warning injetado para notificar admin');

    // 4.5 Simulação de BLOQUEIO TOTAL (Dia 16+ de Atraso - LOCKED)
    const simLockRes = await request(server, '/api/licensing/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        status: 'LOCKED',
        daysInGrace: 16
      }
    });
    assert(simLockRes.status === 200, 'Simulação de Bloqueio Total (LOCKED dia 16+) acionada');

    // 4.6 Aluno tenta criar chamado durante Bloqueio Total: DEVE RETORNAR HTTP 402 PAYMENT REQUIRED!
    const blockedTicketRes = await request(server, '/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        studentId: studentUser.id,
        categoryId: categoryId,
        subject: 'Chamado em Bloqueio',
        description: 'Tentativa de chamado quando sistema está locked.',
        priority: 'low'
      }
    });
    assert(blockedTicketRes.status === 402, 'Rotas operacionais bloqueadas com HTTP 402 Payment Required quando LOCKED');
    assert(blockedTicketRes.json?.code === 'LICENSE_LOCKED', 'Código de erro retornado é LICENSE_LOCKED');
    assert(blockedTicketRes.json?.invoice?.pixQrCode !== undefined, 'Payload do erro 402 inclui dados de fatura Pix para regularização imediata');

    // 4.7 Rotas permitidas para regularização durante Bloqueio Total
    const allowedLicStatusRes = await request(server, '/api/licensing/status');
    assert(allowedLicStatusRes.status === 200, 'Rota /api/licensing/status continua acessível para verificação da fatura');

    const allowedHealthRes = await request(server, '/api/health');
    assert(allowedHealthRes.status === 200, 'Rota /api/health continua acessível durante o bloqueio');

    const allowedLoginRes = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'roberto.ti@metropolitana.edu.br', password: '123456' }
    });
    assert(allowedLoginRes.status === 200, 'Rota /api/auth/login continua acessível para login do administrador');

    // 4.8 Restauração da Licença para ACTIVE
    const simRestoreRes = await request(server, '/api/licensing/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        status: 'ACTIVE'
      }
    });
    assert(simRestoreRes.status === 200, 'Licença restaurada com sucesso para status ACTIVE');

    // 4.9 Aluno consegue criar chamado novamente após regularização
    const postRestoreTicketRes = await request(server, '/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        studentId: studentUser.id,
        categoryId: categoryId,
        subject: 'Chamado Pós Desbloqueio',
        description: 'Sistema normalizado com sucesso.',
        priority: 'low'
      }
    });
    assert(postRestoreTicketRes.status === 201, 'Operação de alunos restaurada imediatamente após quitação');

  } catch (err) {
    console.error('ERRO INESPERADO NA EXECUÇÃO DOS TESTES:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`BATERIA DE TESTES FINALIZADA`);
  console.log(`TOTAL DE TESTES EXECUTADOS: ${passed + failed}`);
  console.log(`✓ APROVADOS: ${passed}`);
  console.log(`✗ REPROVADOS: ${failed}`);
  console.log('======================================================');

  if (issuesFound.length > 0) {
    console.log('\nFalhas encontradas:', issuesFound);
  }
}

runClientTests();
