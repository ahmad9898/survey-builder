# Survey Builder

A client-side survey/questionnaire builder and runtime, built on [JSONForms](https://jsonforms.io/) — a drag-and-drop survey editor plus a page-by-page player, with conditional logic, branching (skip logic), and scoring. No backend: everything lives in the browser (IndexedDB via Dexie), with JSON export/import for moving surveys between browsers or sharing them.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm test         # run the domain-logic unit tests (vitest)
```

## Using the app

- **Home** (`/`) lists your saved surveys and a couple of example surveys. "New survey" opens a blank survey in the builder; "Import survey JSON" loads a previously-exported `.json` file.
- **Builder** (`/builder/:surveyId`) — drag a question type from the left palette onto the canvas (or just click it), click a question to edit its label/options/validation in the right-hand property panel, and watch the live preview update as you go. Autosaves ~500ms after you stop editing.
  - **Logic**: each question's property panel has a "Show this question only if…" section — pick an earlier question, an operator, and a value to make it conditionally visible.
  - **Branching**: each page has a "Branching" section at the bottom — add rules like "if `usesCompetitor` is Yes → go to Page 3", with a page-level "Otherwise, go to" fallback.
  - **Scoring**: enable it in the "Scoring" section at the bottom of the builder, optionally add categories, then each choice/rating/NPS/number/boolean question gets a "Scoring" section in its property panel to assign points.
  - **Undo/redo**: toolbar buttons or Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z.
  - **Preview survey** takes you into the real player without leaving the builder, so you can click through branches exactly as a respondent would.
- **Player** (`/run/:surveyId`) renders the survey page by page, evaluates branching after each page, and shows a results screen with the computed score (and pass/fail, if a threshold is set) at the end. Completed responses are saved locally.

## Architecture

```
src/
  types/        Survey, SurveyPage, ConditionGroup, BranchRule, ScoringMap, SurveyResponse
  domain/       pure logic: schemaCompiler, conditionCompiler, conditionEvaluator,
                branchingEngine, scoringEngine (see tests/domain/*.test.ts)
  renderers/    custom JSONForms renderers (Rating, NPS) layered on the Material set
  builder/      drag-and-drop editor: store (zustand) + components
  runtime/      survey player: store (zustand) + components
  storage/      Dexie (IndexedDB) repositories + JSON export/import
  pages/        route-level screens (Home, Builder, Player)
```

A **Survey** is one self-contained JSON document: each page carries its own JSON Schema + UI Schema (what JSONForms actually renders), plus custom metadata for branching (`page.branch`) and scoring (`survey.scoringMap`) that JSONForms itself doesn't know about. Question-level conditional visibility compiles into JSONForms' own native `rule` (SHOW/HIDE) mechanism, so that part is evaluated by JSONForms itself; branching and scoring are evaluated by the small custom engines in `src/domain/`.

## Known limitations

- No backend — surveys and responses live in the browser's IndexedDB. Clearing site data removes them (export first if you want a backup).
- The `contains` condition operator is implemented for multi-select (array) fields; using it against a plain text field's native JSONForms visibility rule isn't fully supported (branching's own evaluator does handle text `contains` correctly).
- No collaborative/multi-user editing — one browser, one editor.
