let appConfig = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadAdminConfig();
  await loadMetrics();
  await loadAttendants();
  await loadCategories();
});

// Load Configuration and Branding
async function loadAdminConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();

    // Set Header
    document.title = `${appConfig.name} — Painel do Administrador`;
    const instName = document.getElementById('admin-inst-name');
    if (instName) instName.textContent = appConfig.name;
    const instLogo = document.getElementById('admin-inst-logo');
    if (instLogo && appConfig.logoUrl) instLogo.src = appConfig.logoUrl;

    // Apply Dynamic CSS variables
    if (appConfig.primaryColor) {
      document.documentElement.style.setProperty('--primary', appConfig.primaryColor);
      document.documentElement.style.setProperty('--primary-glow', `${appConfig.primaryColor}2e`);
    }

    // Populate Branding Form
    document.getElementById('brand-input-name').value = appConfig.name || '';
    document.getElementById('brand-input-tagline').value = appConfig.tagline || '';
    document.getElementById('brand-color-primary').value = appConfig.primaryColor || '#1d4ed8';
    document.getElementById('brand-text-primary').value = appConfig.primaryColor || '#1d4ed8';
    document.getElementById('brand-color-secondary').value = appConfig.secondaryColor || '#0284c7';
    document.getElementById('brand-text-secondary').value = appConfig.secondaryColor || '#0284c7';
    document.getElementById('brand-input-logo').value = appConfig.logoUrl || '';

    // Populate AI Form
    document.getElementById('ai-provider-select').value = appConfig.aiProvider || 'local_heuristic';
    document.getElementById('ai-instructions-input').value = appConfig.aiCustomInstructions || '';

    // Initial Live Preview render
    updateLivePreview();
  } catch (err) {
    console.error('Error loading admin config:', err);
  }
}

// Update Live Preview Card as User Types / Selects Colors
function updateLivePreview() {
  const name = document.getElementById('brand-input-name').value;
  const tagline = document.getElementById('brand-input-tagline').value;
  const logo = document.getElementById('brand-input-logo').value;

  // Sync color inputs
  const colorPickerPrimary = document.getElementById('brand-color-primary');
  const colorTextPrimary = document.getElementById('brand-text-primary');
  const colorPickerSecondary = document.getElementById('brand-color-secondary');
  const colorTextSecondary = document.getElementById('brand-text-secondary');

  // Match picker with text or vice versa
  let primary = colorPickerPrimary.value;
  if (document.activeElement === colorTextPrimary && colorTextPrimary.value.startsWith('#')) {
    primary = colorTextPrimary.value;
    colorPickerPrimary.value = primary;
  } else {
    colorTextPrimary.value = primary;
  }

  let secondary = colorPickerSecondary.value;
  if (document.activeElement === colorTextSecondary && colorTextSecondary.value.startsWith('#')) {
    secondary = colorTextSecondary.value;
    colorPickerSecondary.value = secondary;
  } else {
    colorTextSecondary.value = secondary;
  }

  // Update preview mock element
  document.getElementById('preview-inst-name').textContent = name || 'Nome da Faculdade';
  document.getElementById('preview-inst-tagline').textContent = tagline || 'Central de Atendimento';
  document.getElementById('preview-logo-img').src = logo || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=120';

  const banner = document.getElementById('preview-banner');
  banner.style.background = `linear-gradient(135deg, ${primary}26 0%, #111827 100%)`;
  banner.style.border = `1px solid ${primary}4d`;

  const sampleBtn = document.getElementById('preview-sample-btn');
  sampleBtn.style.background = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
  sampleBtn.style.boxShadow = `0 4px 12px ${primary}40`;
}

// Save Branding to Backend
async function saveBranding(event) {
  event.preventDefault();
  const name = document.getElementById('brand-input-name').value;
  const tagline = document.getElementById('brand-input-tagline').value;
  const primaryColor = document.getElementById('brand-color-primary').value;
  const secondaryColor = document.getElementById('brand-color-secondary').value;
  const logoUrl = document.getElementById('brand-input-logo').value;

  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        tagline,
        primaryColor,
        secondaryColor,
        logoUrl
      })
    });

    const data = await res.json();
    alert('Configurações de identidade visual salvas com sucesso em toda a instância!');
    await loadAdminConfig();
  } catch (err) {
    alert('Erro ao salvar marca');
  }
}

// Load Metrics & KPIs
async function loadMetrics() {
  try {
    const res = await fetch('/api/admin/metrics');
    const m = await res.json();

    document.getElementById('kpi-total-tickets').textContent = m.totalTickets;
    document.getElementById('kpi-sla-compliance').textContent = `${m.slaCompliancePercent}%`;
    document.getElementById('kpi-first-response').textContent = `${m.averageFirstResponseHours}h`;
    document.getElementById('kpi-avg-csat').textContent = `${m.averageCsat} ★`;

    document.getElementById('status-count-open').textContent = m.openTickets;
    document.getElementById('status-count-progress').textContent = m.inProgressTickets;
    document.getElementById('status-count-resolved').textContent = m.resolvedTickets;

    // Render Category Distribution Bars
    const catContainer = document.getElementById('category-distribution-bars');
    const categories = Object.keys(m.byCategory);
    
    catContainer.innerHTML = categories.map(cat => {
      const count = m.byCategory[cat];
      const percent = m.totalTickets > 0 ? Math.round((count / m.totalTickets) * 100) : 0;

      return `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:0.35rem;">
            <span>${cat}</span>
            <span style="font-weight:700; color:#fff;">${count} chamados (${percent}%)</span>
          </div>
          <div style="width:100%; height:8px; background:rgba(255,255,255,0.06); border-radius:9999px; overflow:hidden;">
            <div style="width:${Math.max(percent, 8)}%; height:100%; background:var(--primary); border-radius:9999px;"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading metrics:', err);
  }
}

// Load Attendants
async function loadAttendants() {
  const container = document.getElementById('admin-attendants-list');
  try {
    const res = await fetch('/api/users?role=attendant');
    const attendants = await res.json();

    container.innerHTML = attendants.map(att => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${att.avatar}" class="user-avatar" style="width:36px; height:36px;">
          <div>
            <div style="font-weight:700; font-size:0.85rem;">${att.name}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${att.email}</div>
          </div>
        </div>
        <span class="badge badge-open">${att.department}</span>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">Erro ao carregar atendentes.</div>`;
  }
}

// Load Categories
async function loadCategories() {
  const container = document.getElementById('admin-categories-list');
  try {
    const res = await fetch('/api/categories');
    const cats = await res.json();

    container.innerHTML = cats.map(c => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px;">
        <div>
          <div style="font-weight:700; font-size:0.85rem;">${c.name}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">Prioridade padrão: ${c.defaultPriority}</div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:0.85rem; font-weight:800; color:#38bdf8;">Meta: ${c.slaHours}h</span>
          <div style="font-size:0.7rem; color:var(--text-subtle);">SLA de 1ª resposta</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">Erro ao carregar departamentos.</div>`;
  }
}

// Save AI Settings
async function saveAISettings() {
  const aiProvider = document.getElementById('ai-provider-select').value;
  const aiApiKey = document.getElementById('ai-api-key-input').value;
  const aiCustomInstructions = document.getElementById('ai-instructions-input').value;

  try {
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiProvider,
        aiApiKey: aiApiKey ? '***configured***' : '',
        aiCustomInstructions
      })
    });
    alert('Parâmetros de Inteligência Artificial atualizados com sucesso!');
  } catch (err) {
    alert('Erro ao atualizar IA');
  }
}

// Trigger Heartbeat
async function triggerHeartbeat() {
  const resultBox = document.getElementById('heartbeat-result-box');
  try {
    const res = await fetch('/api/telemetry/heartbeat', { method: 'POST' });
    const data = await res.json();

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <strong>✓ Heartbeat Concluído com Sucesso!</strong><br>
      Resposta do servidor central: <em>${data.message}</em><br>
      <pre style="margin-top:0.5rem; font-size:0.7rem; color:#a7f3d0; background:rgba(0,0,0,0.3); padding:0.4rem; border-radius:4px;">${JSON.stringify(data.payload, null, 2)}</pre>
    `;
  } catch (err) {
    resultBox.style.display = 'block';
    resultBox.style.color = '#ef4444';
    resultBox.textContent = 'Erro ao enviar heartbeat para o servidor central.';
  }
}

// Switch Admin Tabs
function switchAdminTab(tab) {
  const tabs = ['metrics', 'branding', 'team', 'ai'];
  tabs.forEach(t => {
    document.getElementById(`tab-admin-${t}`).classList.remove('active');
    document.getElementById(`admin-view-${t}`).style.display = 'none';
  });

  document.getElementById(`tab-admin-${tab}`).classList.add('active');
  document.getElementById(`admin-view-${tab}`).style.display = 'block';
}

function openAddAttendantModal() {
  const name = prompt('Nome completo do novo atendente:');
  if (!name) return;
  const email = prompt('E-mail institucional:');
  if (!email) return;
  const department = prompt('Departamento (ex: Secretaria Acadêmica, Suporte TI, Financeiro):', 'Secretaria Acadêmica');

  fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, role: 'attendant', department })
  }).then(() => loadAttendants());
}
