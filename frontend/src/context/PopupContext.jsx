import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import ThemedPopup from '../components/ThemedPopup';

const PopupContext = createContext(null);

export function PopupProvider({ children, config }) {
  const [popupState, setPopupState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Entendido',
    cancelText: 'Cancelar',
    isConfirm: false,
    colors: null,
    institutionName: '',
    showColorBadges: false,
    onConfirm: null,
    onClose: null
  });

  const resolverRef = useRef(null);

  const closePopup = useCallback((result = false) => {
    setPopupState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (popupState.onConfirm) {
      try {
        popupState.onConfirm();
      } catch (err) {
        console.error('Popup onConfirm error:', err);
      }
    }
    closePopup(true);
  }, [popupState, closePopup]);

  const handleCancel = useCallback(() => {
    if (popupState.onClose) {
      try {
        popupState.onClose();
      } catch (err) {
        console.error('Popup onClose error:', err);
      }
    }
    closePopup(false);
  }, [popupState, closePopup]);

  /**
   * Generic showPopup returning a Promise<boolean>
   */
  const showPopup = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;

      let msg = options.message;
      if (typeof msg === 'object' && msg !== null && !(msg.$$typeof)) {
        msg = JSON.stringify(msg, null, 2);
      }

      setPopupState({
        isOpen: true,
        title: options.title || '',
        message: msg || '',
        type: options.type || 'info',
        confirmText: options.confirmText,
        cancelText: options.cancelText || 'Cancelar',
        isConfirm: !!options.isConfirm || options.type === 'confirm',
        colors: options.colors || (config ? {
          primary: config.primaryColor,
          secondary: config.secondaryColor,
          accent: config.accentColor
        } : null),
        institutionName: options.institutionName || config?.name || '',
        showColorBadges: !!options.showColorBadges,
        onConfirm: options.onConfirm || null,
        onClose: options.onClose || null
      });
    });
  }, [config]);

  const showAlert = useCallback((message, title = '', options = {}) => {
    return showPopup({
      message,
      title,
      type: options.type || 'info',
      confirmText: options.confirmText || 'OK',
      ...options,
      isConfirm: false
    });
  }, [showPopup]);

  const showSuccess = useCallback((message, title = 'Sucesso!', options = {}) => {
    return showPopup({
      message,
      title,
      type: 'success',
      confirmText: options.confirmText || 'Entendido',
      ...options,
      isConfirm: false
    });
  }, [showPopup]);

  const showError = useCallback((message, title = 'Atenção / Erro', options = {}) => {
    return showPopup({
      message,
      title,
      type: 'error',
      confirmText: options.confirmText || 'Fechar',
      ...options,
      isConfirm: false
    });
  }, [showPopup]);

  const showWarning = useCallback((message, title = 'Aviso', options = {}) => {
    return showPopup({
      message,
      title,
      type: 'warning',
      confirmText: options.confirmText || 'Entendido',
      ...options,
      isConfirm: false
    });
  }, [showPopup]);

  const showInfo = useCallback((message, title = 'Informação', options = {}) => {
    return showPopup({
      message,
      title,
      type: 'info',
      confirmText: options.confirmText || 'OK',
      ...options,
      isConfirm: false
    });
  }, [showPopup]);

  const showConfirm = useCallback((message, title = 'Confirmação', options = {}) => {
    return showPopup({
      message,
      title,
      type: 'confirm',
      isConfirm: true,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      ...options
    });
  }, [showPopup]);

  // Expose unideskPopup globally and hook into window.alert / window.confirm
  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.unideskPopup = {
      showPopup,
      showAlert,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showConfirm,
      closePopup
    };

    // Replace window.alert with UniDesk custom themed popup
    window.alert = (msg) => {
      const text = typeof msg === 'string' ? msg : String(msg);
      const isErr = text.toLowerCase().includes('erro') || text.toLowerCase().includes('falha');
      const isSucc = text.toLowerCase().includes('sucesso') || text.toLowerCase().includes('finalizado') || text.toLowerCase().includes('obrigado');
      
      showPopup({
        title: isSucc ? 'Operação Concluída' : isErr ? 'Aviso do Sistema' : 'Notificação UniDesk',
        message: text,
        type: isSucc ? 'success' : isErr ? 'error' : 'info',
        confirmText: 'Entendido'
      });
    };

    // Replace window.confirm with custom popup dispatch
    window.confirm = (msg) => {
      // Browsers expect window.confirm to be synchronous, but in modern web we display the themed popup.
      // For immediate async-friendly code, window.unideskPopup.showConfirm is best,
      // but if legacy code calls confirm(), we trigger the themed confirmation modal.
      showPopup({
        title: 'Confirmação Necessária',
        message: String(msg),
        type: 'confirm',
        isConfirm: true,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar'
      });
      return false; // Safely return false synchronously while modal handles UI
    };

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [showPopup, showAlert, showSuccess, showError, showWarning, showInfo, showConfirm, closePopup]);

  const value = {
    showPopup,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    closePopup
  };

  return (
    <PopupContext.Provider value={value}>
      {children}
      <ThemedPopup
        isOpen={popupState.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={popupState.title}
        message={popupState.message}
        type={popupState.type}
        confirmText={popupState.confirmText}
        cancelText={popupState.cancelText}
        isConfirm={popupState.isConfirm}
        colors={popupState.colors}
        institutionName={popupState.institutionName}
        showColorBadges={popupState.showColorBadges}
      />
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      showPopup: (opts) => window.unideskPopup?.showPopup(opts) || Promise.resolve(true),
      showAlert: (msg, title, opts) => window.unideskPopup?.showAlert(msg, title, opts) || Promise.resolve(true),
      showSuccess: (msg, title, opts) => window.unideskPopup?.showSuccess(msg, title, opts) || Promise.resolve(true),
      showError: (msg, title, opts) => window.unideskPopup?.showError(msg, title, opts) || Promise.resolve(true),
      showWarning: (msg, title, opts) => window.unideskPopup?.showWarning(msg, title, opts) || Promise.resolve(true),
      showInfo: (msg, title, opts) => window.unideskPopup?.showInfo(msg, title, opts) || Promise.resolve(true),
      showConfirm: (msg, title, opts) => window.unideskPopup?.showConfirm(msg, title, opts) || Promise.resolve(true),
      closePopup: () => window.unideskPopup?.closePopup()
    };
  }
  return context;
}
