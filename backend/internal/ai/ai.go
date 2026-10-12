package ai

import (
	"fmt"
	"strings"

	"unidesk/internal/db"
	"unidesk/internal/models"
)

type AIService struct {
	database *db.Database
}

func NewAIService(database *db.Database) *AIService {
	return &AIService{database: database}
}

// GetOrGenerateStudentContext provides executive academic context for attendants
func (s *AIService) GetOrGenerateStudentContext(studentID string) (*models.AIStudentContext, error) {
	cached := s.database.GetAIStudentContext(studentID)
	if cached != nil {
		return cached, nil
	}

	user := s.database.GetUserByID(studentID)
	if user == nil {
		return nil, fmt.Errorf("aluno não encontrado")
	}

	tickets := s.database.GetTickets(studentID, "", "", "")

	sentiment := "Tranquilo / Normal"
	sentimentScore := "positive"
	var pointsOfAttention []string

	urgentCount := 0
	unresolvedCount := 0
	var allSubjects []string

	for _, t := range tickets {
		if t.Priority == "urgent" || t.Priority == "high" {
			urgentCount++
		}
		if t.Status == "open" || t.Status == "in_progress" {
			unresolvedCount++
		}
		allSubjects = append(allSubjects, strings.ToLower(t.Subject))
	}

	if urgentCount >= 2 || unresolvedCount >= 2 {
		sentiment = "Ansioso / Preocupado com Prazos"
		sentimentScore = "warning"
		pointsOfAttention = append(pointsOfAttention, fmt.Sprintf("Possui %d chamados simultâneos aguardando tratativa.", unresolvedCount))
	}

	joinedSubjects := strings.Join(allSubjects, " ")
	if strings.Contains(joinedSubjects, "boleto") || strings.Contains(joinedSubjects, "mensalidade") || strings.Contains(joinedSubjects, "bolsa") {
		pointsOfAttention = append(pointsOfAttention, "Histórico recente de dúvidas financeiras ou validação de bolsa.")
	}
	if strings.Contains(joinedSubjects, "tcc") || strings.Contains(joinedSubjects, "horas") || strings.Contains(joinedSubjects, "matrícula") {
		pointsOfAttention = append(pointsOfAttention, "Assunto crítico para conclusão ou regularidade de semestre acadêmico.")
	}
	if len(pointsOfAttention) == 0 {
		pointsOfAttention = append(pointsOfAttention, "Aluno sem ocorrências críticas recentes.")
	}

	summary := fmt.Sprintf("Aluno de %s (RA: %s). Registrou um total de %d chamados no sistema. Atualmente com %d chamados ativos.",
		user.Course, user.RA, len(tickets), unresolvedCount)

	recommendedAction := "Fornecer orientações claras e cordiais pelo canal preferido."
	if unresolvedCount > 0 {
		recommendedAction = "Priorizar resolução coordenada para evitar reincidência de contatos."
	}

	ctx := models.AIStudentContext{
		Summary:           summary,
		PointsOfAttention: pointsOfAttention,
		Sentiment:         sentiment,
		SentimentScore:    sentimentScore,
		RecommendedAction: recommendedAction,
	}

	s.database.SetAIStudentContext(studentID, ctx)
	return &ctx, nil
}

// HandleChatbotTurn processes Sophia AI responses and triggers escalation
func (s *AIService) HandleChatbotTurn(sessionID, userMessage string) (bool, string, string) {
	text := strings.ToLower(strings.TrimSpace(userMessage))
	config := s.database.GetConfig()

	escalationTriggers := []string{
		"falar com atendente", "humano", "pessoa", "atendente", "suporte humano",
		"não ajudou", "não resolveu", "quero falar com alguém", "reclamação",
		"urgente", "processo", "advogado", "ouvidoria",
	}

	needsEscalation := false
	for _, trigger := range escalationTriggers {
		if strings.Contains(text, trigger) {
			needsEscalation = true
			break
		}
	}

	if needsEscalation {
		dept := "Secretaria Acadêmica"
		if strings.Contains(text, "boleto") || strings.Contains(text, "dinheiro") || strings.Contains(text, "financeiro") || strings.Contains(text, "prouni") {
			dept = "Financeiro & Bolsas"
		} else if strings.Contains(text, "moodle") || strings.Contains(text, "senha") || strings.Contains(text, "ava") || strings.Contains(text, "login") {
			dept = "Suporte AVA & TI"
		}

		s.database.EscalateChatSession(sessionID, dept)
		reply := fmt.Sprintf("Compreendo a necessidade de um suporte especializado. Já estou transferindo sua solicitação para a equipe do setor **%s**. Um atendente humano responderá nesta mesma tela!", dept)
		return true, dept, reply
	}

	// Try Knowledge Base
	kbResults := s.database.GetKnowledgeBase(userMessage, "")
	if len(kbResults) > 0 {
		bestMatch := kbResults[0]
		reply := fmt.Sprintf("Com base nas normas da **%s**, encontrei a seguinte orientação:\n\n### %s\n\n%s\n\n*Essa resposta tirou sua dúvida ou você gostaria de falar com um atendente humano?*",
			config.Name, bestMatch.Title, bestMatch.Content)
		return false, "", reply
	}

	// Generic assistant reply
	reply := fmt.Sprintf("Entendi sua dúvida sobre \"%s\". Como o procedimento pode variar dependendo do seu curso e semestre, você prefere que eu abra um chamado formal para a Secretaria Acadêmica ou transfira para um atendente humano agora?", userMessage)
	return false, "", reply
}
