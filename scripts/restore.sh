#!/usr/bin/env bash
# ==============================================================================
# UNIDESK — SCRIPT DE RESTAURAÇÃO DE BACKUP
# Uso: ./scripts/restore.sh [caminho_do_arquivo.sqlite.gz]
# ==============================================================================

set -euo pipefail

BACKUP_INPUT="${1:-./backups/latest_backup.sqlite.gz}"
TARGET_DB="./data/unidesk.db"

if [ ! -f "${BACKUP_INPUT}" ]; then
    echo "❌ Arquivo de backup não encontrado: ${BACKUP_INPUT}"
    exit 1
fi

echo "⚠️  ATENÇÃO: A restauração substituirá os dados atuais em ${TARGET_DB}."
read -p "Deseja continuar? (s/N): " CONFIRM
if [ "${CONFIRM}" != "s" ] && [ "${CONFIRM}" != "S" ]; then
    echo "Operação cancelada pelo usuário."
    exit 0
fi

echo "📦 Descompactando e restaurando base de dados..."
gunzip -c "${BACKUP_INPUT}" > "${TARGET_DB}"

echo "✅ Banco de dados restaurado com sucesso para ${TARGET_DB}!"
echo "Reinicie o container do UniDesk para carregar as informações: docker compose restart unidesk_app"
