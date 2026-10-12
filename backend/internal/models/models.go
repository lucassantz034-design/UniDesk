package models

import "time"

// InstitutionConfig holds the white-label and branding configuration
type InstitutionConfig struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	Tagline              string `json:"tagline"`
	PrimaryColor         string `json:"primaryColor"`
	SecondaryColor       string `json:"secondaryColor"`
	AccentColor          string `json:"accentColor"`
	LogoURL              string `json:"logoUrl"`
	AIProvider           string `json:"aiProvider"`
	AIApiKey             string `json:"aiApiKey"`
	AIModel              string `json:"aiModel"`
	AICustomInstructions string `json:"aiCustomInstructions"`
	LicenseKey           string `json:"licenseKey"`
	Version              string `json:"version"`
}

// User represents an academic community member (student, attendant, admin)
type User struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	CPF        string `json:"cpf,omitempty"`
	Role       string `json:"role"` // "student" | "attendant" | "admin" | "aluno" | "tecnico" | "admin_faculdade"
	Department string `json:"department,omitempty"`
	RA         string `json:"ra,omitempty"`
	Course     string `json:"course,omitempty"`
	Period     string `json:"period,omitempty"`
	Phone      string `json:"phone,omitempty"`
	Avatar     string `json:"avatar"`
	Ativo      bool   `json:"ativo"`
	CreatedAt  string `json:"createdAt,omitempty"`
}

// Category represents a support category / department
type Category struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	SLAHours        int    `json:"slaHours"`
	DefaultPriority string `json:"defaultPriority"`
	Icon            string `json:"icon,omitempty"`
}

// TicketMessage represents a message or note inside a ticket
type TicketMessage struct {
	ID             string   `json:"id"`
	SenderID       string   `json:"senderId"`
	SenderName     string   `json:"senderName"`
	SenderRole     string   `json:"senderRole"`
	Message        string   `json:"message"`
	IsInternalNote bool     `json:"isInternalNote"`
	Attachments    []string `json:"attachments"`
	CreatedAt      string   `json:"createdAt"`
}

// Ticket represents a support request
type Ticket struct {
	ID              string          `json:"id"`
	TicketNumber    int             `json:"ticketNumber"`
	StudentID       string          `json:"studentId"`
	StudentName     string          `json:"studentName,omitempty"`
	StudentRA       string          `json:"studentRa,omitempty"`
	StudentCourse   string          `json:"studentCourse,omitempty"`
	AttendantID     string          `json:"attendantId"`
	AttendantName   string          `json:"attendantName,omitempty"`
	CategoryID      string          `json:"categoryId"`
	CategoryName    string          `json:"categoryName,omitempty"`
	Subject         string          `json:"subject"`
	Description     string          `json:"description"`
	Status          string          `json:"status"` // "open", "in_progress", "resolved", "cancelled"
	Priority        string          `json:"priority"` // "low", "medium", "high", "urgent"
	Origin          string          `json:"origin"` // "portal", "chat", "email"
	SLADueAt        string          `json:"slaDueAt"`
	FirstResponseAt *string         `json:"firstResponseAt"`
	ResolvedAt      *string         `json:"resolvedAt"`
	CSATScore       *int            `json:"csatScore"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
	Messages        []TicketMessage `json:"messages"`
}

// ChatMessage represents a single message in live chat / Sophia chatbot
type ChatMessage struct {
	ID        string `json:"id"`
	Sender    string `json:"sender"` // "student", "attendant", "bot"
	SenderName string `json:"senderName"`
	Text      string `json:"text"`
	Timestamp string `json:"timestamp"`
}

// ChatSession represents an active or past chat session
type ChatSession struct {
	ID          string        `json:"id"`
	StudentID   string        `json:"studentId"`
	StudentName string        `json:"studentName"`
	Department  string        `json:"department"`
	Status      string        `json:"status"` // "bot", "waiting_agent", "active", "closed"
	CreatedAt   string        `json:"createdAt"`
	Messages    []ChatMessage `json:"messages"`
}

// KnowledgeBaseArticle represents an entry in the FAQ / Knowledge base
type KnowledgeBaseArticle struct {
	ID           string `json:"id"`
	CategoryID   string `json:"categoryId"`
	Title        string `json:"title"`
	Snippet      string `json:"snippet"`
	Content      string `json:"content"`
	IsPublic     bool   `json:"isPublic"`
	Views        int    `json:"views"`
	HelpfulVotes int    `json:"helpfulVotes"`
}

// AIStudentContext holds synthesized insights for attendants
type AIStudentContext struct {
	Summary           string   `json:"summary"`
	PointsOfAttention []string `json:"pointsOfAttention"`
	Sentiment         string   `json:"sentiment"`
	SentimentScore    string   `json:"sentimentScore"` // "positive", "warning", "negative"
	RecommendedAction string   `json:"recommendedAction"`
}

// Metrics represents admin operational statistics
type Metrics struct {
	TotalTickets              int            `json:"totalTickets"`
	OpenTickets               int            `json:"openTickets"`
	InProgressTickets         int            `json:"inProgressTickets"`
	ResolvedTickets           int            `json:"resolvedTickets"`
	SLACompliancePercent      float64        `json:"slaCompliancePercent"`
	AverageCSAT               string         `json:"averageCsat"`
	AverageFirstResponseHours float64        `json:"averageFirstResponseHours"`
	ByCategory                map[string]int `json:"byCategory"`
}

// AdminLog represents an audit log entry
type AdminLog struct {
	ID              string    `json:"id"`
	AdminID         string    `json:"admin_id"`
	AdminNome       string    `json:"admin_nome"`
	UsuarioAlvoID   string    `json:"usuario_alvo_id"`
	UsuarioAlvoNome string    `json:"usuario_alvo_nome"`
	Acao            string    `json:"acao"`
	CriadoEm        time.Time `json:"criado_em"`
}
