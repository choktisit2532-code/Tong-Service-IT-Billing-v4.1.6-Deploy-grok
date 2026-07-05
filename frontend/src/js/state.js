/**
 * state.js
 * Global application state + permission helpers
 * Phase 1 Refactor - Tong Service IT Billing v4.1.6
 */

import { ROLE_LABELS, initials } from './utils.js';

export const state = {
  user: null,
  settings: null,
  customers: [],
  products: [],
  currentView: 'dashboard',
  dashboardAnalytics: null,
  reportChartData: null,
  editingDocumentId: null,
  documentWizardStep: 1,
  documentsTrashMode: false,
  customerStatus: 'active',
  productStatus: 'active',
  permissions: [],
  advancedReportData: null,
  auditRows: []
};

export const chartInstances = new Map();

export function hasPermission(permission) {
  if (!permission) return true;
  if (state.user?.role === 'admin') return true;
  return (state.permissions || state.user?.permissions || []).includes(permission);
}

export function setElementPermissionState() {
  document.querySelectorAll('[data-permission]').forEach((el) => {
    const allowed = hasPermission(el.dataset.permission);
    el.classList.toggle('hidden', !allowed);
    if ('disabled' in el) el.disabled = !allowed;
  });
}

/**
 * Apply role-based UI visibility (admin-only, writer-only, permissions)
 */
export function applyRole() {
  if (!state.user) return;

  state.permissions = state.user.permissions || [];
  const isAdmin = state.user.role === 'admin';
  const canWrite = hasPermission('document.create') || hasPermission('customer.create') || hasPermission('product.create');

  document.querySelectorAll('.admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin));
  document.querySelectorAll('.writer-only').forEach((el) => el.classList.toggle('hidden', !canWrite));
  setElementPermissionState();

  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl) nameEl.textContent = state.user.name || '';
  if (roleEl) roleEl.textContent = ROLE_LABELS[state.user.role] || state.user.role;
  if (avatarEl) avatarEl.textContent = initials(state.user.name || 'U'); // initials from utils.js
}
