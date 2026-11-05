/**
 * UniDesk — Custom Pop-up System
 * Automatically adapts to the active institutional color scheme (--primary, --secondary, --accent).
 */
(function() {
  function showThemedPopup(options) {
    return new Promise((resolve) => {
      const isConfirm = options.isConfirm || options.type === 'confirm';
      const type = options.type || (isConfirm ? 'confirm' : 'info');
      const isError = type === 'error';
      const isSuccess = type === 'success';
      const isWarning = type === 'warning';

      const existing = document.getElementById('unidesk-custom-popup');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'unidesk-custom-popup';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(5, 7, 15, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 1.25rem;
        animation: fadeIn 0.2s ease-out;
      `;

      let iconSvg = '';
      let iconColor = 'var(--primary-light, #3b82f6)';
      let statusBorder = 'var(--primary, #1d4ed8)';

      if (isSuccess) {
        iconColor = '#10b981';
        statusBorder = 'rgba(16, 185, 129, 0.6)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      } else if (isError) {
        iconColor = '#ef4444';
        statusBorder = 'rgba(239, 68, 68, 0.6)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
      } else if (isWarning) {
        iconColor = '#f59e0b';
        statusBorder = 'rgba(245, 158, 11, 0.6)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      } else {
        iconColor = 'var(--secondary, #0284c7)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      }

      const title = options.title || (isSuccess ? 'Sucesso' : isError ? 'Atenção' : isWarning ? 'Aviso' : isConfirm ? 'Confirmação' : 'Notificação UniDesk');
      const confirmLabel = options.confirmText || (isConfirm ? 'Confirmar' : 'Entendido');
      const cancelLabel = options.cancelText || 'Cancelar';

      overlay.innerHTML = `
        <div style="width: 100%; max-width: 480px; background: linear-gradient(180deg, #131c2e 0%, #0d131f 100%); border-radius: 18px; border: 1px solid ${statusBorder}; box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 35px var(--primary-glow); position: relative; overflow: hidden; animation: modalScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="height: 5px; width: 100%; background: ${isError ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, var(--primary, #1d4ed8), var(--secondary, #0284c7), var(--accent, #f59e0b))'};"></div>
          <button id="unidesk-popup-close-x" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 0.4rem; border-radius: 8px; font-size: 1.1rem; line-height: 1;">✕</button>
          <div style="padding: 1.75rem;">
            <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1.25rem;">
              <div style="width: 46px; height: 46px; border-radius: 14px; background: radial-gradient(circle, var(--primary-glow) 0%, rgba(0,0,0,0.3) 100%); border: 1px solid ${statusBorder}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${iconSvg}
              </div>
              <div style="flex: 1; padding-right: 0.5rem;">
                <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0 0 0.35rem 0; letter-spacing: -0.01em;">${title}</h3>
                <div style="font-size: 0.88rem; color: #cbd5e1; line-height: 1.55; white-space: pre-line;">${options.message || ''}</div>
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
              ${isConfirm ? `<button id="unidesk-popup-cancel" style="background: rgba(255,255,255,0.06); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 0.65rem 1.4rem; font-size: 0.88rem; font-weight: 600; cursor: pointer;">${cancelLabel}</button>` : ''}
              <button id="unidesk-popup-confirm" style="background: ${isError ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, var(--primary, #1d4ed8), var(--secondary, #0284c7))'}; color: #fff; border: none; border-radius: 10px; padding: 0.65rem 1.6rem; font-size: 0.88rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 18px var(--primary-glow);">${confirmLabel}</button>
            </div>
          </div>
        </div>
      `;

      function cleanup(res) {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(res);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') cleanup(false);
        if (e.key === 'Enter') cleanup(true);
      }

      document.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);

      overlay.querySelector('#unidesk-popup-close-x')?.addEventListener('click', () => cleanup(false));
      overlay.querySelector('#unidesk-popup-cancel')?.addEventListener('click', () => cleanup(false));
      overlay.querySelector('#unidesk-popup-confirm')?.addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
    });
  }

  window.unideskPopup = {
    show: showThemedPopup,
    alert: (msg, title) => showThemedPopup({ message: msg, title, isConfirm: false }),
    confirm: (msg, title) => showThemedPopup({ message: msg, title, isConfirm: true })
  };

  // Safe global fallback override
  window.alert = function(msg) {
    const text = String(msg || '');
    const isErr = text.toLowerCase().includes('erro') || text.toLowerCase().includes('falha');
    const isSucc = text.toLowerCase().includes('sucesso') || text.toLowerCase().includes('registrad') || text.toLowerCase().includes('finalizado');
    showThemedPopup({
      message: text,
      type: isSucc ? 'success' : isErr ? 'error' : 'info',
      title: isSucc ? 'Operação Concluída' : isErr ? 'Aviso do Sistema' : 'Notificação UniDesk'
    });
  };
})();
