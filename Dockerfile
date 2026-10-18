# ==============================================================================
# UNIDESK — HELPDESK UNIVERSITÁRIO INTELIGENTE (PRODUÇÃO ON-PREMISE / CLOUD)
# Multi-Stage Build Otimizado: Node 22 LTS + React 18 SPA + SQLite DatabaseSync
# ==============================================================================

# 1. Compilação do Frontend em React (Vite)
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --silent || npm install --silent

COPY frontend/ ./
RUN npm run build

# 2. Imagem Final de Produção (Leve, Segura e com Dependências Mínimas)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Pacotes essenciais do sistema: curl para healthchecks e sqlite para rotinas de backup
RUN apk --no-cache add ca-certificates tzdata curl sqlite bash

# Copia dependências de produção do servidor Node.js
COPY package*.json ./
RUN npm ci --only=production --silent || npm install --production --silent

# Copia código-fonte do backend Node e licensing
COPY src/ ./src/
COPY server.js ./
COPY public/ ./public/

# Copia o build de produção do frontend gerado no estágio 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Cria diretórios de dados e backups com permissões adequadas
RUN mkdir -p /app/data /app/backups

# Volume persistente para o banco de dados e arquivos locais
VOLUME ["/app/data", "/app/backups"]

EXPOSE 3000

# Healthcheck do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/licensing/status || exit 1

CMD ["node", "server.js"]
