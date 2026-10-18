import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CreditCard, 
  Headphones, 
  LogOut, 
  Server, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import Login from './pages/Login';
import TenantsDashboard from './pages/TenantsDashboard';
import FinancialDashboard from './pages/FinancialDashboard';
import SupportDashboard from './pages/SupportDashboard';
import api from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('master_token');
    return token ? { name: 'Master Super Admin', role: 'SUPER_ADMIN' } : null;
  });

  const [currentTab, setCurrentTab] = useState('tenants');

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base leading-none text-white flex items-center gap-2">
              UniDesk <span className="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">MASTER</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Control Plane & Licensing Central</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setCurrentTab('tenants')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === 'tenants'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Empresas & Licenças
          </button>

          <button
            onClick={() => setCurrentTab('financial')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === 'financial'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Financeiro Asaas
          </button>

          <button
            onClick={() => setCurrentTab('support')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === 'support'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Headphones className="w-4 h-4" />
            Suporte N2/N3
          </button>
        </nav>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">{currentUser.name}</span>
            <span className="text-[10px] text-emerald-400 font-mono">Ed25519 Central Authority</span>
          </div>

          <button
            onClick={handleLogout}
            title="Sair da Central"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {currentTab === 'tenants' && <TenantsDashboard />}
        {currentTab === 'financial' && <FinancialDashboard />}
        {currentTab === 'support' && <SupportDashboard />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        UniDesk Control Plane Architecture • Asymmetric Ed25519 Licensing Loop • Asaas API v3 Sync
      </footer>
    </div>
  );
}
