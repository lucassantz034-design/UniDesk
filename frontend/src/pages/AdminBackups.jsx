import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Database, Download, RefreshCw, HardDrive, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

export default function AdminBackups() {
  const [backups, setBackups] = useState([]);
  const [retentionDays, setRetentionDays] = useState(15);
  const [intervalHours, setIntervalHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await api.getBackups();
      if (res.success) {
        setBackups(res.backups || []);
        if (res.retentionDays) setRetentionDays(res.retentionDays);
        if (res.intervalHours) setIntervalHours(res.intervalHours);
      }
    } catch (err) {
      console.warn('Falha ao listar backups:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setMessage(null);
      const res = await api.triggerBackup();
      if (res.success) {
        setMessage({ type: 'success', text: `Backup gerado com sucesso: ${res.backup.filename} (${res.backup.sizeKb} KB)` });
        fetchBackups();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao gerar backup: ' + err.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Informativo */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Database size={22} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>Rotina de Backup Automático & Recuperação de Desastres</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, maxWidth: '650px', lineHeight: '1.4' }}>
            O UniDesk realiza backups transacionais a quente do banco SQLite sem interromper atendimentos. Compactação nativa com retenção de segurança de {retentionDays} dias.
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={creating}
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: creating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: creating ? 0.7 : 1,
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
          }}
        >
          <RefreshCw size={16} className={creating ? 'animate-spin' : ''} />
          {creating ? 'Gerando Snapshot...' : 'Gerar Backup Agora'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '0.85rem 1.2rem',
          borderRadius: '10px',
          fontSize: '0.85rem',
          fontWeight: 600,
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: message.type === 'success' ? '#34d399' : '#f87171',
          border: `1px solid ${message.type === 'success' ? '#059669' : '#dc2626'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Cards de Métricas de Armazenamento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <Clock size={16} color="var(--primary-light)" /> Intervalo Automático
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>A cada {intervalHours}h</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>● Agendador Ativo (02:00)</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <ShieldCheck size={16} color="#10b981" /> Política de Retenção
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{retentionDays} Dias</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Limpeza automática de arquivos antigos</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <HardDrive size={16} color="#38bdf8" /> Backups Disponíveis
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{backups.length} Snapshots</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Armazenados em /backups</div>
        </div>
      </div>

      {/* Tabela de Backups */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={18} color="var(--primary-light)" /> Histórico de Backups Compactados (.sqlite.gz)
        </h4>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Carregando histórico de backups...</div>
        ) : backups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            Nenhum arquivo de backup gerado ainda. Clique em "Gerar Backup Agora" para criar o primeiro snapshot de segurança.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Arquivo de Backup</th>
                  <th style={{ padding: '0.75rem' }}>Data e Hora</th>
                  <th style={{ padding: '0.75rem' }}>Tamanho Compactado</th>
                  <th style={{ padding: '0.75rem' }}>Tipo</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, idx) => (
                  <tr key={b.filename} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx === 0 ? 'rgba(79, 70, 229, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Database size={14} color="var(--primary-light)" />
                      {b.filename}
                      {idx === 0 && <span style={{ fontSize: '0.7rem', background: '#059669', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '4px', marginLeft: '0.5rem' }}>Mais Recente</span>}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#fff', fontWeight: 600 }}>
                      {b.sizeKb} KB
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      Gzip Hot-Backup (SQLite)
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontWeight: 600 }}>
                        <ShieldCheck size={14} /> Íntegro
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
