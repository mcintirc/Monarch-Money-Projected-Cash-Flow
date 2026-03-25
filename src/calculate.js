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
