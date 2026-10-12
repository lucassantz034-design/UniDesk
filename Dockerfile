# ==============================================================================
# UNIDESK — HELPDESK UNIVERSITÁRIO INTELIGENTE (SELF-HOSTED)
# Multi-Stage Build: Go (API Core) + React (Frontend SPA)
# ==============================================================================

# 1. Compilação do Frontend em React (Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. Compilação do Backend em Go (Golang)
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.* ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o unidesk-server main.go

# 3. Imagem Final de Execução (Leve e Segura)
FROM alpine:3.20 AS runner
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata

# Binário e arquivos estáticos
COPY --from=backend-builder /app/backend/unidesk-server /app/unidesk-server
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY data /app/data
COPY public /app/public

EXPOSE 3000
ENV PORT=3000

CMD ["/app/unidesk-server"]
