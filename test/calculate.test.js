import { describe, it, expect } from 'vitest';
import { computeProjectedSurplus, computeActualSurplus } from '../src/calculate.js';

describe('computeProjectedSurplus', () => {
  it('returns surplus when under budget in all categories', () => {
    const result = computeProjectedSurplus(5000, 3000, [
      { budget: 1000, actual: 800 },
      { budget: 500, actual: 300 },
    ]);
    // max(5000,3000) - max(800,1000) - max(300,500) = 5000 - 1000 - 500 = 3500
    expect(result).toBe(3500);
  });

  it('accounts for overspending in a category', () => {
    const result = computeProjectedSurplus(5000, 5000, [
      { budget: 1000, actual: 1200 },
      { budget: 500, actual: 300 },
    ]);
    // max(5000,5000) - max(1200,1000) - max(300,500) = 5000 - 1200 - 500 = 3300
    expect(result).toBe(3300);
  });

  it('returns negative when projected to overspend income', () => {
    const result = computeProjectedSurplus(1000, 800, [
      { budget: 600, actual: 700 },
      { budget: 500, actual: 500 },
    ]);
    // max(1000,800) - max(700,600) - max(500,500) = 1000 - 700 - 500 = -200
    expect(result).toBe(-200);
  });

  it('includes unbudgeted categories (budget=0, actual>0)', () => {
    const result = computeProjectedSurplus(2000, 1500, [
      { budget: 500, actual: 400 },
      { budget: 0, actual: 150 },
    ]);
    // max(2000,1500) - max(400,500) - max(150,0) = 2000 - 500 - 150 = 1350
    expect(result).toBe(1350);
  });

  it('handles zero spending at start of month', () => {
    const result = computeProjectedSurplus(5000, 0, [
      { budget: 2000, actual: 0 },
      { budget: 1000, actual: 0 },
    ]);
    // max(5000,0) - max(0,2000) - max(0,1000) = 5000 - 2000 - 1000 = 2000
    expect(result).toBe(2000);
  });

  it('handles empty categories array', () => {
    const result = computeProjectedSurplus(5000, 3000, []);
    // max(5000,3000) = 5000
    expect(result).toBe(5000);
  });

  it('uses actual income when it exceeds budget', () => {
    const result = computeProjectedSurplus(5000, 7000, [
      { budget: 2000, actual: 1500 },
    ]);
    // max(5000,7000) - max(1500,2000) = 7000 - 2000 = 5000
    expect(result).toBe(5000);
  });
});

describe('computeActualSurplus', () => {
  it('returns surplus when income exceeds spending', () => {
    const result = computeActualSurplus(5000, [
      { actual: 1200 },
      { actual: 800 },
    ]);
    // 5000 - 1200 - 800 = 3000
    expect(result).toBe(3000);
  });

  it('returns deficit when spending exceeds income', () => {
    const result = computeActualSurplus(2000, [
      { actual: 1500 },
      { actual: 1000 },
    ]);
    // 2000 - 1500 - 1000 = -500
    expect(result).toBe(-500);
  });

  it('ignores budget values entirely', () => {
    const result = computeActualSurplus(3000, [
      { budget: 5000, actual: 1000 },
      { budget: 2000, actual: 500 },
    ]);
    // 3000 - 1000 - 500 = 1500
    expect(result).toBe(1500);
  });
});
