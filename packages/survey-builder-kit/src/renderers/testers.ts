import { and, isControl, optionIs, rankWith } from '@jsonforms/core';

// Rank above the default Material integer/number controls (rank 2) so these
// take over whenever the compiled UI Schema carries the matching `options.renderer` hint.
export const ratingTester = rankWith(10, and(isControl, optionIs('renderer', 'rating')));
export const npsTester = rankWith(10, and(isControl, optionIs('renderer', 'nps')));
