# survey-builder-kit

Two embeddable React components -- `<SurveyBuilder>` (an authoring UI) and
`<SurveyRunner>` (a respondent-facing player) -- built from the same core
survey schema, branching/scoring/validation logic, and UI components as this
repo's standalone app (`packages/app`). The app is a manual-testing
playground for this library, not the other way around: it imports
`survey-builder-kit` like any other host would.

## Install

This package currently lives in this repo's npm workspace and isn't
published anywhere. From a workspace member (like `packages/app`), add it as
a normal `dependencies` entry:

```json
{
  "dependencies": {
    "survey-builder-kit": "*"
  }
}
```

npm resolves `*` to the local workspace package automatically (see
`packages/app/package.json` for a working example) -- no version to pick,
no registry round-trip.

If this package is later published to a registry or installed straight from
git, nothing about the import paths or props below changes -- only the
version range in `package.json` and the install command itself (`npm install
survey-builder-kit` instead of a workspace link).

Also import its stylesheet once, anywhere in your app's entry point (it's a
static CSS file -- React Flow's own styles, which power the Flow map inside
`<SurveyBuilder>` -- not part of the Emotion CSS-in-JS the rest of the
library injects at runtime, so it doesn't load itself):

```ts
import 'survey-builder-kit/style.css';
```

Skipping this doesn't crash anything, but the Flow map renders without its
node/edge/minimap/control styling -- see `packages/app/src/main.tsx` for a
working example.

## Peer dependencies

The host app must have these installed; `survey-builder-kit` doesn't bundle
its own copies, so the host's existing React/MUI/Emotion setup is reused
instead of shipping (and incurring) a second one:

- `react` ^19
- `react-dom` ^19
- `@mui/material` ^7
- `@mui/icons-material` ^7
- `@emotion/react` ^11
- `@emotion/styled` ^11
- `@emotion/cache` ^11

Everything else the library needs (`@dnd-kit/*`, `@jsonforms/*`,
`@xyflow/react`, `ajv`, `dagre`, `dexie`, `uuid`, `zustand`) is bundled in as
a regular dependency -- the host doesn't need to install any of those itself.

## Client-only -- no SSR

Both components use `IndexedDB` and browser-only APIs internally. Importing
the package is safe during server-side rendering (nothing runs at module
load time), but *rendering* either component on the server will produce an
inert shell until it hydrates on the client. In a framework with its own
server-rendering step (Next.js App Router, Remix, etc.), render these inside
a client boundary -- e.g. a file marked `'use client'` in Next.js, or loaded
via `next/dynamic(() => import(...), { ssr: false })` if you want to skip
the server render entirely.

## `<SurveyBuilder>`

```tsx
import { SurveyBuilder } from 'survey-builder-kit';
import type { Survey } from 'survey-builder-kit';

function EditSurvey({ survey }: { survey: Survey | null }) {
  return (
    <div style={{ height: '100vh' }}>
      <SurveyBuilder
        survey={survey}
        onChange={(updated) => saveDraftSomewhere(updated)}
        onSave={(updated) => publishSomewhere(updated)}
      />
    </div>
  );
}
```

`<SurveyBuilder>` renders at `height: 100%` of whatever you mount it in --
give its container a definite height (a fixed height, or `flex: 1; min-height: 0`
inside a flex column), or it will collapse to its content height.

| Prop       | Type                            | Required | Fires                                                                                          |
| ---------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `survey`   | `Survey \| null \| undefined`     | No       | --                                                                                                |
| `onChange` | `(survey: Survey) => void`       | No       | As the author edits, debounced ~500ms. Not called on every keystroke.                            |
| `onSave`   | `(survey: Survey) => void`       | No       | Once per click of the header's Save/Publish button, or Ctrl/Cmd+S.                                |
| `bgColor` | `string`                       | No       | --                                                                                                |
| `primaryColor` | `string`                    | No       | --                                                                                                |

- `survey={null}` (or `undefined`) starts a new, empty survey.
- `bgColor` is added to this component's own root element's `className`,
  nothing more -- not a DOM node or a ref, despite the name, and not a
  literal color value either. Write a CSS rule scoped to that class in your
  own stylesheet to theme one mounted instance (e.g. `.acme-blue-theme {
  ... }`), without touching this library's internals or re-rendering with a
  different theme object per instance:

  ```tsx
  <SurveyBuilder survey={survey} bgColor="acme-blue-theme" />
  ```
- `primaryColor` replaces the library's default primary color (`#4f46e5`)
  for this one mounted instance -- every `primary.main`/`.dark`/`.light`/
  `.contrastText` usage throughout the component (buttons, selected-state
  borders/fills, the flow map's active-node styling, etc.) reads from the
  theme, so this one value reaches all of them; `dark`/`light`/
  `contrastText` are derived from it automatically:

  ```tsx
  <SurveyBuilder survey={survey} primaryColor="#e11d48" />
  ```

  Unlike `bgColor`, this *does* build a different theme object per instance
  -- there's no way to override MUI's `sx={{ color: 'primary.main' }}`
  tokens from plain host CSS the way `bgColor` overrides literal CSS
  properties, so this prop exists for that case specifically.
- `survey` is read once, on mount, to seed the editor's internal state, and
  again only if you later pass a *different* survey (a different `id`) --
  it is not a controlled prop the editor re-syncs to on every render. Once
  mounted, the component's own state is authoritative until you unmount or
  swap in a different survey.
- The editor validates `survey` on mount (and again on a swap) and renders a
  plain error screen instead of crashing if it doesn't match the expected
  shape -- see "Survey JSON shape" below.

`newSurvey()` is also exported, in case you want a valid empty `Survey` to
seed your own state with ahead of time:

```ts
import { newSurvey } from 'survey-builder-kit';
const blank = newSurvey('Untitled survey');
```

## `<SurveyRunner>`

```tsx
import { SurveyRunner } from 'survey-builder-kit';
import type { Survey, SurveyResponse } from 'survey-builder-kit';

function TakeSurvey({ survey }: { survey: Survey }) {
  return (
    <div style={{ height: '100vh' }}>
      <SurveyRunner
        survey={survey}
        onChange={(answers) => autosaveAnswers(answers)}
        onSubmit={(response: SurveyResponse) => submitResponse(response)}
        exitPath="/"
      />
    </div>
  );
}
```

| Prop             | Type                                        | Required | Fires                                                                 |
| ---------------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `survey`         | `Survey`                                     | Yes      | --                                                                        |
| `initialAnswers` | `Record<string, unknown>`                   | No       | --                                                                        |
| `onChange`       | `(answers: Record<string, unknown>) => void` | No       | As the respondent answers, debounced ~500ms.                            |
| `onAnswer`       | `(response: SurveyResponse, submitted: boolean) => void` | No | Once per page advance, only `hasTrigger` questions; once more at submit with everything. |
| `onSubmit`       | `(response: SurveyResponse) => void`         | No       | Once, when the respondent reaches the end of the survey.                |
| `exitPath`       | `string`                                     | No       | --                                                                        |
| `bgColor`        | `string`                                     | No       | --                                                                        |
| `primaryColor`   | `string`                                     | No       | --                                                                        |

- `initialAnswers` is only read once, on mount (and again if `survey.id`
  later changes) -- use it to resume a partially-answered survey.
- `onAnswer` fires once per page advance -- when the respondent moves on to
  the next page, not on every keystroke/selection within a page (see
  `onChange` for that) -- with `submitted: false` and `response.answers`
  scoped to just that page's questions flagged `hasTrigger: true`
  (`QuestionDef`); a page with none of those doesn't fire `onAnswer` at
  all. `response.completedAt` is omitted at this point (the survey isn't
  finished yet).

  At actual completion, it fires once more, differently: `submitted: true`,
  and `response.answers` is EVERY answer from the whole survey -- every
  page, `hasTrigger` or not -- the same full set `onSubmit` itself gets
  (built independently though -- the two calls' `response.id`s don't
  match each other, same as neither call's `response.id` matches another
  onAnswer call's from earlier in the same run).

  `response` is a full `SurveyResponse` either way, same shape as
  `onSubmit`'s own parameter (`id`/`surveyId`/`title`/`type`/
  `surveyVersion`/`answersFormatVersion`/`answers`/`visitedPageIds`/
  `score`/`startedAt`/`completedAt`), not a bare `AnswerEntry[]` --
  `response.answers` is the rich, self-describing shape (`questionId`/
  `slug`/`label`/`pageId`/`pageTitle`/`type`/`value`/`displayValue`/
  `hasTrigger`, etc. -- see "Survey / answers JSON shape" below), and
  `response.score` is a LIVE score recomputed from whatever's been
  answered so far (when `survey.scoring?.enabled`), not necessarily the
  final one. `hasTrigger` defaults to false/omitted for every question, is
  never compiled into the JSONForms schema/UI, and so has no visible effect
  in `<SurveyRunner>`'s rendered form -- it only changes what `onAnswer`
  reports mid-survey. Doesn't fire on back-navigation, including jumping
  back via the review screen's "Edit". Use this over `onChange`/`onSubmit`
  when you want a lightweight signal (with survey-level context, not just
  raw answers) per flagged question as the respondent goes, plus the full
  response at the end, without wiring a separate `onSubmit`:

  ```tsx
  <SurveyRunner survey={survey} onAnswer={(response, submitted) => track(response, submitted)} />
  ```
- `exitPath`, if given, shows an "Exit" link in the header; clicking it does
  a full `window.location` navigation to that path/URL (not client-side
  routing -- this library has no router of its own, and can't depend on
  one). Omit it to hide the link entirely.
- `bgColor` works exactly like `<SurveyBuilder>`'s own -- added to this
  component's root element's `className` only (not a literal color value),
  so your own CSS can theme one mounted instance (`.acme-blue-theme { ...
  }`) without touching the library or re-rendering with a different theme
  object.
- `primaryColor` works exactly like `<SurveyBuilder>`'s own -- replaces the
  default `#4f46e5` everywhere `primary.*` is read (the progress rail,
  selected-option cards/borders, the submit/continue button, etc.), with
  `dark`/`light`/`contrastText` derived from it automatically:

  ```tsx
  <SurveyRunner survey={survey} primaryColor="#e11d48" />
  ```
- Like `<SurveyBuilder>`, `survey` is validated on mount/swap, with a plain
  error screen on a shape mismatch instead of a crash.
- `onSubmit`'s `response` is a full `SurveyResponse` -- not just the raw
  answers -- so a host doesn't have to re-derive `visitedPageIds`/`score`/
  timestamps by hand: the runner already has all of that in scope by the
  time the respondent finishes. `response.id` is freshly generated for this
  one run; if you want to dedupe retakes of the same survey, key off
  `surveyId` + `completedAt` instead of `id`.
- `score` inside `response` is computed automatically from `survey.scoringMap`
  when `survey.scoring?.enabled` is true, `undefined` otherwise. `computeScore`
  is also exported directly, if you want to compute a score yourself outside
  of an `onSubmit` callback (e.g. live, from in-progress `onChange` answers):

  ```ts
  import { computeScore } from 'survey-builder-kit';
  const result = computeScore(survey.scoringMap, answers, survey.scoring?.categories, survey.scoring?.passThreshold);
  ```

## Survey / answers JSON shape

The canonical shape is the exported TypeScript types -- `Survey`,
`SurveyPage`, `QuestionDef`, `QuestionType`, `BranchRule`, `ConditionGroup`,
`ConditionLeaf`, `ConditionOperator`, `ScoringEntry`, `ScoringMap` for
surveys, and `SurveyResponse`, `ScoreResult`, `ScoreByCategory` for
responses, all exported as named types from `survey-builder-kit`. Read those
directly (`node_modules/survey-builder-kit/dist/index.d.ts`, or just
"go to definition" from your editor) rather than a hand-written schema doc
here, which would drift the moment either side changes.

A few things worth calling out that aren't obvious from the types alone:

- `Survey.schemaVersion` tracks the *shape* of the Survey document (bump-worthy
  only if the JSON structure itself changes in a breaking way); `Survey.version`
  tracks edits to one survey's own content and is unrelated. Survey JSON saved
  before `schemaVersion` existed is still accepted -- missing values are
  backfilled with the current version (also exported, as `CURRENT_SCHEMA_VERSION`)
  internally.
- `SurveyPage.schema`/`uischema` are JSONForms documents compiled from
  `SurveyPage.questions` by this library's own builder -- treat them as
  derived output, not something to hand-author.
- Answers (`Record<string, unknown>`) are a flat object keyed by each
  question's `id`, regardless of which page the question lives on.

## Autosave / IndexedDB

`<SurveyBuilder>` keeps a local draft of the survey in its own IndexedDB
database (`survey-builder-kit`, separate from anything your own app stores)
as a crash/accidental-close safety net -- **not** a competing source of
truth. The `survey` prop is what the editor is seeded with on mount; this
local draft is written on a debounce as the author edits, but the library
never reads it back automatically. If you want a "restore unsaved changes?"
flow, you'd build it yourself on top of your own `onChange` persistence --
this library doesn't do that on your behalf.

Each mounted `<SurveyBuilder>` instance gets its own draft slot (keyed by a
random id generated at mount, not by survey id), so two instances editing the
same survey -- two browser tabs, or two components on one page -- never
overwrite each other's local backup.

There's currently no prop to disable or namespace this -- if you need to turn
it off (e.g. in an environment without IndexedDB, or to avoid writing data
you don't want persisted locally), that's not yet exposed; see "Known
limitations" below.

`<SurveyRunner>` does not use IndexedDB itself.

## Known limitations

- No prop to disable or namespace the local draft-autosave database.
- `<SurveyBuilder>`'s validation on mount checks structural shape (required
  fields, enum values, nested condition/branch shapes) but not business
  rules like whether branch targets actually exist among the survey's pages
  -- a structurally valid but logically broken survey will still load.
- `survey`/`initialAnswers` are read on mount and on an id change, not on
  every render -- passing a new object with the same `id` but different
  content after mount will not resync the component to it.
- No built-in i18n -- all copy is in English.
