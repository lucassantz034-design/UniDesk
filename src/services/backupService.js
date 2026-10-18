import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BackupService {
  constructor(sqlite = null) {
    this.dataDir = path.resolve(__dirname, '../../data');
    this.backupDir = path.resolve(__dirname, '../../backups');
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '15', 10);
    this.intervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10);
    this.timer = null;
    this.sqlite = sqlite;

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Gera snapshot de backup a quente transacional nativo via VACUUM INTO
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const sourceDb = path.join(this.dataDir, 'unidesk.db');
    const sourceJson = path.join(this.dataDir, 'database.json');
    const backupName = `unidesk_backup_${timestamp}.sqlite.gz`;
    const targetGz = path.join(this.backupDir, backupName);
    const tempSnapshot = path.join(this.backupDir, `temp_vacuum_${timestamp}_${Date.now()}.db`);

    try {
      const activeSqlite = this.sqlite || db?.sqlite;
      let fileData = null;

      if (activeSqlite) {
        // Backup transacional consistente e sem corrupção usando VACUUM INTO nativo do SQLite
        const safePath = tempSnapshot.replace(/\\/g, '/');
        if (fs.existsSync(tempSnapshot)) {
          fs.unlinkSync(tempSnapshot);
        }

        activeSqlite.exec(`VACUUM INTO '${safePath}';`);
        fileData = fs.readFileSync(tempSnapshot);

        try {
          fs.unlinkSync(tempSnapshot);
        } catch (_) {}
      } else if (fs.existsSync(sourceDb)) {
        fileData = fs.readFileSync(sourceDb);
      } else if (fs.existsSync(sourceJson)) {
        fileData = fs.readFileSync(sourceJson);
      } else {
        throw new Error('Nenhum banco de dados ativo encontrado em data/');
      }

      // Compactação segura em gzip
      const compressed = zlib.gzipSync(fileData);
      fs.writeFileSync(targetGz, compressed);

      // Atualiza cópia do latest
      const latestPath = path.join(this.backupDir, 'latest_backup.sqlite.gz');
      fs.writeFileSync(latestPath, compressed);

      // Limpeza de backups antigos conforme política de retenção
      this.cleanOldBackups();

      const stats = fs.statSync(targetGz);
      return {
        success: true,
        filename: backupName,
        path: targetGz,
        sizeBytes: stats.size,
        sizeKb: (stats.size / 1024).toFixed(2),
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      if (fs.existsSync(tempSnapshot)) {
        try { fs.unlinkSync(tempSnapshot); } catch (_) {}
      }
      console.error('[BackupService] Falha ao criar backup:', err.message);
      throw err;
    }
  }

  // Listagem de backups disponíveis
  listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) return [];
      const files = fs.readdirSync(this.backupDir);
      return files
        .filter(f => f.endsWith('.sqlite.gz') && f !== 'latest_backup.sqlite.gz')
        .map(f => {
          const filePath = path.join(this.backupDir, f);
          const stats = fs.statSync(filePath);
          return {
            filename: f,
            sizeBytes: stats.size,
            sizeKb: (stats.size / 1024).toFixed(2),
            createdAt: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      return [];
    }
  }

  // Limpa backups que ultrapassam o período de retenção (ex: 15 dias)
  cleanOldBackups() {
    try {
      const now = Date.now();
      const maxAgeMs = this.retentionDays * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(this.backupDir);

      files.forEach(f => {
        if (f.endsWith('.sqlite.gz') && f !== 'latest_backup.sqlite.gz') {
          const filePath = path.join(this.backupDir, f);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            console.log(`[BackupService] Backup antigo removido: ${f}`);
          }
        }
      });
    } catch (err) {
      console.warn('[BackupService] Erro ao limpar backups antigos:', err.message);
    }
  }

  // Inicializa a rotina periódica em segundo plano
  startScheduledBackups() {
    if (this.timer) return;
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    console.log(`[BackupService] Agendador de backup ativo. Intervalo: a cada ${this.intervalHours} horas.`);

    // Executa um backup inicial se nenhum existir
    const backups = this.listBackups();
    if (backups.length === 0) {
      this.createBackup()
        .then(b => console.log(`[BackupService] Backup de inicialização gerado: ${b.filename}`))
        .catch(() => {});
    }

    this.timer = setInterval(() => {
      this.createBackup()
        .then(b => console.log(`[BackupService] Backup rotineiro automático gerado: ${b.filename}`))
        .catch(err => console.error('[BackupService] Erro no backup programado:', err.message));
    }, intervalMs);
  }
}

export const backupService = new BackupService();
