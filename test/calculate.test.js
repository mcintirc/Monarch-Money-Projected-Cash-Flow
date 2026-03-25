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
