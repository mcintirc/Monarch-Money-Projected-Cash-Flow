/**
 * Compute projected surplus for the current or a future month.
 * Uses max(budget, actual) for both income and expenses.
 * @param {number} incomeBudget - Total budgeted income
 * @param {number} incomeActual - Total actual income received
 * @param {Array<{budget: number, actual: number}>} categories - Expense categories
 * @returns {number} Positive = surplus, negative = deficit
 */
export function computeProjectedSurplus(incomeBudget, incomeActual, categories) {
  const effectiveIncome = Math.max(incomeBudget, incomeActual);
  const totalEffectiveCost = categories.reduce((sum, cat) => {
    return sum + Math.max(cat.actual, cat.budget);
  }, 0);
  return effectiveIncome - totalEffectiveCost;
}

/**
 * Compute actual surplus for a past month.
 * Uses only actual values — what really happened.
 * @param {number} incomeActual - Total actual income received
 * @param {Array<{actual: number}>} categories - Expense categories
 * @returns {number} Positive = surplus, negative = deficit
 */
export function computeActualSurplus(incomeActual, categories) {
  const totalSpent = categories.reduce((sum, cat) => sum + cat.actual, 0);
  return incomeActual - totalSpent;
}
