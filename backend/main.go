package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"unidesk/internal/ai"
	"unidesk/internal/api"
	"unidesk/internal/db"
	"unidesk/internal/ws"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Determine data path
	dataPath := "./data"
	if _, err := os.Stat(dataPath); os.IsNotExist(err) {
		dataPath = "../data"
	}
	dataPath, _ = filepath.Abs(dataPath)

	// Initialize database
	database, err := db.NewDatabase(dataPath)
	if err != nil {
		log.Fatalf("Falha crítica ao inicializar banco: %v", err)
	}
	defer database.Close()

	// Initialize AI and WebSocket Hub
	aiService := ai.NewAIService(database)
	hub := ws.NewHub()
	go hub.Run()

	// Initialize API Server
	apiServer := api.NewServer(database, aiService, hub)

	// Determine frontend static directories
	frontendDist := "./frontend/dist"
	if _, err := os.Stat(frontendDist); os.IsNotExist(err) {
		frontendDist = "../frontend/dist"
	}
	publicDir := "./public"
	if _, err := os.Stat(publicDir); os.IsNotExist(err) {
		publicDir = "../public"
	}

	mux := http.NewServeMux()

	// 1. WebSocket Gateway
	mux.HandleFunc("/ws", hub.HandleWS)

	// 2. REST API Gateway
	mux.HandleFunc("/api/", apiServer.HandleAPI)

	// 3. Static Files & SPA Fallback
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") || r.URL.Path == "/ws" {
			return
		}

		cleanPath := filepath.Clean(r.URL.Path)

		// Check if it's looking for public assets like /assets/LOGO_UD.png
		if strings.HasPrefix(cleanPath, "/assets/") || strings.HasPrefix(cleanPath, "\\assets\\") {
			assetPath := filepath.Join(publicDir, cleanPath)
			if _, err := os.Stat(assetPath); err == nil {
				http.ServeFile(w, r, assetPath)
				return
			}
		}

		// Try frontend dist first (React production build)
		distFilePath := filepath.Join(frontendDist, cleanPath)
		if fi, err := os.Stat(distFilePath); err == nil && !fi.IsDir() {
			http.ServeFile(w, r, distFilePath)
			return
		}

		// If frontend dist index.html exists, serve for SPA routes (/aluno, /atendente, /admin, /)
		distIndex := filepath.Join(frontendDist, "index.html")
		if _, err := os.Stat(distIndex); err == nil {
			http.ServeFile(w, r, distIndex)
			return
		}

		// Fallback to legacy public files if React build not yet present
		pubFilePath := filepath.Join(publicDir, cleanPath)
		if fi, err := os.Stat(pubFilePath); err == nil && !fi.IsDir() {
			http.ServeFile(w, r, pubFilePath)
			return
		}

		// Route shortcuts for legacy public
		if cleanPath == "/aluno" {
			http.ServeFile(w, r, filepath.Join(publicDir, "index.html"))
			return
		}
		if cleanPath == "/atendente" || cleanPath == "/operador" {
			http.ServeFile(w, r, filepath.Join(publicDir, "attendant.html"))
			return
		}
		if cleanPath == "/admin" {
			http.ServeFile(w, r, filepath.Join(publicDir, "admin.html"))
			return
		}

		http.ServeFile(w, r, filepath.Join(publicDir, "index.html"))
	})

	cfg := database.GetConfig()

	fmt.Println("==================================================================")
	fmt.Println("🎓 UNIDESK — HELPDESK UNIVERSITÁRIO INTELIGENTE (GO API CORE)")
	fmt.Printf("🏛️  Instituição:           %s\n", cfg.Name)
	fmt.Printf("🚀 Servidor Go rodando em: http://localhost:%s\n", port)
	fmt.Printf("📱 Portal do Aluno:        http://localhost:%s/aluno\n", port)
	fmt.Printf("🎧 Painel do Atendente:    http://localhost:%s/atendente\n", port)
	fmt.Printf("⚙️  Painel Administrativo:  http://localhost:%s/admin\n", port)
	fmt.Printf("📡 WebSocket Gateway:      ws://localhost:%s/ws\n", port)
	fmt.Printf("🔌 REST API Base:          http://localhost:%s/api/health\n", port)
	fmt.Println("==================================================================")

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Erro no servidor HTTP Go: %v", err)
	}
}
