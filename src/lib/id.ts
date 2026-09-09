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
