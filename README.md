# 🎓 Unidesk — Helpdesk Universitário Inteligente (Self-Hosted)

> Sistema de Helpdesk e Atendimento Acadêmico desenhado sob medida para Instituições de Ensino Superior, com isolamento total por faculdade, IA contextual e chat em tempo real.

---

## 🌟 Destaques da Solução

- 🏛️ **Modelo Self-Hosted Isolado**: Cada faculdade hospeda sua própria instância. Sem compartilhamento de banco de dados, garantindo conformidade total com a LGPD e soberania de dados.
- 🎨 **White-Label & Branding Dinâmico com Live Preview**: Personalização em tempo real de cores, nomes, logotipos e textos institucionais.
- 🪄 **Card de Contexto do Aluno com IA**: Durante o atendimento, o operador visualiza um resumo executivo do histórico acadêmico do aluno, pontos de atenção recorrentes (como atraso de horas complementares ou bolsa financeira) e análise de sentimento.
- 💬 **Chatbot Sophia com Escalonamento Inteligente**: Primeira linha de atendimento automatizada com consulta à Base de Conhecimento (FAQ) e transferência assistida para atendente humano.
- 🔌 **Widget de Chat Embutível (`unidesk-chat.js`)**: Injeção em qualquer portal da faculdade (Portal do Aluno, AVA Moodle, site institucional) com apenas 1 linha de script.
- 📊 **Console Administrativo com Métricas & SLAs**: Monitoramento em tempo real de volume de chamados, taxa de cumprimento de SLA, tempo médio de primeira resposta e índice CSAT.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ instalado.

### 1. Iniciar o servidor
```bash
npm start
```
O servidor inicializará em `http://localhost:3000`.

### 2. Acessar os Módulos do Sistema
- **Portal do Aluno**: [http://localhost:3000/aluno](http://localhost:3000/aluno)
- **Painel do Atendente (com IA Context)**: [http://localhost:3000/atendente](http://localhost:3000/atendente)
- **Painel do Administrador (Branding & Métricas)**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Widget de Chat**: [http://localhost:3000/widget/unidesk-chat.js](http://localhost:3000/widget/unidesk-chat.js)

---

## 🐳 Deploy via Docker Compose

Para subir a instância completa em produção na infraestrutura da universidade:

```bash
docker compose up -d
```

---

## 🔒 Licenciamento & Telemetria Anônima

A instância valida periodicamente o status da licença através de um heartbeat anônimo para o servidor central, transmitindo apenas métricas operacionais agregadas (sem nenhum PII ou dado pessoal de alunos).
