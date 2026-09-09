import { materialRenderers } from '@jsonforms/material-renderers';
import { RatingControl } from './RatingControl';
import { NpsControl } from './NpsControl';
import { ratingTester, npsTester } from './testers';

// Custom renderers layered on top of the default Material set. Ranked higher
// than the default integer/number controls so they take over whenever the
// compiled UI Schema carries the matching `options.renderer` hint (see
// domain/schemaCompiler.ts).
export const builderRenderers = [
  ...materialRenderers,
  { tester: ratingTester, renderer: RatingControl },
  { tester: npsTester, renderer: NpsControl },
];
