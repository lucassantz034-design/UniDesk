import { db } from './db.js';

export class AIService {
  /**
   * Generates or refreshes the AI Context Card for a student
   * Used by the attendant to immediately understand the student's background, sentiment, and risks
   */
  static async getOrGenerateStudentContext(studentId) {
    const cached = db.getAIStudentContext(studentId);
    if (cached) return cached;

    const student = db.getUserById(studentId);
    if (!student) return null;

    const tickets = db.getTickets({ studentId });
    
    // Heuristic contextual generation
    let sentiment = "Tranquilo / Normal";
    let sentimentScore = "positive";
    const pointsOfAttention = [];

    const urgentCount = tickets.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
    const unresolvedCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

    if (urgentCount >= 2 || unresolvedCount >= 2) {
      sentiment = "Ansioso / Problemas Técnicos Recorrentes";
      sentimentScore = "warning";
      pointsOfAttention.push(`Possui ${unresolvedCount} chamados simultâneos de T.I. aguardando tratativa.`);
    }

    const subjects = tickets.map(t => (t.subject || '').toLowerCase()).join(' ');
    if (subjects.includes('moodle') || subjects.includes('ava') || subjects.includes('403')) {
      pointsOfAttention.push("Histórico recente de travamento de sessão no AVA Moodle.");
    }
    if (subjects.includes('wifi') || subjects.includes('rede') || subjects.includes('eduroam')) {
      pointsOfAttention.push("Problemas recorrentes de autenticação 802.1X na rede sem fio.");
    }
    if (pointsOfAttention.length === 0) {
      pointsOfAttention.push("Aluno sem ocorrências críticas recentes de T.I.");
    }

    const summary = `Aluno de ${student.course || 'graduação'} (RA: ${student.ra || 'N/A'}). ` +
      `Registrou um total de ${tickets.length} chamados de T.I. no sistema. ` +
      `Atualmente com ${unresolvedCount} chamados ativos.`;

    const recommendedAction = unresolvedCount > 0 
      ? "Sugerir execução de Auto-Reparo ou escalar para técnico de infraestrutura."
      : "Fornecer orientações técnicas claras e confirmar status de conectividade.";

    const context = {
      summary,
      pointsOfAttention,
      sentiment,
      sentimentScore,
      recommendedAction
    };

    db.setAIStudentContext(studentId, context);
    return context;
  }

  /**
   * Process a student's message in the automated Chatbot
   * Tries to detect auto-repair opportunities, answers via Knowledge Base, and triggers human escalation when appropriate
   */
  static async handleChatbotTurn(sessionId, userMessage) {
    const text = userMessage.trim().toLowerCase();
    const config = db.getConfig();

    // 1. Detecção Inteligente de Auto-Reparo (Self-Healing TI)
    if (text.includes('moodle') || text.includes('ava') || text.includes('403') || text.includes('sessão') || text.includes('travou')) {
      return {
        escalated: false,
        autoRepairAction: 'unlock_moodle',
        response: '⚠️ **Possível travamento de sessão no AVA Moodle detectado!**\n\nNosso sistema possui uma rotina de **Auto-Reparo de Sessão do Moodle** que encerra processos travados em segundo plano, purga o cache de autenticação e resolve o Erro 403 instantaneamente.\n\n👉 Você pode acionar o botão **"Desbloquear Sessão Moodle"** no topo do seu Portal do Aluno para normalizar seu acesso em 5 segundos!'
      };
    }

    if (text.includes('senha') || text.includes('esqueci') || text.includes('bloqueada') || text.includes('não consigo logar') || text.includes('portal')) {
      return {
        escalated: false,
        autoRepairAction: 'reset_password',
        response: '🔑 **Bloqueio de credenciais identificado!**\n\nSe a sua conta foi suspensa por tentativas de login, utilize o **Auto-Reparo de Credenciais & Desbloqueio** no painel superior. Ele zera o contador de bloqueios e gera um token de acesso imediato sem necessidade de fila.'
      };
    }

    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('internet') || text.includes('eduroam') || text.includes('rede')) {
      return {
        escalated: false,
        autoRepairAction: 'diagnose_wifi',
        response: '📶 **Diagnóstico de Conectividade & Wi-Fi**\n\nPara falhas de conexão na rede sem fio dos campi, execute o **Diagnóstico de Wi-Fi** no seu portal. Ele verifica as rotas dos gateways institucionais e reemite os certificados 802.1X PEAP/MSCHAPv2.'
      };
    }

    // 2. Check if student requested human support
    const escalationTriggers = [
      'falar com atendente', 'humano', 'pessoa', 'atendente', 'suporte humano',
      'não ajudou', 'não resolveu', 'quero falar com alguém', 'reclamação',
      'urgente', 'chamado', 'técnico'
    ];

    const needsEscalation = escalationTriggers.some(trigger => text.includes(trigger));

    if (needsEscalation) {
      const dept = "Suporte de T.I.";
      db.escalateChatSession(sessionId, dept);
      return {
        escalated: true,
        department: dept,
        response: `Compreendo a necessidade de um suporte especializado. Já estou transferindo sua solicitação para a equipe de **${dept}**. Um analista técnico responderá nesta mesma tela!`
      };
    }

    // 3. Try finding relevant Knowledge Base articles
    const kbResults = db.getKnowledgeBase(userMessage);

    if (kbResults.length > 0) {
      const bestMatch = kbResults[0];
      const response = `Com base na base técnica do **${config.name}**, encontrei a seguinte orientação:\n\n` +
        `### ${bestMatch.title}\n\n` +
        `${bestMatch.content.replace(/\\n/g, '\n')}\n\n` +
        `*Essa instrução técnica resolveu seu problema ou deseja que eu transfira para um técnico de T.I.?*`;

      return {
        escalated: false,
        articleId: bestMatch.id,
        response
      };
    }

    // 4. Resposta técnica padrão
    const genericResponse = `Entendi sua solicitação sobre **"${userMessage}"**. Como assistente técnico do UniDesk, posso orientar você com rotinas de **Auto-Reparo de T.I.** ou abrir um chamado formal para nossa equipe de suporte. Gostaria de abrir um chamado técnico agora?`;

    return {
      escalated: false,
      response: genericResponse
    };
  }
}
