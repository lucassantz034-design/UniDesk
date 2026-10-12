package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin for local development and embedded widgets
	},
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

			// Send welcome message
			welcome := map[string]interface{}{
				"type":      "WELCOME",
				"message":   "Conectado ao Unidesk Real-time Gateway (Go Engine)",
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			}
			data, _ := json.Marshal(welcome)
			_ = client.WriteMessage(websocket.TextMessage, data)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) BroadcastJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	h.broadcast <- data
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS Upgrade error: %v", err)
		return
	}

	h.register <- conn

	defer func() {
		h.unregister <- conn
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// Parse message and broadcast if relevant
		var parsed map[string]interface{}
		if err := json.Unmarshal(message, &parsed); err == nil {
			msgType, _ := parsed["type"].(string)
			if msgType == "CHAT_MESSAGE" || msgType == "TICKET_UPDATE" {
				h.broadcast <- message
			}
		} else {
			fmt.Printf("WS unmarshal error: %v\n", err)
		}
	}
}
