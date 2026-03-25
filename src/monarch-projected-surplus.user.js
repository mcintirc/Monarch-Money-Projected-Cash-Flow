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
  const WIDGET_ROOT_SEL = '[class*="PlanSummaryWidget__Root"]';
  const CARD_SEL = WIDGET_ROOT_SEL + ' .card';
  const COLORS = {
    light: {
      red: 'rgb(206, 44, 49)',
      green: 'rgb(33, 131, 88)',
      redBg: 'rgb(254, 235, 236)',
      greenBg: 'rgb(230, 246, 235)',
    },
    dark: {
      red: 'rgb(255, 149, 146)',
      green: 'rgb(61, 214, 140)',
      redBg: 'rgb(59, 18, 25)',
      greenBg: 'rgb(19, 45, 33)',
    },
  };

  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? COLORS.dark : COLORS.light;
  }

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
    const trimmed = text.trim();
    const isNegative = trimmed.startsWith('-') || (trimmed.startsWith('(') && trimmed.endsWith(')'));
    const cleaned = trimmed.replace(/[^0-9.]/g, '');
    return (parseFloat(cleaned) || 0) * (isNegative ? -1 : 1);
  }

  // --- Calculation (inlined from src/calculate.js) ---

  function computeProjectedSurplus(incomeBudget, incomeActual, categories) {
    const effectiveIncome = Math.max(incomeBudget, incomeActual);
    const totalEffectiveCost = categories.reduce((sum, cat) => {
      return sum + Math.max(cat.actual, cat.budget);
    }, 0);
    return effectiveIncome - totalEffectiveCost;
  }

  function computeActualSurplus(incomeActual, categories) {
    const totalSpent = categories.reduce((sum, cat) => sum + cat.actual, 0);
    return incomeActual - totalSpent;
  }

  function isPastMonth() {
    // Parse from page title, e.g. "Monarch | March 2026"
    const match = document.title.match(/(\w+)\s+(\d{4})/);
    if (!match) return false;

    const displayed = new Date(`${match[1]} 1, ${match[2]}`);
    const now = new Date();
    // Past if the displayed month's last day is before today
    const endOfDisplayed = new Date(displayed.getFullYear(), displayed.getMonth() + 1, 0);
    return endOfDisplayed < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // --- DOM Parsing ---
  // Selectors documented in docs/dom-selectors.md

  function getIncome() {
    const footers = document.querySelectorAll('[class*="PlanSectionFooter__Root"]');
    for (const footer of footers) {
      const title = footer.querySelector('[class*="PlanRowTitle__Title"]');
      if (title?.textContent?.trim() === 'Total Income') {
        const columns = footer.querySelectorAll('[class*="PlanGrid__PlanGridColumn"]');
        if (!columns[0]) return null;
        return {
          budget: parseCurrency(columns[0].textContent),
          actual: parseCurrency(columns[1]?.textContent),
        };
      }
    }
    return null;
  }

  function getExpenseCategories() {
    const sectionsContainer = document.querySelector('[class*="Plan__SectionsContainer"]');
    if (!sectionsContainer) return [];

    const expensesSection = sectionsContainer.children[1];
    if (!expensesSection) return [];

    // Per-row extraction: individual category rows within the expenses section
    const rows = expensesSection.querySelectorAll('[class*="PlanGroupRight__StyledPlanGridRow"]');
    if (rows.length > 0) {
      return Array.from(rows).map(row => {
        const input = row.querySelector('input');
        const columns = row.querySelectorAll('[class*="PlanGrid__PlanGridColumn"]');
        return {
          budget: parseCurrency(input?.value || columns[0]?.textContent),
          actual: parseCurrency(columns[1]?.textContent),
        };
      });
    }

    // Fallback: section-level group totals (Fixed, Flexible, Non-Monthly)
    const groupContainers = expensesSection.querySelectorAll('[class*="PlanGroupRight__Root"]');
    return Array.from(groupContainers).map(container => {
      const columns = container.querySelectorAll('[class*="PlanGrid__PlanGridColumn"]');
      return {
        budget: parseCurrency(columns[0]?.textContent),
        actual: parseCurrency(columns[1]?.textContent),
      };
    });
  }

  // --- Display ---

  function createIndicator() {
    const container = document.createElement('div');
    container.id = ELEMENT_ID;
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      border-radius: 8px;
      gap: 2px;
      margin: 16px;
    `;

    const valueEl = document.createElement('div');
    valueEl.className = 'projected-surplus-value';
    valueEl.style.cssText = 'font-size: 30px; font-weight: 500; line-height: 45px; font-family: Oracle, sans-serif;';

    const labelEl = document.createElement('div');
    labelEl.className = 'projected-surplus-label';
    labelEl.style.cssText = 'font-size: 16px; font-weight: 500; font-family: Oracle, sans-serif;';

    const tooltipEl = document.createElement('span');
    tooltipEl.textContent = ' \u24D8';
    tooltipEl.style.cssText = 'cursor: help; opacity: 0.5;';

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

  function updateIndicator(container, surplus, isPast) {
    const isPositive = surplus >= 0;
    const theme = getThemeColors();
    const color = isPositive ? theme.green : theme.red;
    const bg = isPositive ? theme.greenBg : theme.redBg;
    const valueEl = container.querySelector('.projected-surplus-value');
    const labelEl = container.querySelector('.projected-surplus-label');

    valueEl.textContent = formatCurrency(surplus);
    valueEl.style.color = color;
    labelEl.style.color = color;
    container.style.backgroundColor = bg;

    const prefix = isPast ? '' : 'Projected ';
    const word = isPositive ? 'Surplus' : 'Deficit';
    const tooltipEl = labelEl.querySelector('span');
    tooltipEl.title = isPast
      ? 'Actual income minus actual spending'
      : 'Greater of income budget or actual, minus the greater of actual or budgeted spending per category';
    labelEl.textContent = '';
    labelEl.appendChild(document.createTextNode(prefix + word));
    labelEl.appendChild(tooltipEl);
  }

  // --- Orchestration ---

  let observer = null;
  let isUpdating = false;

  function calculate() {
    if (isUpdating) return;
    isUpdating = true;

    // Pause observer while we modify the DOM to prevent feedback loops
    if (observer) observer.disconnect();

    try {
      const income = getIncome();
      if (income === null) return; // page not ready

      const categories = getExpenseCategories();
      const past = isPastMonth();
      const surplus = past
        ? computeActualSurplus(income.actual, categories)
        : computeProjectedSurplus(income.budget, income.actual, categories);

      let indicator = document.getElementById(ELEMENT_ID);
      if (!indicator) {
        const card = document.querySelector(CARD_SEL);
        if (!card) return; // can't inject yet
        indicator = createIndicator();
        card.appendChild(indicator);
      }
      updateIndicator(indicator, surplus, past);
    } finally {
      isUpdating = false;
      // Resume observer after our DOM changes are done
      if (observer) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
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
      waitForElement(WIDGET_ROOT_SEL).then(() => {
        if (!isBudgetPage()) return; // navigated away before element appeared
        calculate();
        startObserving();
      }).catch(() => {
        console.warn('[Projected Surplus] Timed out waiting for budget page elements');
      });
    } else {
      stopObserving();
    }
  }

  // Listen for SPA navigation (pushState / replaceState / popstate)
  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    onNavigate();
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    onNavigate();
  };
  window.addEventListener('popstate', onNavigate);

  // Initial run
  onNavigate();
})();
