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
      sentiment = "Ansioso / Preocupado com Prazos";
      sentimentScore = "warning";
      pointsOfAttention.push(`Possui ${unresolvedCount} chamados simultâneos aguardando tratativa.`);
    }

    // Check financial or academic keywords in recent subjects
    const subjects = tickets.map(t => t.subject.toLowerCase()).join(' ');
    if (subjects.includes('boleto') || subjects.includes('mensalidade') || subjects.includes('bolsa')) {
      pointsOfAttention.push("Histórico recente de dúvidas financeiras ou validação de bolsa.");
    }
    if (subjects.includes('tcc') || subjects.includes('horas') || subjects.includes('matrícula')) {
      pointsOfAttention.push("Assunto crítico para conclusão ou regularidade de semestre acadêmico.");
    }
    if (pointsOfAttention.length === 0) {
      pointsOfAttention.push("Aluno sem ocorrências críticas recentes.");
    }

    const summary = `Aluno de ${student.course || 'graduação'} (RA: ${student.ra || 'N/A'}). ` +
      `Registrou um total de ${tickets.length} chamados no sistema. ` +
      `Atualmente com ${unresolvedCount} chamados ativos.`;

    const recommendedAction = unresolvedCount > 0 
      ? "Priorizar resolução coordenada para evitar reincidência de contatos."
      : "Fornecer orientações claras e cordiais pelo canal preferido.";

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
   * Tries to answer via Knowledge Base, and triggers human escalation when appropriate
   */
  static async handleChatbotTurn(sessionId, userMessage) {
    const text = userMessage.trim().toLowerCase();
    const config = db.getConfig();

    // Check if the student explicitly requested human support or feels frustrated
    const escalationTriggers = [
      'falar com atendente', 'humano', 'pessoa', 'atendente', 'suporte humano',
      'não ajudou', 'não resolveu', 'quero falar com alguém', 'reclamação',
      'urgente', 'processo', 'advogado', 'ouvidoria'
    ];

    const needsEscalation = escalationTriggers.some(trigger => text.includes(trigger));

    if (needsEscalation) {
      let dept = "Secretaria Acadêmica";
      if (text.includes('boleto') || text.includes('dinheiro') || text.includes('financeiro') || text.includes('prouni')) {
        dept = "Financeiro & Bolsas";
      } else if (text.includes('moodle') || text.includes('senha') || text.includes('ava') || text.includes('login')) {
        dept = "Suporte AVA & TI";
      }

      db.escalateChatSession(sessionId, dept);
      return {
        escalated: true,
        department: dept,
        response: `Compreendo a necessidade de um suporte especializado. Já estou transferindo sua solicitação para a equipe do setor **${dept}**. Um atendente humano responderá nesta mesma tela!`
      };
    }

    // Try finding relevant Knowledge Base articles
    const kbResults = db.getKnowledgeBase(userMessage);

    if (kbResults.length > 0) {
      const bestMatch = kbResults[0];
      const response = `Com base nas normas da **${config.name}**, encontrei a seguinte orientação:\\n\\n` +
        `### ${bestMatch.title}\\n\\n` +
        `${bestMatch.content.replace(/\\n/g, '\n')}\\n\\n` +
        `*Essa resposta tirou sua dúvida ou você gostaria de falar com um atendente humano?*`;

      return {
        escalated: false,
        articleId: bestMatch.id,
        response
      };
    }

    // Generic helpful university AI assistant response
    const genericResponse = `Entendi sua dúvida sobre *"\"${userMessage}\"*. Como a regra para esse procedimento pode variar dependendo do seu curso e semestre, você prefere que eu abra um chamado formal para a Secretaria Acadêmica ou transfira para um atendente humano agora?`;

    return {
      escalated: false,
      response: genericResponse
    };
  }
}
