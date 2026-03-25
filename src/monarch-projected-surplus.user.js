// src/monarch-projected-surplus.user.js
// ==UserScript==
// @name         Monarch Money Projected Surplus
// @namespace    https://github.com/user/monarch-projected-surplus
// @version      1.0.0
// @description  Shows projected surplus/deficit on Monarch Money budget page
// @match        https://app.monarch.com/plan*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const ELEMENT_ID = 'projected-surplus-indicator';

  // --- Utility ---

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  }

  function parseCurrency(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0;
  }

  // --- Calculation (inlined from src/calculate.js) ---

  function computeProjectedSurplus(incomeBudget, categories) {
    const totalEffectiveCost = categories.reduce((sum, cat) => {
      return sum + Math.max(cat.actual, cat.budget);
    }, 0);
    return incomeBudget - totalEffectiveCost;
  }

  // --- DOM Parsing ---
  // Selectors from docs/dom-selectors.md — replace SELECTOR_* placeholders

  function getIncomeBudget() {
    // Find the "Total Income" row's Budget column value
    const el = document.querySelector('SELECTOR_TOTAL_INCOME_BUDGET');
    return el ? parseCurrency(el.textContent) : null;
  }

  function getExpenseCategories() {
    // Try per-row extraction first
    const rows = document.querySelectorAll('SELECTOR_EXPENSE_ROWS');
    if (rows.length > 0) {
      return Array.from(rows).map(row => ({
        budget: parseCurrency(row.querySelector('SELECTOR_ROW_BUDGET')?.textContent),
        actual: parseCurrency(row.querySelector('SELECTOR_ROW_ACTUAL')?.textContent),
      }));
    }

    // Fallback: section-level totals
    const sections = document.querySelectorAll('SELECTOR_EXPENSE_SECTIONS');
    return Array.from(sections).map(section => ({
      budget: parseCurrency(section.querySelector('SELECTOR_SECTION_BUDGET')?.textContent),
      actual: parseCurrency(section.querySelector('SELECTOR_SECTION_ACTUAL')?.textContent),
    }));
  }

  // --- Display ---

  function createIndicator() {
    const container = document.createElement('div');
    container.id = ELEMENT_ID;
    container.style.cssText = `
      text-align: center;
      padding: 16px;
      border-radius: 12px;
      margin-top: 12px;
    `;

    const valueEl = document.createElement('div');
    valueEl.className = 'projected-surplus-value';
    valueEl.style.cssText = 'font-size: 28px; font-weight: bold;';

    const labelEl = document.createElement('div');
    labelEl.className = 'projected-surplus-label';
    labelEl.style.cssText = 'font-size: 13px; opacity: 0.8; margin-top: 4px;';

    const tooltipEl = document.createElement('span');
    tooltipEl.textContent = ' \u24D8';
    tooltipEl.title = 'Income budget minus the greater of actual or budgeted spending per category';
    tooltipEl.style.cssText = 'cursor: help; opacity: 0.5; font-size: 12px;';

    labelEl.appendChild(document.createTextNode(''));
    labelEl.appendChild(tooltipEl);

    container.appendChild(valueEl);
    container.appendChild(labelEl);
    return container;
  }

  function formatCurrency(amount) {
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return amount < 0 ? `-${formatted}` : formatted;
  }

  function updateIndicator(container, surplus) {
    const isPositive = surplus >= 0;
    const valueEl = container.querySelector('.projected-surplus-value');
    const labelEl = container.querySelector('.projected-surplus-label');

    valueEl.textContent = formatCurrency(surplus);
    valueEl.style.color = isPositive ? '#4ade80' : '#ef4444';
    container.style.backgroundColor = isPositive
      ? 'rgba(74, 222, 128, 0.08)'
      : 'rgba(239, 68, 68, 0.08)';

    const tooltipEl = labelEl.querySelector('span');
    labelEl.textContent = '';
    labelEl.appendChild(
      document.createTextNode(isPositive ? 'Projected Surplus' : 'Projected Deficit')
    );
    labelEl.appendChild(tooltipEl);
  }

  // --- Orchestration ---

  let observer = null;
  let isUpdating = false;

  function calculate() {
    if (isUpdating) return;
    isUpdating = true;

    try {
      const incomeBudget = getIncomeBudget();
      if (incomeBudget === null) return; // page not ready

      const categories = getExpenseCategories();
      const surplus = computeProjectedSurplus(incomeBudget, categories);

      let indicator = document.getElementById(ELEMENT_ID);
      if (!indicator) {
        indicator = createIndicator();
        // Insert after the "Left to budget" container
        const leftToBudget = document.querySelector('SELECTOR_LEFT_TO_BUDGET');
        if (leftToBudget) {
          leftToBudget.parentNode.insertBefore(indicator, leftToBudget.nextSibling);
        }
      }
      updateIndicator(indicator, surplus);
    } finally {
      isUpdating = false;
    }
  }

  function startObserving() {
    if (observer) observer.disconnect();

    // Debounce recalculations
    let timeout;
    observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(calculate, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    const indicator = document.getElementById(ELEMENT_ID);
    if (indicator) indicator.remove();
  }

  // --- SPA Navigation ---

  function isBudgetPage() {
    return window.location.pathname.startsWith('/plan');
  }

  function onNavigate() {
    if (isBudgetPage()) {
      waitForElement('SELECTOR_LEFT_TO_BUDGET').then(() => {
        calculate();
        startObserving();
      }).catch(() => {
        console.warn('[Projected Surplus] Timed out waiting for budget page elements');
      });
    } else {
      stopObserving();
    }
  }

  // Listen for SPA navigation (pushState / popstate)
  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    onNavigate();
  };
  window.addEventListener('popstate', onNavigate);

  // Initial run
  onNavigate();
})();
