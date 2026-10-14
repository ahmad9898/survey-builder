import { v4 as uuidv4 } from 'uuid';

export function newId(prefix: string): string {
  return `${prefix}_${uuidv4()}`;
}

// Generates a unique, JSON-Schema-property-safe field id for a new question,
// unique across the *entire* survey (not just the current page) since answers
// are stored in one flat object and conditions/branching/scoring can reference
// any question regardless of which page it lives on.
export function newFieldId(existingIds: Set<string>, typeLabel: string): string {
  const base = typeLabel.replace(/[^a-zA-Z0-9]/g, '');
  let i = 1;
  let candidate = `${base}${i}`;
  while (existingIds.has(candidate)) {
    i += 1;
    candidate = `${base}${i}`;
  }
  return candidate;
}

// Lowercase, dash-separated, JSON-Schema-property-safe. "What is your name?"
// -> "what-is-your-name". Capped at a sane length so one very long question
// title doesn't produce an unwieldy id.
const MAX_SLUG_LENGTH = 60;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

// Slugifies `text` and dedupes it against `existingIds` (survey-wide, same
// uniqueness scope as newFieldId) by appending -2, -3, ... on collision.
// Falls back to `fallback` (e.g. a newFieldId-generated id) when the title
// slugifies to nothing (empty/punctuation-only title).
export function slugifyUnique(text: string, existingIds: Set<string>, fallback: string): string {
  const base = slugify(text);
  if (!base) return fallback;
  if (!existingIds.has(base)) return base;
  let i = 2;
  let candidate = `${base}-${i}`;
  while (existingIds.has(candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

// Strips anything that isn't a letter, digit, underscore, or hyphen --
// unlike slugify, deliberately does NOT lowercase or turn spaces into
// dashes, since this is free text a host might type/paste directly (e.g.
// Survey.type), not a title being derived into an identifier. Characters
// outside that set simply never make it into the value, so there's nothing
// to reject/validate downstream -- the field can't ever hold a space.
export function sanitizeFreeTextCode(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]/g, '');
}
