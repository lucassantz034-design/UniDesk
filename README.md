# 🎓 Unidesk — Helpdesk Universitário Inteligente

> Sistema de Helpdesk e Atendimento Acadêmico desenhado sob medida para Instituições de Ensino Superior, com suporte a dois motores de execução: **Node.js (Express + SQLite)** ou **Go (Golang)** + **React 18 (SPA moderna)**.

---

## 🌟 Destaques da Solução

- ⚡ **Backend Híbrido de Alta Performance**: Suporte a execução em **Node.js** (com SQLite relacional nativo `DatabaseSync` + fallback JSON) ou **Go** (binário compilado de ultra performance).
- 📡 **WebSockets em Tempo Real**: Atualização instantânea de filas, mensagens de atendimento, notificações e mudanças de status sincronizadas bidirecionalmente entre alunos e técnicos.
- 🎧 **Painel do Atendente Modular**: Barra lateral modular com navegação rápida entre **Painel Geral & Métricas**, **Fila de Atendimento** e **Gestão de Chamados**, contadores em tempo real e status de operador (online/pausa).
- ⚛️ **Frontend em React + Vite**: Interface moderna, fluida e responsiva com troca dinâmica de perfis (Aluno, Atendente, Administrador) e temas dinâmicos em tempo real.
- 🎨 **White-Label & Branding Dinâmico com Live Preview**: Personalização instantânea de cores (primária, secundária, destaque), nomes, logotipos e textos institucionais.
- 🪄 **Card de Contexto do Aluno com IA**: Durante o atendimento, o técnico visualiza resumo do histórico acadêmico do aluno, pontos de atenção críticos (bolsas, atrasos) e análise de sentimento.
- 💬 **Chatbot Sophia com Escalonamento Inteligente**: Primeira linha de atendimento automatizada com consulta à Base de Conhecimento (FAQ) e transferência para atendente humano.
- 📊 **Console Administrativo & Governança**: Gestão de usuários (soft-delete, reset de senhas com invalidação de sessão), logs de auditoria (`logs_admin`) e telemetria anônima de licenciamento.

---

## 📁 Estrutura do Projeto

```
UniDesk/
├── server.js                 # Servidor HTTP e WebSocket Gateway em Node.js
├── src/                      # Regras de negócio, banco de dados e rotas da API Node
├── backend/                  # API REST & WebSocket Gateway alternativa em Go
│   ├── main.go               # Ponto de entrada do servidor Go
│   ├── internal/api/         # Handlers HTTP REST & CORS em Go
│   ├── internal/db/          # SQLite & persistência em Go
│   ├── internal/ws/          # Hub WebSocket em Go
│   └── internal/ai/          # Sophia IA em Go
│
├── frontend/                 # Frontend SPA em React 18 + Vite
│   ├── src/components/       # AttendantSidebar, Header, ChatWidget
│   ├── src/pages/            # StudentPortal, AttendantPortal, AdminPortal
│   ├── src/services/         # api.js e websocket.js (com auto-reconnect)
│   ├── src/styles/           # CSS tokens e temas institucionais dinâmicos
│   └── dist/                 # Build de produção otimizado para entrega estática
│
├── data/                     # Dados persistidos (unidesk.db e database.json)
├── database/                 # Especificação relacional, DDLs e seeds SQL
├── Dockerfile                # Multi-stage build
├── docker-compose.yml        # Deploy conteinerizado
├── start.bat & start.ps1     # Scripts de inicialização automática no Windows
└── package.json              # Scripts npm unificados
```

---

## 🚀 Como Executar

### 1. Inicialização Rápida no Windows (Recomendado)
Basta dar duplo clique em:
```cmd
start.bat
```
Ou executar no terminal:
```bash
npm start
```
*(Inicia automaticamente o servidor Node.js ou o binário Go caso disponível)*

### 2. Acessar a Aplicação
Abra no navegador:
- 🎓 **Portal do Aluno**: [http://localhost:3000/aluno](http://localhost:3000/aluno)
- 🎧 **Painel do Atendente (com IA Context & Sidebar Modular)**: [http://localhost:3000/atendente](http://localhost:3000/atendente)
- ⚙️ **Painel Administrativo**: [http://localhost:3000/admin](http://localhost:3000/admin)
- 📡 **Healthcheck da API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🛠️ Modo de Desenvolvimento

Se você quiser rodar o backend e o frontend separadamente com **Hot-Reloading (HMR)** do Vite:

### Terminal 1: Backend Go
```bash
cd backend
go run main.go
```
*(Inicia a API e WebSocket em `http://localhost:8080`)*

### Terminal 2: Frontend React
```bash
cd frontend
npm run dev
```
*(Inicia o Vite em `http://localhost:5173`, já com proxy configurado para a API Go)*

---

## 🐳 Executando com Docker

Para subir a instância completa em produção:

```bash
docker compose up -d --build
```
