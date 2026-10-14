import type { QuestionDef } from '../../../../types/survey';

// Shared contract every per-type control in this directory implements, so
// QuestionStage can render whichever one matches the current question's
// compiled type without knowing anything about that type's own UI.
export interface QuestionControlProps {
  question: QuestionDef;
  value: unknown;
  onChange: (value: unknown) => void;
  // Called by controls whose own interaction model auto-advances (a few-
  // options pick, Yes/No, a rating tap) shortly after a selection. Controls
  // that don't auto-advance (long text, multi-select, many-options search)
  // simply never call it -- QuestionStage's own Continue button is the only
  // way forward for those.
  onAdvance: () => void;
  autoFocus?: boolean;
}
