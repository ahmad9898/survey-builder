import { describe, expect, it } from 'vitest';
import { computeScore } from '../../src/domain/scoringEngine';
import type { ScoringMap } from '../../src/types/survey';

describe('computeScore', () => {
  it('sums flat option scores for single-choice answers', () => {
    const scoringMap: ScoringMap = {
      '#/properties/switchReason': { optionScores: { Price: 1, Features: 3, Support: 2, Other: 0 } },
    };
    expect(computeScore(scoringMap, { switchReason: 'Features' }, undefined, undefined).total).toBe(3);
    expect(computeScore(scoringMap, { switchReason: 'Other' }, undefined, undefined).total).toBe(0);
    expect(computeScore(scoringMap, {}, undefined, undefined).total).toBe(0);
  });

  it('sums option scores across a multi-select array answer', () => {
    const scoringMap: ScoringMap = {
      '#/properties/features': { optionScores: { A: 1, B: 2, C: 4 } },
    };
    expect(computeScore(scoringMap, { features: ['A', 'C'] }, undefined, undefined).total).toBe(5);
    expect(computeScore(scoringMap, { features: [] }, undefined, undefined).total).toBe(0);
  });

  it('applies linear range scoring at min, max, and midpoint', () => {
    const scoringMap: ScoringMap = {
      '#/properties/npsScore': { linearScore: { min: 0, max: 10, minPoints: 0, maxPoints: 5 } },
    };
    expect(computeScore(scoringMap, { npsScore: 0 }, undefined, undefined).total).toBe(0);
    expect(computeScore(scoringMap, { npsScore: 10 }, undefined, undefined).total).toBe(5);
    expect(computeScore(scoringMap, { npsScore: 5 }, undefined, undefined).total).toBe(2.5);
  });

  it('clamps out-of-range values for linear scoring', () => {
    const scoringMap: ScoringMap = {
      '#/properties/n': { linearScore: { min: 0, max: 10, minPoints: 0, maxPoints: 10 } },
    };
    expect(computeScore(scoringMap, { n: -5 }, undefined, undefined).total).toBe(0);
    expect(computeScore(scoringMap, { n: 999 }, undefined, undefined).total).toBe(10);
  });

  it('applies flat valueScore for boolean fields only when true', () => {
    const scoringMap: ScoringMap = { '#/properties/agreed': { valueScore: 10 } };
    expect(computeScore(scoringMap, { agreed: true }, undefined, undefined).total).toBe(10);
    expect(computeScore(scoringMap, { agreed: false }, undefined, undefined).total).toBe(0);
    expect(computeScore(scoringMap, {}, undefined, undefined).total).toBe(0);
  });

  it('does not throw and contributes 0 for missing/unanswered fields', () => {
    const scoringMap: ScoringMap = {
      '#/properties/a': { optionScores: { X: 5 } },
      '#/properties/b': { linearScore: { min: 0, max: 10, minPoints: 0, maxPoints: 10 } },
    };
    const result = computeScore(scoringMap, {}, undefined, undefined);
    expect(result.total).toBe(0);
  });

  it('aggregates per-category subtotals', () => {
    const scoringMap: ScoringMap = {
      '#/properties/a': { categoryId: 'fit', optionScores: { X: 3 } },
      '#/properties/b': { categoryId: 'fit', valueScore: 2 },
      '#/properties/c': { categoryId: 'other', valueScore: 5 },
    };
    const categories = [
      { id: 'fit', label: 'Product Fit' },
      { id: 'other', label: 'Other' },
    ];
    const result = computeScore(scoringMap, { a: 'X', b: true, c: false }, categories, undefined);
    expect(result.total).toBe(5);
    // "other" still appears (with 0 points) since a question in that category was
    // answered; categories are only omitted when no scoring-map entry references them.
    expect(result.byCategory).toEqual([
      { categoryId: 'fit', label: 'Product Fit', points: 5 },
      { categoryId: 'other', label: 'Other', points: 0 },
    ]);
  });

  it('pass/fail threshold boundary: equal to threshold counts as pass', () => {
    const scoringMap: ScoringMap = { '#/properties/a': { valueScore: 5 } };
    expect(computeScore(scoringMap, { a: true }, undefined, 5).passed).toBe(true);
    expect(computeScore(scoringMap, { a: true }, undefined, 6).passed).toBe(false);
    expect(computeScore(scoringMap, {}, undefined, undefined).passed).toBeUndefined();
  });
});
