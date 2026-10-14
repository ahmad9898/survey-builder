import { describe, expect, it } from 'vitest';
import { slugify, slugifyUnique, sanitizeFreeTextCode } from '../../src/lib/id';

describe('slugify', () => {
  it('lowercases and dash-separates words', () => {
    expect(slugify('What is your name?')).toBe('what-is-your-name');
  });

  it('collapses punctuation/whitespace runs into a single dash', () => {
    expect(slugify('Have you had a heart attack -- or stent?!')).toBe('have-you-had-a-heart-attack-or-stent');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('  -- Hello --  ')).toBe('hello');
  });

  it('returns an empty string for a punctuation-only or blank title', () => {
    expect(slugify('???')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('caps very long titles at a sane length', () => {
    const long = 'word '.repeat(40).trim();
    expect(slugify(long).length).toBeLessThanOrEqual(60);
    expect(slugify(long).endsWith('-')).toBe(false);
  });
});

describe('slugifyUnique', () => {
  it('uses the plain slug when nothing collides', () => {
    expect(slugifyUnique('What is your name?', new Set(), 'fallback1')).toBe('what-is-your-name');
  });

  it('appends -2, -3, ... on collision, in order', () => {
    const existing = new Set(['name', 'name-2']);
    expect(slugifyUnique('Name', existing, 'fallback1')).toBe('name-3');
  });

  it('falls back to the given fallback id when the title slugifies to nothing', () => {
    expect(slugifyUnique('???', new Set(), 'shortText3')).toBe('shortText3');
  });
});

describe('sanitizeFreeTextCode', () => {
  it('strips spaces', () => {
    expect(sanitizeFreeTextCode('intake form')).toBe('intakeform');
  });

  it('strips special characters', () => {
    expect(sanitizeFreeTextCode('intake!@#$%^&*()+={}[]')).toBe('intake');
  });

  it('keeps letters, digits, underscores, and hyphens as-is -- no case/format changes', () => {
    expect(sanitizeFreeTextCode('Intake_Form-2026')).toBe('Intake_Form-2026');
  });

  it('returns an empty string for input that is entirely disallowed characters', () => {
    expect(sanitizeFreeTextCode('   ???   ')).toBe('');
  });
});
