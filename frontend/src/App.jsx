import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { wsService } from './services/websocket';
import Header from './components/Header';
import StudentPortal from './pages/StudentPortal';
import AttendantPortal from './pages/AttendantPortal';
import AdminPortal from './pages/AdminPortal';
import ChatWidget from './components/ChatWidget';
import LoginView from './components/LoginView';
import GracePeriodBanner from './components/GracePeriodBanner';
import LicenseLockModal from './components/LicenseLockModal';

export default function App() {
  const [config, setConfig] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isChatWidgetOpen, setIsChatWidgetOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [licenseState, setLicenseState] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Usuário autenticado único (armazena o perfil do usuário logado)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('unidesk_current_user') ||
                    localStorage.getItem('unidesk_student_user') ||
                    localStorage.getItem('unidesk_attendant_user') ||
                    localStorage.getItem('unidesk_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const isStudent = currentUser?.role === 'aluno' || currentUser?.role === 'student';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin_faculdade';
  const isAttendant = !isStudent && !isAdmin && !!currentUser;

  // activeView: para alunos = 'aluno'. Para equipe/admin = pode navegar entre atendimento e admin se tiver permissão de admin
  const [activeView, setActiveView] = useState(() => {
    if (isAdmin) return 'admin';
    if (isAttendant) return 'atendente';
    return 'aluno';
  });

  // Atualiza activeView sempre que o currentUser mudar
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin' || currentUser.role === 'admin_faculdade') {
      setActiveView('admin');
    } else if (currentUser.role === 'aluno' || currentUser.role === 'student') {
      setActiveView('aluno');
    } else {
      setActiveView('atendente');
    }
  }, [currentUser?.role, currentUser?.id]);

  const loadLicenseStatus = async () => {
    try {
      const res = await api.getLicenseStatus();
      if (res.data) {
        setLicenseState(res.data);
      }
    } catch (err) {
      console.warn('Erro ao carregar status de licença:', err);
    }
  };

  // Carrega configurações institucionais, usuários e status de licença
  useEffect(() => {
    const initApp = async () => {
      try {
        const [cfg, u] = await Promise.all([api.getConfig(), api.getUsers()]);
        setConfig(cfg);
        setUsers(u);
        await loadLicenseStatus();
      } catch (err) {
        console.error('Erro ao inicializar aplicação:', err);
      }
    };
    initApp();

    // Conecta Gateway WebSocket
    wsService.connect();
    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'STATUS_CHANGE') {
        setIsWsConnected(msg.status === 'connected');
      }
    });

    return () => unsubscribe();
  }, []);

  // Aplica cores dinâmicas da instituição
  useEffect(() => {
    if (config) {
      const root = document.documentElement;
      if (config.primaryColor) {
        root.style.setProperty('--primary', config.primaryColor);
        root.style.setProperty('--primary-glow', `${config.primaryColor}30`);
      }
      if (config.secondaryColor) {
        root.style.setProperty('--secondary', config.secondaryColor);
      }
      if (config.accentColor) {
        root.style.setProperty('--accent', config.accentColor);
      }
    }
  }, [config]);

  // Login unificado baseado nas permissões do usuário
  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    localStorage.setItem('unidesk_current_user', JSON.stringify(user));

    if (user.role === 'admin' || user.role === 'admin_faculdade') {
      setActiveView('admin');
      window.history.pushState({}, '', '/admin');
    } else if (user.role === 'aluno' || user.role === 'student') {
      setActiveView('aluno');
      window.history.pushState({}, '', '/aluno');
    } else {
      setActiveView('atendente');
      window.history.pushState({}, '', '/atendente');
    }
  };

  // Logout único e limpo
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('unidesk_current_user');
    localStorage.removeItem('unidesk_student_user');
    localStorage.removeItem('unidesk_attendant_user');
    localStorage.removeItem('unidesk_admin_user');
    localStorage.removeItem('unidesk_token');
    window.history.pushState({}, '', '/');
  };

  // Navegação para usuários com permissão
  const handleViewChange = (view) => {
    setActiveView(view);
    window.history.pushState({}, '', `/${view}`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Top Navbar */}
      <Header
        config={config}
        isWsConnected={isWsConnected}
        currentUser={currentUser}
        isLoggedIn={!!currentUser}
        onLogout={handleLogout}
        activeTab={activeView}
        onTabChange={handleViewChange}
      />

      {/* Banner de Tolerância de 15 Dias - Exclusivo para Área Administrativa */}
      {isAdmin && activeView === 'admin' && (
        <GracePeriodBanner
          licenseState={licenseState}
          onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
        />
      )}

      {/* Main View Module */}
      <main style={{ flex: 1, paddingBottom: activeView === 'atendente' ? 0 : '3rem', display: 'flex', flexDirection: 'column' }}>
        {!currentUser ? (
          /* TELA ÚNICA DE LOGIN INSTITUCIONAL */
          <LoginView
            config={config}
            onLoginSuccess={handleLoginSuccess}
          />
        ) : isStudent ? (
          /* PORTAL DO ALUNO */
          <StudentPortal
            config={config}
            studentUser={currentUser}
            onOpenChatWidget={() => setIsChatWidgetOpen(true)}
            onLogout={handleLogout}
          />
        ) : isAdmin ? (
          /* ADMINISTRADOR: Tem visão Admin e pode alternar para Atendimento */
          activeView === 'atendente' ? (
            <AttendantPortal
              config={config}
              attendantUser={currentUser}
              onLogout={handleLogout}
            />
          ) : (
            <AdminPortal
              config={config}
              onConfigUpdate={(newCfg) => setConfig(newCfg)}
            />
          )
        ) : (
          /* ATENDENTE / SUPORTE */
          <AttendantPortal
            config={config}
            attendantUser={currentUser}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Floating Chat Widget with Sophia IA (visível para alunos) */}
      {(!currentUser || isStudent) && (
        <ChatWidget
          config={config}
          isOpen={isChatWidgetOpen}
          setIsOpen={setIsChatWidgetOpen}
          studentUser={currentUser || { name: 'Aluno Visitante', ra: 'N/A' }}
        />
      )}

      {/* Modal de Bloqueio Total (Dia 16+) ou exibição sob demanda */}
      <LicenseLockModal
        isOpen={licenseState?.status === 'LOCKED' || isPaymentModalOpen}
        licenseState={licenseState}
        onRefreshStatus={loadLicenseStatus}
        onOpenSupport={() => {
          setIsPaymentModalOpen(false);
          if (isAdmin) setActiveView('admin');
        }}
      />
    </div>
  );
}
