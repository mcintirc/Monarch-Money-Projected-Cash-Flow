# Monarch Projected Surplus Userscript — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tampermonkey userscript that injects a "Projected Surplus/Deficit" indicator below the "Left to budget" card on Monarch Money's budget page.

**Architecture:** Single self-contained userscript. Core calculation is a pure function (`computeProjectedSurplus`) that takes structured data and returns a number. DOM parsing functions extract data from the page. A display module injects and updates the indicator. A MutationObserver ties it all together reactively.

**Tech Stack:** Tampermonkey userscript (vanilla JS), Node.js for unit tests of pure logic

**Spec:** `docs/superpowers/specs/2026-03-24-monarch-projected-surplus-design.md`
**Reference screenshot:** `budget-screenshot.jpg`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/monarch-projected-surplus.user.js` | The complete Tampermonkey userscript — metadata block, DOM parsing, calculation, display injection, reactivity. Self-contained single file. |
| `src/calculate.js` | Extracted pure calculation function, used for testing. The userscript inlines this logic. |
| `test/calculate.test.js` | Unit tests for the surplus calculation logic |
| `package.json` | Minimal — just a test script and dev dependency on a test runner |

---

### Task 1: DOM Discovery with Playwright

Use Playwright MCP to inspect the live Monarch budget page and document the exact DOM selectors needed. This task must be done interactively with the user logged into Monarch.

**Files:**
- Create: `docs/dom-selectors.md`

- [ ] **Step 1: Navigate to the budget page**

Use Playwright MCP to open `https://app.monarch.com/plan`. The user must be logged in.

- [ ] **Step 2: Identify the "Left to budget" container**

Inspect the right sidebar. Find the element containing the "-$349" value and the "Left to budget" label. Document the selector path and its parent container (we inject our element as a sibling after this).

- [ ] **Step 3: Identify the "Total Income" budget value**

In the main table, find the "Total Income" summary row. Document the selector for the "Budget" column cell (shows "$8,765" in the screenshot).

- [ ] **Step 4: Identify expense category rows**

Find all individual expense rows within the Fixed, Flexible, and Non-Monthly sections. Document selectors for:
- Each row's category name
- Each row's "Budget" cell
- Each row's "Actual" cell

- [ ] **Step 5: Identify section-level totals**

Find the section summary rows (Fixed, Flexible, Non-Monthly). Document selectors for each section's Budget and Actual totals. These are the fallback when individual rows are collapsed.

- [ ] **Step 6: Identify "Show N unbudgeted" toggle**

Find the element that reveals unbudgeted categories. Document its selector so we can detect whether it's been expanded.

- [ ] **Step 7: Write selector documentation**

Save all discovered selectors to `docs/dom-selectors.md` with examples of the HTML structure.

- [ ] **Step 8: Commit**

```bash
git add docs/dom-selectors.md
git commit -m "Document Monarch budget page DOM selectors"
```

---

### Task 2: Project Setup & Calculation Logic

Set up the project and write the core pure calculation function with tests.

**Files:**
- Create: `package.json`
- Create: `src/calculate.js`
- Create: `test/calculate.test.js`

- [ ] **Step 1: Initialize project**

```bash
npm init -y
npm install --save-dev vitest
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Write failing tests for computeProjectedSurplus**

```js
// test/calculate.test.js
import { describe, it, expect } from 'vitest';
import { computeProjectedSurplus } from '../src/calculate.js';

describe('computeProjectedSurplus', () => {
  it('returns surplus when under budget in all categories', () => {
    const result = computeProjectedSurplus(5000, [
      { budget: 1000, actual: 800 },
      { budget: 500, actual: 300 },
    ]);
    // 5000 - max(800,1000) - max(300,500) = 5000 - 1000 - 500 = 3500
    expect(result).toBe(3500);
  });

  it('accounts for overspending in a category', () => {
    const result = computeProjectedSurplus(5000, [
      { budget: 1000, actual: 1200 },
      { budget: 500, actual: 300 },
    ]);
    // 5000 - max(1200,1000) - max(300,500) = 5000 - 1200 - 500 = 3300
    expect(result).toBe(3300);
  });

  it('returns negative when projected to overspend income', () => {
    const result = computeProjectedSurplus(1000, [
      { budget: 600, actual: 700 },
      { budget: 500, actual: 500 },
    ]);
    // 1000 - max(700,600) - max(500,500) = 1000 - 700 - 500 = -200
    expect(result).toBe(-200);
  });

  it('includes unbudgeted categories (budget=0, actual>0)', () => {
    const result = computeProjectedSurplus(2000, [
      { budget: 500, actual: 400 },
      { budget: 0, actual: 150 },
    ]);
    // 2000 - max(400,500) - max(150,0) = 2000 - 500 - 150 = 1350
    expect(result).toBe(1350);
  });

  it('handles zero spending at start of month', () => {
    const result = computeProjectedSurplus(5000, [
      { budget: 2000, actual: 0 },
      { budget: 1000, actual: 0 },
    ]);
    // 5000 - max(0,2000) - max(0,1000) = 5000 - 2000 - 1000 = 2000
    expect(result).toBe(2000);
  });

  it('handles empty categories array', () => {
    const result = computeProjectedSurplus(5000, []);
    expect(result).toBe(5000);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `computeProjectedSurplus` not defined

- [ ] **Step 4: Implement computeProjectedSurplus**

```js
// src/calculate.js
/**
 * Compute projected surplus for the month.
 * @param {number} incomeBudget - Total budgeted income
 * @param {Array<{budget: number, actual: number}>} categories - Expense categories
 * @returns {number} Positive = surplus, negative = deficit
 */
export function computeProjectedSurplus(incomeBudget, categories) {
  const totalEffectiveCost = categories.reduce((sum, cat) => {
    return sum + Math.max(cat.actual, cat.budget);
  }, 0);
  return incomeBudget - totalEffectiveCost;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/calculate.js test/calculate.test.js
git commit -m "Add core projected surplus calculation with tests"
```

---

### Task 3: Userscript Skeleton with DOM Parsing

Create the Tampermonkey userscript with metadata block, DOM utility functions, and the parsing logic. Use the selectors discovered in Task 1.

**Files:**
- Create: `src/monarch-projected-surplus.user.js`

**Note:** All selectors below are placeholders (`SELECTOR_*`). Replace them with actual selectors from `docs/dom-selectors.md` discovered in Task 1.

- [ ] **Step 1: Create userscript with metadata block**

```js
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

  // Continued in Task 4...
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/monarch-projected-surplus.user.js
git commit -m "Add userscript skeleton with metadata, utilities, and DOM parsing"
```

---

### Task 4: Display Injection

Add the functions that create and update the projected surplus indicator in Monarch's sidebar.

**Files:**
- Modify: `src/monarch-projected-surplus.user.js`

- [ ] **Step 1: Add the display creation and update functions**

Insert before the closing `})();` in the userscript:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/monarch-projected-surplus.user.js
git commit -m "Add display injection and formatting for surplus indicator"
```

---

### Task 5: Reactivity & Main Loop

Wire everything together: initial calculation, MutationObserver for live updates, and SPA navigation handling.

**Files:**
- Modify: `src/monarch-projected-surplus.user.js`

- [ ] **Step 1: Add the main orchestration logic**

Insert before the closing `})();` in the userscript:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/monarch-projected-surplus.user.js
git commit -m "Add MutationObserver reactivity and SPA navigation handling"
```

---

### Task 6: Replace Selector Placeholders & Manual Test

With Playwright MCP available, inspect the live page, replace all `SELECTOR_*` placeholders with real selectors, and manually test the script.

**Files:**
- Modify: `src/monarch-projected-surplus.user.js`
- Modify: `docs/dom-selectors.md` (if selectors need updating)

- [ ] **Step 1: Use Playwright MCP to confirm/refine selectors**

Navigate to `https://app.monarch.com/plan` and use Playwright's inspection tools to verify or update every `SELECTOR_*` placeholder in the userscript. Cross-reference with `docs/dom-selectors.md`.

- [ ] **Step 2: Replace all placeholder selectors in the userscript**

Update every instance of `SELECTOR_*` in `src/monarch-projected-surplus.user.js` with the real CSS selectors.

- [ ] **Step 3: Install in Tampermonkey and test**

1. Open Tampermonkey in the browser
2. Create new script, paste contents of `src/monarch-projected-surplus.user.js`
3. Navigate to `https://app.monarch.com/plan`
4. Verify the indicator appears below "Left to budget"
5. Verify the number matches manual calculation
6. Try navigating to a different month — indicator should update
7. Try editing a budget amount — indicator should update

- [ ] **Step 4: Fix any issues found during testing**

Iterate on selectors, styling, or logic as needed.

- [ ] **Step 5: Commit**

```bash
git add src/monarch-projected-surplus.user.js docs/dom-selectors.md
git commit -m "Replace placeholder selectors with real Monarch DOM selectors"
```

---

### Task 7: Final Cleanup

Add a .gitignore and make the repo ready for use.

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
.superpowers/
```

- [ ] **Step 2: Run all tests one final time**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "Add .gitignore"
```
