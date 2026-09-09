import type { ScoringMap } from '../types/survey';
import type { ScoreByCategory, ScoreResult } from '../types/response';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getValueAtScope(answers: Record<string, unknown>, scope: string): unknown {
  const key = scope.split('/').pop();
  return key ? answers[key] : undefined;
}

function scoreForEntry(entry: ScoringMap[string], value: unknown): number {
  if (entry.optionScores) {
    if (Array.isArray(value)) {
      return value.reduce((sum, v) => sum + (entry.optionScores![String(v)] ?? 0), 0);
    }
    if (value === undefined || value === null) return 0;
    return entry.optionScores[String(value)] ?? 0;
  }

  if (entry.valueScore !== undefined) {
    if (typeof value === 'boolean') return value ? entry.valueScore : 0;
    const answered = value !== undefined && value !== null && value !== '';
    return answered ? entry.valueScore : 0;
  }

  if (entry.linearScore) {
    const { min, max, minPoints, maxPoints } = entry.linearScore;
    if (typeof value !== 'number' || max === min) return 0;
    const clamped = Math.min(Math.max(value, min), max);
    const ratio = (clamped - min) / (max - min);
    return minPoints + ratio * (maxPoints - minPoints);
  }

  return 0;
}

// Computes total and per-category scores from a survey's scoringMap against a
// set of answers. Missing/unanswered fields contribute 0 rather than throwing,
// so a partially-completed response still scores sensibly.
export function computeScore(
  scoringMap: ScoringMap | undefined,
  answers: Record<string, unknown>,
  categories: { id: string; label: string }[] | undefined,
  passThreshold: number | undefined,
): ScoreResult {
  const byCategoryTotals = new Map<string, number>();
  let total = 0;

  for (const [scope, entry] of Object.entries(scoringMap ?? {})) {
    const value = getValueAtScope(answers, scope);
    const points = scoreForEntry(entry, value);
    total += points;
    if (entry.categoryId) {
      byCategoryTotals.set(entry.categoryId, (byCategoryTotals.get(entry.categoryId) ?? 0) + points);
    }
  }

  const byCategory: ScoreByCategory[] = (categories ?? [])
    .filter((c) => byCategoryTotals.has(c.id))
    .map((c) => ({ categoryId: c.id, label: c.label, points: round2(byCategoryTotals.get(c.id)!) }));

  return {
    total: round2(total),
    byCategory,
    ...(passThreshold !== undefined ? { passed: total >= passThreshold } : {}),
  };
}
