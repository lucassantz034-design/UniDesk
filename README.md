# 🎓 Unidesk — Helpdesk Universitário Inteligente (Go + React)

> Sistema de Helpdesk e Atendimento Acadêmico desenhado sob medida para Instituições de Ensino Superior, reescrito com arquitetura de alta performance: **Go (API REST & WebSockets)** + **React (SPA moderna)**.

---

## 🌟 Destaques da Solução

- ⚡ **Backend em Go (Golang)**: API REST ultrarrápida, de baixo consumo de memória, com WebSocket nativo e persistência híbrida (SQLite Relacional + JSON).
- ⚛️ **Frontend em React + Vite**: Interface moderna, responsiva, com troca dinâmica de perfis (Aluno, Atendente, Administrador) e temas dinâmicos em tempo real.
- 🎨 **White-Label & Branding Dinâmico com Live Preview**: Personalização instantânea de cores (primária, secundária, destaque), nomes, logotipos e textos institucionais.
- 🪄 **Card de Contexto do Aluno com IA**: Durante o atendimento, o técnico visualiza resumo do histórico acadêmico do aluno, pontos de atenção críticos (bolsas, atrasos) e análise de sentimento.
- 💬 **Chatbot Sophia com Escalonamento Inteligente**: Primeira linha de atendimento automatizada com consulta à Base de Conhecimento (FAQ) e transferência para atendente humano.
- 📊 **Console Administrativo & Governança**: Gestão de usuários (soft-delete, reset de senhas com invalidação de sessão), logs de auditoria (`logs_admin`) e telemetria anônima de licenciamento.

---

## 📁 Estrutura do Projeto

```
UniDesk/
├── backend/                  # API REST & WebSocket Gateway em Go
│   ├── cmd/ or main.go       # Ponto de entrada do servidor Go
│   ├── internal/
│   │   ├── api/              # Handlers HTTP REST & CORS
│   │   ├── db/               # Integração SQLite & persistência JSON
│   │   ├── ai/               # Sophia IA & Card de Contexto do Aluno
│   │   ├── ws/               # Hub de WebSocket em tempo real
│   │   └── models/           # Estruturas de dados (Users, Tickets, Config)
│   ├── go.mod & go.sum       # Módulo Go 1.23+
│   └── unidesk-server.exe    # Binário compilado de alta performance
│
├── frontend/                 # Frontend SPA em React 18 + Vite
│   ├── src/
│   │   ├── components/       # Header, ChatWidget, Modais
│   │   ├── pages/            # StudentPortal, AttendantPortal, AdminPortal
│   │   ├── services/         # api.js e websocket.js
│   │   └── styles/           # CSS com suporte a temas dinâmicos
│   ├── package.json & vite   # Configurações do Vite e React
│   └── dist/                 # Build de produção otimizado para o Go servir
│
├── data/                     # Dados persistidos (unidesk.db e database.json)
├── database/                 # Especificação relacional, DDLs e seeds
├── Dockerfile                # Multi-stage build (Node build -> Go build -> Alpine)
├── docker-compose.yml        # Deploy conteinerizado
├── start.bat & start.ps1     # Scripts de inicialização rápida no Windows
└── package.json              # Scripts npm unificados
```

---

## 🚀 Como Executar

### 1. Inicialização Rápida no Windows (Recomendado)
Basta dar duplo clique em:
```cmd
start.bat
```
Ou executar no PowerShell:
```powershell
.\start.ps1
```

O servidor Go inicializará na porta **3000** servindo tanto a API quanto o frontend React compilado.

### 2. Acessar a Aplicação
Abra no navegador:
- 🎓 **Portal do Aluno**: [http://localhost:3000/aluno](http://localhost:3000/aluno)
- 🎧 **Painel do Atendente (com IA Context)**: [http://localhost:3000/atendente](http://localhost:3000/atendente)
- ⚙️ **Painel Administrativo**: [http://localhost:3000/admin](http://localhost:3000/admin)
- 📡 **Healthcheck da API Go**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

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
