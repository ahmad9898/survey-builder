import type { ComponentType } from 'react';
import type { QuestionDef } from '../../../../types/survey';
import type { QuestionControlProps } from './types';
import { ShortTextControl } from './ShortTextControl';
import { LongTextControl } from './LongTextControl';
import { NumberControl } from './NumberControl';
import { DateControl } from './DateControl';
import { SingleChoiceFewControl } from './SingleChoiceFewControl';
import { SingleChoiceManyControl } from './SingleChoiceManyControl';
import { MultiChoiceControl } from './MultiChoiceControl';
import { BooleanControl } from './BooleanControl';
import { RatingScaleControl } from './RatingScaleControl';
import { LabelInfoControl } from './LabelInfoControl';
import { UnsupportedControl } from './UnsupportedControl';

// Stacked cards stop scaling well past this many options -- see
// SingleChoiceManyControl's own comment for the searchable-combobox
// alternative used above this threshold.
export const MANY_OPTIONS_THRESHOLD = 6;

// Resolves a question to its control component -- the one place that
// decides "which treatment from section 3 of the redesign spec applies
// here." An unmapped QuestionType deliberately falls through to
// UnsupportedControl rather than guessing a layout for it.
export function controlForQuestion(question: QuestionDef): ComponentType<QuestionControlProps> {
  switch (question.type) {
    case 'shortText':
      return ShortTextControl;
    case 'longText':
      return LongTextControl;
    case 'number':
      return NumberControl;
    case 'date':
      return DateControl;
    case 'singleChoice':
      return (question.choices?.length ?? 0) > MANY_OPTIONS_THRESHOLD ? SingleChoiceManyControl : SingleChoiceFewControl;
    case 'multipleChoice':
      return MultiChoiceControl;
    case 'boolean':
      return BooleanControl;
    case 'rating':
    case 'nps':
      return RatingScaleControl;
    case 'label':
      return LabelInfoControl;
    default:
      return UnsupportedControl;
  }
}

export type { QuestionControlProps };
