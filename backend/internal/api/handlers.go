package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"unidesk/internal/ai"
	"unidesk/internal/db"
	"unidesk/internal/models"
	"unidesk/internal/ws"
)

type Server struct {
	db        *db.Database
	ai        *ai.AIService
	hub       *ws.Hub
	startTime time.Time
}

func NewServer(database *db.Database, aiService *ai.AIService, hub *ws.Hub) *Server {
	return &Server{
		db:        database,
		ai:        aiService,
		hub:       hub,
		startTime: time.Now(),
	}
}

func (s *Server) jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func (s *Server) errorResponse(w http.ResponseWriter, status int, message string) {
	s.jsonResponse(w, status, map[string]string{"error": message})
}

// Router dispatches API requests based on method and path
func (s *Server) HandleAPI(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api")

	// Config
	if path == "/config" {
		if r.Method == http.MethodGet {
			s.jsonResponse(w, http.StatusOK, s.db.GetConfig())
			return
		}
		if r.Method == http.MethodPut {
			var cfg models.InstitutionConfig
			if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
				s.errorResponse(w, http.StatusBadRequest, "Payload inválido")
				return
			}
			updated := s.db.UpdateConfig(cfg)
			s.jsonResponse(w, http.StatusOK, map[string]interface{}{"success": true, "config": updated})
			return
		}
	}

	// Health & Telemetry
	if path == "/health" && r.Method == http.MethodGet {
		cfg := s.db.GetConfig()
		s.jsonResponse(w, http.StatusOK, map[string]interface{}{
			"status":        "ok",
			"engine":        "Go (Golang)",
			"instance":      cfg.Name,
			"version":       cfg.Version,
			"uptimeSeconds": int(time.Since(s.startTime).Seconds()),
			"timestamp":     time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	if path == "/telemetry/heartbeat" && r.Method == http.MethodPost {
		cfg := s.db.GetConfig()
		metrics := s.db.GetMetrics()
		payload := map[string]interface{}{
			"licenseKey":           cfg.LicenseKey,
			"instanceVersion":      cfg.Version,
			"institutionName":      cfg.Name,
			"totalTickets":         metrics.TotalTickets,
			"slaCompliancePercent": metrics.SLACompliancePercent,
			"status":               "healthy",
			"transmittedAt":        time.Now().UTC().Format(time.RFC3339),
		}
		s.jsonResponse(w, http.StatusOK, map[string]interface{}{
			"verified": true,
			"message":  "Licença Self-Hosted ativa e válida (Go Core).",
			"payload":  payload,
		})
		return
	}

	// Categories
	if path == "/categories" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetCategories())
		return
	}

	// Users
	if path == "/users" {
		if r.Method == http.MethodGet {
			role := r.URL.Query().Get("role")
			s.jsonResponse(w, http.StatusOK, s.db.GetUsers(role))
			return
		}
		if r.Method == http.MethodPost {
			var u models.User
			if err := json.NewDecoder(r.Body).Decode(&u); err != nil || u.Name == "" || u.Email == "" {
				s.errorResponse(w, http.StatusBadRequest, "Nome e E-mail são obrigatórios")
				return
			}
			created := s.db.AddUser(u)
			s.jsonResponse(w, http.StatusCreated, created)
			return
		}
	}

	if strings.HasPrefix(path, "/users/") && r.Method == http.MethodGet {
		id := strings.TrimPrefix(path, "/users/")
		user := s.db.GetUserByID(id)
		if user == nil {
			s.errorResponse(w, http.StatusNotFound, "Usuário não encontrado")
			return
		}
		s.jsonResponse(w, http.StatusOK, user)
		return
	}

	// Tickets
	if path == "/tickets" {
		if r.Method == http.MethodGet {
			stuID := r.URL.Query().Get("studentId")
			attID := r.URL.Query().Get("attendantId")
			status := r.URL.Query().Get("status")
			catID := r.URL.Query().Get("categoryId")
			s.jsonResponse(w, http.StatusOK, s.db.GetTickets(stuID, attID, status, catID))
			return
		}
		if r.Method == http.MethodPost {
			var req struct {
				StudentID   string   `json:"studentId"`
				CategoryID  string   `json:"categoryId"`
				Subject     string   `json:"subject"`
				Description string   `json:"description"`
				Priority    string   `json:"priority"`
				Origin      string   `json:"origin"`
				Attachments []string `json:"attachments"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.StudentID == "" || req.CategoryID == "" || req.Subject == "" || req.Description == "" {
				s.errorResponse(w, http.StatusBadRequest, "Preencha todos os campos obrigatórios")
				return
			}
			tkt := s.db.CreateTicket(req.StudentID, req.CategoryID, req.Subject, req.Description, req.Priority, req.Origin, req.Attachments)
			s.hub.BroadcastJSON(map[string]interface{}{
				"type":   "TICKET_UPDATE",
				"action": "created",
				"ticket": tkt,
			})
			s.jsonResponse(w, http.StatusCreated, tkt)
			return
		}
	}

	// Specific Ticket Routes: /tickets/:id, /tickets/:id/messages, /tickets/:id/status
	if strings.HasPrefix(path, "/tickets/") {
		parts := strings.Split(strings.TrimPrefix(path, "/tickets/"), "/")
		ticketID := parts[0]

		if len(parts) == 1 {
			if r.Method == http.MethodGet {
				tkt := s.db.GetTicketByID(ticketID)
				if tkt == nil {
					s.errorResponse(w, http.StatusNotFound, "Chamado não encontrado")
					return
				}
				s.jsonResponse(w, http.StatusOK, tkt)
				return
			}
		}

		if len(parts) == 2 && parts[1] == "messages" && r.Method == http.MethodPost {
			var req struct {
				SenderID       string   `json:"senderId"`
				Message        string   `json:"message"`
				IsInternalNote bool     `json:"isInternalNote"`
				Attachments    []string `json:"attachments"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SenderID == "" || req.Message == "" {
				s.errorResponse(w, http.StatusBadRequest, "Remetente e mensagem são obrigatórios")
				return
			}
			msg := s.db.AddTicketMessage(ticketID, req.SenderID, req.Message, req.IsInternalNote, req.Attachments)
			if msg == nil {
				s.errorResponse(w, http.StatusNotFound, "Chamado não encontrado")
				return
			}
			s.hub.BroadcastJSON(map[string]interface{}{
				"type":     "CHAT_MESSAGE",
				"ticketId": ticketID,
				"message":  msg,
			})
			s.jsonResponse(w, http.StatusCreated, msg)
			return
		}

		if len(parts) == 2 && parts[1] == "status" && (r.Method == http.MethodPatch || r.Method == http.MethodPut) {
			var req struct {
				Status    string `json:"status"`
				CSATScore *int   `json:"csatScore"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Status == "" {
				s.errorResponse(w, http.StatusBadRequest, "Status é obrigatório")
				return
			}
			updated := s.db.UpdateTicketStatus(ticketID, req.Status, req.CSATScore)
			if updated == nil {
				s.errorResponse(w, http.StatusNotFound, "Chamado não encontrado")
				return
			}
			s.hub.BroadcastJSON(map[string]interface{}{
				"type":   "TICKET_UPDATE",
				"action": "status_change",
				"ticket": updated,
			})
			s.jsonResponse(w, http.StatusOK, updated)
			return
		}
	}

	// AI Student Context: /students/:id/ai-context
	if strings.HasPrefix(path, "/students/") && strings.HasSuffix(path, "/ai-context") && r.Method == http.MethodGet {
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/students/"), "/ai-context")
		ctx, err := s.ai.GetOrGenerateStudentContext(id)
		if err != nil || ctx == nil {
			s.errorResponse(w, http.StatusNotFound, "Contexto de IA não encontrado para o aluno")
			return
		}
		s.jsonResponse(w, http.StatusOK, ctx)
		return
	}

	// FAQ
	if path == "/faq" && r.Method == http.MethodGet {
		search := r.URL.Query().Get("search")
		catID := r.URL.Query().Get("categoryId")
		s.jsonResponse(w, http.StatusOK, s.db.GetKnowledgeBase(search, catID))
		return
	}

	// Chat Sessions
	if path == "/chat/sessions" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetChatSessions())
		return
	}

	if strings.HasPrefix(path, "/chat/sessions/") && r.Method == http.MethodGet {
		id := strings.TrimPrefix(path, "/chat/sessions/")
		sess := s.db.GetChatSession(id)
		if sess == nil {
			s.errorResponse(w, http.StatusNotFound, "Sessão não encontrada")
			return
		}
		s.jsonResponse(w, http.StatusOK, sess)
		return
	}

	if path == "/chat/start" && r.Method == http.MethodPost {
		var req struct {
			StudentID  string `json:"studentId"`
			Department string `json:"department"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		sess := s.db.CreateChatSession(req.StudentID, req.Department)
		s.jsonResponse(w, http.StatusCreated, sess)
		return
	}

	if strings.HasPrefix(path, "/chat/") {
		parts := strings.Split(strings.TrimPrefix(path, "/chat/"), "/")
		sessID := parts[0]

		if len(parts) == 2 && parts[1] == "messages" && r.Method == http.MethodPost {
			var req struct {
				Sender     string `json:"sender"`
				SenderName string `json:"senderName"`
				Text       string `json:"text"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Text == "" {
				s.errorResponse(w, http.StatusBadRequest, "Texto da mensagem é obrigatório")
				return
			}

			sess := s.db.GetChatSession(sessID)
			if sess == nil {
				s.errorResponse(w, http.StatusNotFound, "Sessão de chat não encontrada")
				return
			}

			userMsg := s.db.AddChatMessage(sessID, req.Sender, req.SenderName, req.Text)

			var botReply *models.ChatMessage
			if sess.Status == "bot" && (req.Sender == "student" || req.Sender == "aluno" || req.Sender == "") {
				_, _, botText := s.ai.HandleChatbotTurn(sessID, req.Text)
				cfg := s.db.GetConfig()
				botName := strings.Split(cfg.Name, " ")[0] + " Bot Sophia"
				botReply = s.db.AddChatMessage(sessID, "bot", botName, botText)
			}

			updatedSess := s.db.GetChatSession(sessID)

			s.hub.BroadcastJSON(map[string]interface{}{
				"type":      "CHAT_MESSAGE",
				"sessionId": sessID,
				"message":   userMsg,
				"botReply":  botReply,
			})

			s.jsonResponse(w, http.StatusOK, map[string]interface{}{
				"userMessage": userMsg,
				"botReply":    botReply,
				"session":     updatedSess,
			})
			return
		}

		if len(parts) == 2 && parts[1] == "escalate" && r.Method == http.MethodPost {
			var req struct {
				Department string `json:"department"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			updated := s.db.EscalateChatSession(sessID, req.Department)
			if updated == nil {
				s.errorResponse(w, http.StatusNotFound, "Sessão não encontrada")
				return
			}
			s.hub.BroadcastJSON(map[string]interface{}{
				"type":      "TICKET_UPDATE",
				"action":    "chat_escalated",
				"sessionId": sessID,
				"session":   updated,
			})
			s.jsonResponse(w, http.StatusOK, updated)
			return
		}
	}

	// Admin Metrics
	if path == "/admin/metrics" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetMetrics())
		return
	}

	// SQL Spec Endpoints
	if path == "/sql/chamados/stats" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, map[string]interface{}{
			"chamados_abertos_tempo_real": s.db.GetChamadosAbertosTempoReal(),
			"chamados_resolvidos_count":   s.db.GetChamadosResolvidosCount(),
		})
		return
	}

	if path == "/sql/tecnicos-rating" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetNotaMediaTecnicos())
		return
	}

	if path == "/sql/alunos-rating" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetNotaMediaAlunos())
		return
	}

	if path == "/sql/users-by-role" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetUsers(""))
		return
	}

	if path == "/sql/logs-admin" && r.Method == http.MethodGet {
		s.jsonResponse(w, http.StatusOK, s.db.GetLogsAdmin())
		return
	}

	if path == "/sql/users" && r.Method == http.MethodPost {
		var req struct {
			AdminID      string                 `json:"adminId"`
			NomeCompleto string                 `json:"nomeCompleto"`
			CPF          string                 `json:"cpf"`
			Email        string                 `json:"email"`
			Role         string                 `json:"role"`
			Extra        map[string]interface{} `json:"extra"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.NomeCompleto == "" || req.CPF == "" || req.Email == "" || req.Role == "" {
			s.errorResponse(w, http.StatusBadRequest, "Campos obrigatórios ausentes")
			return
		}

		u := models.User{
			Name:  req.NomeCompleto,
			Email: req.Email,
			CPF:   req.CPF,
			Role:  req.Role,
		}
		if req.Extra != nil {
			if curso, ok := req.Extra["curso"].(string); ok {
				u.Course = curso
			}
			if mat, ok := req.Extra["matricula"].(string); ok {
				u.RA = mat
			}
			if esp, ok := req.Extra["especialidade"].(string); ok {
				u.Department = esp
			}
		}
		created := s.db.AddUser(u)
		s.jsonResponse(w, http.StatusCreated, created)
		return
	}

	if strings.HasPrefix(path, "/sql/users/") {
		parts := strings.Split(strings.TrimPrefix(path, "/sql/users/"), "/")
		userID := parts[0]

		if len(parts) == 2 && parts[1] == "reset-password" && r.Method == http.MethodPost {
			var req struct {
				AdminID  string `json:"adminId"`
				NovoHash string `json:"novoHash"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			res, err := s.db.RedefinirSenha(req.AdminID, userID, req.NovoHash)
			if err != nil {
				s.errorResponse(w, http.StatusInternalServerError, err.Error())
				return
			}
			s.jsonResponse(w, http.StatusOK, res)
			return
		}

		if len(parts) == 2 && parts[1] == "inactivate" && r.Method == http.MethodPost {
			var req struct {
				AdminID string `json:"adminId"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			res, err := s.db.InativarUsuario(req.AdminID, userID)
			if err != nil {
				s.errorResponse(w, http.StatusInternalServerError, err.Error())
				return
			}
			s.jsonResponse(w, http.StatusOK, res)
			return
		}
	}

	if path == "/sql/ratings/tecnico" && r.Method == http.MethodPost {
		var req struct {
			ChamadoID  string `json:"chamadoId"`
			AlunoID    string `json:"alunoId"`
			TecnicoID  string `json:"tecnicoId"`
			Nota       int    `json:"nota"`
			Comentario string `json:"comentario"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ChamadoID == "" || req.AlunoID == "" || req.TecnicoID == "" || req.Nota == 0 {
			s.errorResponse(w, http.StatusBadRequest, "Campos obrigatórios ausentes")
			return
		}
		res, err := s.db.AvaliarTecnico(req.ChamadoID, req.AlunoID, req.TecnicoID, req.Nota, req.Comentario)
		if err != nil {
			s.errorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		s.jsonResponse(w, http.StatusCreated, res)
		return
	}

	if path == "/sql/ratings/aluno" && r.Method == http.MethodPost {
		var req struct {
			ChamadoID  string `json:"chamadoId"`
			TecnicoID  string `json:"tecnicoId"`
			AlunoID    string `json:"alunoId"`
			Nota       int    `json:"nota"`
			Comentario string `json:"comentario"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ChamadoID == "" || req.TecnicoID == "" || req.AlunoID == "" || req.Nota == 0 {
			s.errorResponse(w, http.StatusBadRequest, "Campos obrigatórios ausentes")
			return
		}
		res, err := s.db.AvaliarAluno(req.ChamadoID, req.TecnicoID, req.AlunoID, req.Nota, req.Comentario)
		if err != nil {
			s.errorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		s.jsonResponse(w, http.StatusCreated, res)
		return
	}

	// 404
	s.errorResponse(w, http.StatusNotFound, "Rota não encontrada na API Unidesk")
}

func StrPtr(s string) *string {
	return &s
}

func IntPtr(i int) *int {
	return &i
}

func ParseInt(s string, defaultVal int) int {
	val, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return val
}
