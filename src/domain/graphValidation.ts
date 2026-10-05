import type { Survey } from '../types/survey';

export interface BranchTargetValidation {
  valid: boolean;
  reason?: string;
}

function outgoingTargets(survey: Survey): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const page of survey.pages) {
    const targets: string[] = [];
    for (const rule of page.branch) {
      if (rule.goToPageId !== 'end') targets.push(rule.goToPageId);
    }
    if (page.defaultNextPageId !== 'end') targets.push(page.defaultNextPageId);
    outgoing.set(page.id, targets);
  }
  return outgoing;
}

// Would adding an edge fromPageId -> toPageId, on top of the survey's
// *current* edges (default-next + branch rules), create a cycle? Checked by
// asking whether toPageId can already reach fromPageId -- if so, the new
// edge would close a loop back to where it started.
export function wouldCreateCycle(survey: Survey, fromPageId: string, toPageId: string): boolean {
  if (fromPageId === toPageId) return true;
  const outgoing = outgoingTargets(survey);
  const visited = new Set<string>([toPageId]);
  const queue = [toPageId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === fromPageId) return true;
    for (const next of outgoing.get(id) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

// Full check for "can fromPageId branch/link to toPageId": self-reference,
// a target that no longer exists, and cycles are all rejected. Used for both
// new branch rules and retargeting an existing rule or default-next pointer.
export function validateBranchTarget(survey: Survey, fromPageId: string, toPageId: string): BranchTargetValidation {
  if (fromPageId === toPageId) {
    return { valid: false, reason: 'A page cannot branch to itself.' };
  }
  if (!survey.pages.some((p) => p.id === toPageId)) {
    return { valid: false, reason: 'That page no longer exists.' };
  }
  if (wouldCreateCycle(survey, fromPageId, toPageId)) {
    return { valid: false, reason: 'That would create a loop in the survey flow.' };
  }
  return { valid: true };
}
