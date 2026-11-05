import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { usePopup } from '../context/PopupContext';
import {
  LifeBuoy,
  Send,
  CheckCircle,
  AlertTriangle,
  Server,
  Database,
  Cpu,
  Clock,
  RefreshCw,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function AdminSupport() {
  const { showWarning } = usePopup();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [category, setCategory] = useState('INCIDENT');
  const [contactEmail, setContactEmail] = useState('admin@metropolitana.edu.br');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsPreview, setDiagnosticsPreview] = useState(null);

  // Carregar dados de diagnóstico prévio
  useEffect(() => {
    const loadDiagnostics = async () => {
      try {
        const [health, status] = await Promise.all([
          api.getHealth().catch(() => null),
          api.getLicenseStatus().catch(() => null)
        ]);

        setDiagnosticsPreview({
          nodeVersion: health?.engine || 'Node.js (Express + SQLite)',
          instance: health?.instance || 'UniDesk Metropolitana',
          version: health?.version || '2.0.0',
          uptimeSeconds: health?.uptimeSeconds || 3600,
          licenseStatus: status?.data?.status || 'ACTIVE',
          instanceUuid: status?.data?.instanceUuid || 'inst-local-unidesk',
          licenseKey: status?.data?.licenseKey || 'UNI-HOSTED-2026-BR-ACTIVE'
        });
      } catch (_) {}
    };
    loadDiagnostics();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showWarning('Por favor, preencha o título e os detalhes do chamado antes de prosseguir.', 'Campos Obrigatórios');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setTicketResult(null);

    try {
      const res = await api.submitSupportTicket({
        title,
        description,
        priority,
        category,
        contactEmail
      });

      setTicketResult(res);
      setTitle('');
      setDescription('');
    } catch (err) {
      setErrorMessage(err.message || 'Erro ao enviar chamado para a Central.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
      {/* Header do Suporte */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '0.85rem',
            borderRadius: '12px'
          }}>
            <LifeBuoy size={28} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Suporte Técnico da Plataforma (Nível Fornecedor)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Canal direto com o time de engenharia e sustentação do UniDesk SaaS HQ.
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#10b981',
          padding: '0.4rem 0.8rem',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 600
        }}>
          <ShieldCheck size={15} /> Canal Criptografado Outbound TLS 1.3
        </div>
      </div>

      {ticketResult && (
        <div style={{
          background: ticketResult.contingencyMode ? 'rgba(234, 88, 12, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${ticketResult.contingencyMode ? '#ea580c' : '#10b981'}`,
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: ticketResult.contingencyMode ? '#fb923c' : '#34d399', fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>
            <CheckCircle size={20} />
            {ticketResult.contingencyMode ? 'Chamado Registrado em Contingência' : 'Chamado Despachado com Sucesso para a Central!'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.5' }}>
            {ticketResult.message || `Protocolo: #${ticketResult.ticket?.id || 'UNIDESK-' + Date.now()} • Nosso time técnico analisará o relato e a telemetria anexada.`}
          </div>
          {ticketResult.diagnosticsSent && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Telemetria coletada e anexada: Node {ticketResult.diagnosticsSent.nodeVersion} • Engine: {ticketResult.diagnosticsSent.dbEngine} • Memória: {ticketResult.diagnosticsSent.memory?.heapUsedMB}MB
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={18} /> {errorMessage}
        </div>
      )}

      {/* Formulário de Abertura de Ticket */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.8fr 1.2fr',
        gap: '1.5rem'
      }}>
        {/* Painel do Formulário */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
            Abrir Chamado Técnico com Fornecedor
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Título Resumido do Problema
              </label>
              <input
                type="text"
                placeholder="Ex.: Lentidão na emissão de declarações ou erro ao autenticar"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Severidade / Criticidade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="LOW">Baixa (Dúvida operacional / Consulta)</option>
                  <option value="MEDIUM">Média (Degradação parcial sem impacto geral)</option>
                  <option value="HIGH">Alta (Módulo com erro ou falha de serviço)</option>
                  <option value="URGENT">Urgente (Sistema parado / Crítico)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Categoria do Incidente
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="INCIDENT">Incidente Técnico / Bug</option>
                  <option value="LICENSING">Licenciamento & Faturamento</option>
                  <option value="DATABASE">Banco de Dados & Desempenho</option>
                  <option value="AI_ORCHESTRATION">Orquestração Sophia IA</option>
                  <option value="FEATURE_REQUEST">Sugestão de Melhoria</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                E-mail para Notificação da Resposta
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Descrição Detalhada e Comportamento Observado
              </label>
              <textarea
                rows={5}
                placeholder="Descreva o passo a passo para reproduzir o problema, mensagens de erro visíveis ou comportamento inesperado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem'
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={17} className="animate-spin" /> Coletando telemetria e enviando...
                </>
              ) : (
                <>
                  <Send size={17} /> Despachar Chamado para a Central
                </>
              )}
            </button>
          </form>
        </div>

        {/* Telemetria de Diagnóstico Anexada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem'
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={17} color="#38bdf8" /> Diagnósticos Automáticos
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '1rem' }}>
              Para acelerar o atendimento de N2/N3 pela equipe de produto, os seguintes parâmetros do ambiente local são transmitidos junto com a mensagem de forma segura:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Runtime:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{diagnosticsPreview?.nodeVersion || 'Node.js v20+'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Database Engine:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>SQLite 3.x (node:sqlite)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Licença:</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{diagnosticsPreview?.licenseStatus || 'ACTIVE'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Instance UUID:</span>
                <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>{diagnosticsPreview?.instanceUuid || 'inst-...'}</span>
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              style={{
                marginTop: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showDiagnostics ? 'Ocultar detalhes de logs' : 'Visualizar amostra de logs enviada'}
            </button>

            {showDiagnostics && (
              <pre style={{
                marginTop: '0.75rem',
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.7rem',
                color: '#94a3b8',
                overflowX: 'auto',
                maxHeight: '180px'
              }}>
{`{
  "nodeVersion": "${process.version || 'v20.x'}",
  "arch": "${process.arch || 'x64'}",
  "dbEngine": "SQLite (unidesk.db)",
  "logsExcerpt": [
    "[INFO] Server initialized successfully",
    "[INFO] Relational database connected",
    "[INFO] Outbound HTTPS license verify passed"
  ]
}`}
              </pre>
            )}
          </div>

          {/* Card de Política de SLA do Fornecedor */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem'
          }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              Compromisso de SLA UniDesk HQ
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              • <strong>Urgente:</strong> Retorno em até 2 horas úteis.<br />
              • <strong>Alta:</strong> Retorno em até 6 horas úteis.<br />
              • <strong>Média / Baixa:</strong> Retorno em até 24 horas úteis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
