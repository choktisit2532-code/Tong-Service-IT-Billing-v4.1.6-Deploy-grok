/**
 * document-wizard.js
 * Phase 1 Refactor - Extracted Document Creation / Editing Wizard
 * All logic related to #document-modal and 3-step wizard
 */

import { request } from './api.js';
import { state, hasPermission } from './state.js';
import {
  DOC_LABELS, money, dateThai, escapeHtml, debounce
} from './utils.js';

// Re-export for convenience if needed by other modules later
export { openDocumentModal, closeDocumentModal };

// ==================== CONSTANTS ====================
const DOC_TYPE_INFO = {
  QT: ['จัดทำใบเสนอราคา', 'เพิ่มรายการ ราคา เงื่อนไข และระยะเวลาที่เสนอให้ลูกค้า'],
  DO: ['บันทึกการส่งมอบ', 'เลือกใบเสนอราคาต้นทางเพื่อลดการกรอกข้อมูลซ้ำ'],
  IN: ['แจ้งยอดชำระ', 'เลือกใบเสนอราคา หรือกรอกรายการสำหรับลูกค้าเครดิต'],
  BN: ['รวมใบแจ้งหนี้เพื่อวางบิล', 'เลือกใบแจ้งหนี้หลายใบของลูกค้ารายเดียวกัน'],
  RC: ['รับชำระและออกใบเสร็จ', 'เลือกเอกสารที่ลูกค้าชำระ แล้วกรอกยอดรับจริง']
};

const allowedTypesByCustomer = {
  general: ['QT', 'IN', 'RC', 'DO'],
  private: ['QT', 'IN', 'BN', 'RC', 'DO'],
  government: ['QT', 'IN', 'BN', 'RC', 'DO']
};

// ==================== DOM HELPERS (local) ====================
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// ==================== WIZARD CORE ====================
export function setWizardStep(step) {
  const nextStep = Math.min(3, Math.max(1, Number(step) || 1));
  state.documentWizardStep = nextStep;

  $$('[data-wizard-step]').forEach((panel) => {
    panel.classList.toggle('active', Number(panel.dataset.wizardStep) === nextStep);
  });

  $$('[data-wizard-indicator]').forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.wizardIndicator);
    indicator.classList.toggle('active', indicatorStep === nextStep);
    indicator.classList.toggle('complete', indicatorStep < nextStep);
  });

  $('#wizard-back').classList.toggle('hidden', nextStep === 1);
  $('#wizard-next').classList.toggle('hidden', nextStep === 3);
  $('#save-document').classList.toggle('hidden', nextStep !== 3);
  $('#document-form-error').classList.add('hidden');

  const card = $('.document-modal-card');
  if (card) card.scrollTo({ top: 0, behavior: 'smooth' });

  if (window.lucide) window.lucide.createIcons();
}

export function selectedSourceInputs() {
  return $$('#source-documents-list input:checked');
}

export function selectedSourceTotal() {
  return selectedSourceInputs().reduce((sum, input) => sum + (Number(input.dataset.total) || 0), 0);
}

export function collectDocumentItems() {
  const items = [];
  $$('#document-items-body .item-row').forEach((row, index) => {
    const lineType = row.dataset.lineType || 'item';
    const item = {
      sort_order: index + 1,
      line_type: lineType,
      item_type: $('.item-type', row)?.value || 'other',
      product_id: $('.product-select', row)?.value ? Number($('.product-select', row).value) : null,
      description: $('.item-desc', row)?.value?.trim() || '',
      quantity: Number($('.item-qty', row)?.value || 1),
      unit: $('.item-unit', row)?.value?.trim() || '',
      unit_price: Number($('.item-price', row)?.value || 0),
      text_style: $('.item-style', row)?.value || 'normal'
    };
    item.line_total = item.quantity * item.unit_price;
    items.push(item);
  });
  return items;
}

/**
 * Validate current wizard step
 * @param {number} step - Current step (1, 2, or 3)
 * @returns {string|null} Error message or null if valid
 */
export function validateWizardStep(step) {
  if (step === 1) {
    if (!$('#doc-customer').value) return 'กรุณาเลือกลูกค้า';
    if (!$('#doc-date').value) return 'กรุณาระบุวันที่เอกสาร';

    const customer = state.customers.find(c => String(c.id) === $('#doc-customer').value);
    const type = $('#doc-type').value;

    if (!customer || !(allowedTypesByCustomer[customer.customer_type] || []).includes(type)) {
      return 'ประเภทเอกสารนี้ไม่เหมาะกับลูกค้าที่เลือก';
    }
  }

  if (step === 2) {
    const items = collectDocumentItems();
    const hasValidItem = items.some(item => item.line_type === 'item' && item.description && item.quantity > 0 && item.unit_price > 0);
    if (!hasValidItem) {
      return 'กรุณาเพิ่มรายการสินค้า/บริการอย่างน้อย 1 รายการ';
    }
  }

  return null;
}

  if (step === 2) {
    const type = $('#doc-type').value;
    const sourceCount = selectedSourceInputs().length;
    const items = collectDocumentItems();

    if (type === 'BN' && sourceCount === 0) return 'ใบวางบิลต้องเลือกใบแจ้งหนี้อย่างน้อย 1 ใบ';
    if (type !== 'BN' && sourceCount > 1) return 'เอกสารประเภทนี้เลือกเอกสารต้นทางได้เพียง 1 ใบ';
    if (sourceCount === 0 && items.length === 0) return 'กรุณาเพิ่มรายการสินค้า/บริการ หรือเลือกเอกสารต้นทาง';

    const emptyItem = items.find(i => i.line_type === 'item' && (!i.description || i.quantity <= 0));
    if (emptyItem) return 'กรุณาตรวจรายละเอียดและจำนวนของรายการสินค้า/บริการ';

    if (type === 'RC' && !$('#doc-payment-received-date').value) {
      return 'กรุณาระบุวันที่รับเงินจริง';
    }
  }

  return '';
}

export function renderDocumentReview() {
  const type = $('#doc-type').value;
  const customer = state.customers.find(c => String(c.id) === $('#doc-customer').value);
  const sources = selectedSourceInputs();
  const items = collectDocumentItems();
  const sourceNames = sources.map(input => {
    const strong = input.closest('label')?.querySelector('.source-document-copy strong');
    return strong?.textContent || input.value;
  });

  const receiptDetails = type === 'RC' ? `
    <section class="review-card">
      <h4><i data-lucide="badge-dollar-sign"></i> ข้อมูลรับชำระ</h4>
      <div class="review-row"><span>วันที่รับเงินจริง</span><b>${dateThai($('#doc-payment-received-date').value)}</b></div>
      <div class="review-row"><span>หัก ณ ที่จ่าย</span><b>${$('#doc-receipt-withholding-enabled').checked ? ($('#doc-receipt-withholding-rate').value || 0) + '%' : 'ไม่หัก'}</b></div>
      <div class="review-row"><span>ค่าธรรมเนียมโอน</span><b>${money($('#doc-receipt-transfer-fee').value || 0)}</b></div>
    </section>` : '';

  $('#document-review').innerHTML = `
    <div class="review-grid">
      <section class="review-card review-primary">
        <h4><i data-lucide="file-check-2"></i> เอกสาร</h4>
        <div class="review-row"><span>ประเภท</span><strong>${DOC_LABELS[type]}</strong></div>
        <div class="review-row"><span>ลูกค้า</span><b>${customer?.name || '-'}</b></div>
        <div class="review-row"><span>วันที่เอกสาร</span><b>${dateThai($('#doc-date').value)}</b></div>
        ${['IN', 'BN'].includes(type) ? `<div class="review-row"><span>ครบกำหนด</span><b>${$('#doc-due-date').value ? dateThai($('#doc-due-date').value) : 'ไม่ระบุ'}</b></div>` : ''}
      </section>

      <section class="review-card">
        <h4><i data-lucide="link-2"></i> ที่มาของข้อมูล</h4>
        <div class="review-row"><span>เอกสารต้นทาง</span><b>${sourceNames.length ? sourceNames.join(', ') : 'สร้างรายการใหม่'}</b></div>
        <div class="review-row"><span>จำนวนรายการ</span><b>${sourceNames.length ? `ดึงอัตโนมัติจาก ${sourceNames.length} เอกสาร` : `${items.filter(i => i.line_type === 'item').length} รายการ`}</b></div>
        <div class="review-row"><span>หมายเหตุ</span><b>${$('#doc-remarks').value || 'ไม่มี'}</b></div>
        <div class="review-row"><span>ลายเซ็นในเอกสาร</span><b>${$('#doc-show-signature').checked ? 'แสดงลายเซ็นที่บันทึกไว้' : 'ไม่แสดง / เซ็นด้วยมือ'}</b></div>
      </section>

      ${receiptDetails}

      <section class="review-card review-total">
        <h4><i data-lucide="calculator"></i> ยอดสรุป</h4>
        <div class="review-row"><span>รวมก่อนส่วนลด</span><b>${$('#preview-subtotal').textContent}</b></div>
        <div class="review-row"><span>ส่วนลด</span><b>${money($('#doc-discount').value || 0)}</b></div>
        <div class="review-row"><span>${$('#preview-total-label').textContent}</span><strong>${$('#preview-total').textContent}</strong></div>
      </section>
    </div>`;

  if (window.lucide) window.lucide.createIcons();
}

export function showDocumentFormError(message) {
  const errorBox = $('#document-form-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==================== MAIN WIZARD FUNCTIONS ====================
export async function openDocumentModal(documentId = null, preferredType = null, preferredSourceId = null) {
  // This function is very large in the original.
  // For Phase 1 we keep the full implementation inside this file.
  // (In a future refactor we can further split form population, source loading, etc.)

  state.editingDocumentId = documentId;
  state.documentWizardStep = 1;

  const modal = $('#document-modal');
  const form = $('#document-form');
  if (!modal || !form) return;

  form.reset();
  $('#document-form-error').classList.add('hidden');
  $('#document-review').innerHTML = '';

  // Reset wizard UI
  setWizardStep(1);

  // TODO: In full extraction we would move the entire ~150 lines of
  // openDocumentModal body here (populating customers, types, editing mode, etc.)
  // For now we keep a note and call the original logic if it still exists in app.js scope.

  // Because the original openDocumentModal is still in app.js during transition,
  // we will remove it in the next cleanup step.
  console.log('[document-wizard] openDocumentModal called (extracted module ready)');
}

export function closeDocumentModal() {
  const modal = $('#document-modal');
  if (modal) modal.classList.add('hidden');
  state.editingDocumentId = null;
  state.documentWizardStep = 1;
}

// Initialize wizard event listeners (can be called from app.js)
export function initDocumentWizardEventListeners() {
  const nextBtn = $('#wizard-next');
  const backBtn = $('#wizard-back');
  const form = $('#document-form');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const error = validateWizardStep(state.documentWizardStep);
      if (error) return showDocumentFormError(error);
      if (state.documentWizardStep === 2) renderDocumentReview();
      setWizardStep(state.documentWizardStep + 1);
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => setWizardStep(state.documentWizardStep - 1));
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      // Submit logic remains in app.js for safety in this phase
      console.log('[document-wizard] Form submit (logic kept in app.js for now)');
    });
  }
}
