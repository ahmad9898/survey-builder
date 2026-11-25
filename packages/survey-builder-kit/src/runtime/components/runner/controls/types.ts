import type { QuestionDef } from '../../../../types/survey';

// Shared contract every per-type control in this directory implements, so
// QuestionStage can render whichever one matches the current question's
// compiled type without knowing anything about that type's own UI.
export interface QuestionControlProps {
  question: QuestionDef;
  value: unknown;
  onChange: (value: unknown) => void;
  // No control calls this on a bare selection/click anymore -- the
  // respondent always has to explicitly advance themselves, via
  // QuestionStage's own Continue/Submit button. A few text-entry-style
  // controls (short text, number, date, the many-options search) also call
  // it from an Enter keypress, the same way a plain <form> submits on
  // Enter -- that's still an explicit action, just via keyboard instead of
  // a click.
  onAdvance: () => void;
  autoFocus?: boolean;
  // The "Other" free-text box's own value/setter -- only read by the choice
  // controls that support QuestionDef.allowOtherOption (every other control
  // ignores both). Kept separate from `value`/`onChange` (which always hold
  // this question's own OTHER_OPTION_VALUE-or-real-choice answer, never the
  // typed text) so the two can be wired to two different keys in the same
  // flat answers map -- see otherOptionFieldId.
  otherValue?: unknown;
  onOtherChange?: (value: string) => void;
}
