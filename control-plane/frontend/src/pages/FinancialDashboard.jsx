import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  QrCode,
  TrendingUp,
  Receipt
} from 'lucide-react';
import api from '../services/api';

export default function FinancialDashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await api.getFinancialInvoices();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const totalReceived = invoices
    .filter((inv) => inv.status === 'RECEIVED')
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalOverdue = invoices
    .filter((inv) => inv.status === 'OVERDUE')
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalPending = invoices
    .filter((inv) => inv.status === 'PENDING')
    .reduce((acc, curr) => acc + curr.value, 0);

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === 'ALL') return true;
    return inv.status === filter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pago (Asaas)
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Atrasado
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Aguardando
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="text-blue-500 h-7 w-7" /> Gestão Financeira & Asaas
          </h1>
          <p className="text-sm text-slate-400">
            Faturamento recorrente SaaS, cobranças Pix/Boleto e conciliação de pagamentos
          </p>
        </div>

        <button
          onClick={fetchInvoices}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar Asaas
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Receita Confirmada (Mês)
            </span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceived)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Liquidado e compensado via Asaas
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Inadimplência / Atrasadas
            </span>
            <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOverdue)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Gera alerta de tolerância ou bloqueio
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              A Vencer / Pendente
            </span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPending)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Boletos emitidos dentro do prazo
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex gap-2">
        {['ALL', 'RECEIVED', 'OVERDUE', 'PENDING'].map((statusKey) => (
          <button
            key={statusKey}
            onClick={() => setFilter(statusKey)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === statusKey
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {statusKey === 'ALL' && 'Todos os Lançamentos'}
            {statusKey === 'RECEIVED' && 'Pagos'}
            {statusKey === 'OVERDUE' && 'Atrasados'}
            {statusKey === 'PENDING' && 'Pendentes'}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Fatura Asaas ID</th>
                <th className="py-3.5 px-4">Empresa / Cliente</th>
                <th className="py-3.5 px-4">Valor Cobrado</th>
                <th className="py-3.5 px-4">Método</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Link Asaas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Buscando faturas sincronizadas...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    Nenhuma fatura encontrada neste filtro.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-4 px-4 font-mono text-xs text-blue-400 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-slate-500" />
                      {inv.id}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{inv.tenantName}</div>
                      <div className="text-xs text-slate-500 font-mono">Cust ID: {inv.asaasCustomerId}</div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-100">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.value)}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {inv.billingType === 'PIX' ? <QrCode className="w-3 h-3 text-teal-400" /> : null}
                        {inv.billingType}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <div>Venc: {new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                      {inv.paymentDate && (
                        <div className="text-emerald-400 text-[11px] mt-0.5">
                          Pago em: {new Date(inv.paymentDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <a
                        href={inv.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        Abrir Fatura <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
