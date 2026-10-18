#!/usr/bin/env bash
# ==============================================================================
# UNIDESK — SCRIPT DE BACKUP A QUENTE DO SQLITE (HOT BACKUP)
# Garante backup íntegro mesmo com o sistema em execução e atendimentos ativos
# ==============================================================================

set -euo pipefail

DATA_DIR="/app/data"
BACKUP_DIR="/app/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/unidesk_backup_${TIMESTAMP}.sqlite"
GZ_FILE="${BACKUP_FILE}.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-15}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Iniciando rotina de backup do UniDesk..."

# 1. Verifica existência do banco SQLite principal
if [ -f "${DATA_DIR}/unidesk.db" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 Executando .backup transacional (Safe Hot-Backup)..."
    sqlite3 "${DATA_DIR}/unidesk.db" ".backup '${BACKUP_FILE}'"
elif [ -f "${DATA_DIR}/database.json" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 Copiando snapshot JSON..."
    cp "${DATA_DIR}/database.json" "${BACKUP_FILE}.json"
    BACKUP_FILE="${BACKUP_FILE}.json"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Nenhum arquivo de banco encontrado em ${DATA_DIR}. Pulando ciclo."
    exit 0
fi

# 2. Compactação com gzip (reduz o tamanho em ~85%)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗜️ Compactando backup com gzip..."
gzip -f "${BACKUP_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup gerado com sucesso: ${GZ_FILE} ($(du -h "${GZ_FILE}" | cut -f1))"

# 3. Políticas de Retenção (remove backups com mais de X dias para não lotar o disco)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 Limpando backups com mais de ${RETENTION_DAYS} dias..."
find "${BACKUP_DIR}" -name "unidesk_backup_*.gz" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} \; || true

# 4. Cria cópia do backup mais recente para restauração rápida
cp -f "${GZ_FILE}" "${BACKUP_DIR}/latest_backup.sqlite.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎉 Rotina de backup finalizada com sucesso."
