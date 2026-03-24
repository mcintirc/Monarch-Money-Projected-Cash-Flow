# Monarch Money Projected Surplus — Tampermonkey Userscript

## Problem

Monarch Money's budget page uses a "Left to budget" indicator based on zero-based budgeting (income minus total budgeted expenses). This number doesn't reflect actual overspending — if you go $100 over in a category, "Left to budget" doesn't change. The user wants a live indicator that answers: "Am I projected to earn more than I'm spending this month?"

## Formula

```
Projected Surplus = Total Budgeted Income - Σ max(actual_spent, budgeted_amount) per expense category
```

For each expense category:
- If actual spending < budgeted amount → use budgeted amount (you'll probably spend the rest)
- If actual spending > budgeted amount → use actual spending (the overspend is real)

Unbudgeted categories (no budget set, but actual spending exists) are included — their effective cost is their actual spending.

A positive result means surplus; negative means deficit.

## Technical Approach: DOM Scraping

A Tampermonkey userscript that reads values directly from the Monarch budget page DOM, computes the projected surplus, and injects the result into the sidebar. No API calls, no authentication, no data storage.

### Target URL

`app.monarch.com/plan*` (the budget page)

### Data Extraction

The script scrapes from the rendered budget table:

1. **Total Budgeted Income** — the "Budget" column from the "Total Income" summary row
2. **Per-category expense data** — for every expense row, grab Budget and Actual values
3. **Section-level fallback** — the script prefers per-row data when individual category rows are visible in the DOM. If rows are collapsed, fall back to section totals (Fixed, Flexible, Non-Monthly). Note: section totals are a degraded fallback because `max(section_actual, section_budget)` can mask per-category overspends that are offset by underspends elsewhere

Calculation: `Total Budgeted Income - Σ max(actual, budget)` for all expense categories.

### Display & Injection

**Placement:** New element injected as a sibling directly below the existing "Left to budget" indicator in the right sidebar panel.

**Visual treatment:**
- Matches Monarch's dark theme styling (font size, border-radius, spacing)
- **Positive (surplus):** Green background tint, green text, labeled "Projected Surplus"
- **Negative (deficit):** Red background tint, red text, labeled "Projected Deficit"
- Info tooltip (circle-i icon, matching Monarch's existing one) explaining: "Income budget minus the greater of actual or budgeted spending per category"
- Unique element ID to prevent duplicate injection on recalculation

### Reactivity

A `MutationObserver` on the main content area triggers recalculation when:
- User navigates to a different month
- User edits a budget amount inline
- User expands/collapses sections or "Show N unbudgeted" categories
- SPA navigation back to the budget page

### Script Lifecycle

1. Tampermonkey loads the script on `app.monarch.com/plan*`
2. Script waits for the sidebar and budget table to appear in the DOM
3. First calculation runs, element is injected
4. MutationObserver watches for changes, recalculates and updates the injected element
5. On SPA navigation away, observer disconnects; reconnects when budget page is visited again

### Edge Cases

| Scenario | Handling |
|---|---|
| Collapsed expense sections | Use section-level totals (always visible) as fallback |
| "Show N unbudgeted" not expanded | Section totals already include unbudgeted actuals |
| Beginning of month (no spending) | Surplus = income budget - expense budget (still useful) |
| SPA navigation away and back | Script re-detects budget page, reinjects if needed |
| Monarch DOM structure changes | Selectors break — user updates script. This is the known tradeoff of DOM scraping. |

### Out of Scope

- Login/authentication handling
- Persistent data storage or history
- Network requests or API interaction
- Modifying any existing Monarch functionality
- Support for pages other than the budget page
