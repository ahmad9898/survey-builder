import { RuleEffect } from '@jsonforms/core';
import type { Survey } from 'survey-builder-kit';

// Hand-authored fixture proving the branching + scoring + conditional-visibility
// data shape end to end, ahead of the builder UI that will generate this JSON.
export const competitorSwitchSurvey: Survey = {
  id: 'survey_competitor_switch',
  title: 'Customer Satisfaction & Onboarding Fit',
  description: 'A short survey that branches based on whether you use a competitor product.',
  schemaVersion: 1,
  version: 1,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  startPageId: 'page_1',
  scoring: {
    enabled: true,
    categories: [{ id: 'fit', label: 'Product Fit' }],
    passThreshold: 5,
  },
  pages: [
    {
      id: 'page_1',
      title: 'About you',
      questions: [
        {
          id: 'companySize',
          slug: 'companySize',
          title: 'Company size',
          type: 'singleChoice',
          label: 'Company size',
          required: true,
          choices: ['1-10', '11-50', '51-200', '200+'],
        },
        {
          id: 'usesCompetitor',
          slug: 'usesCompetitor',
          title: 'Uses competitor',
          type: 'boolean',
          label: 'Currently using a competitor product?',
          required: true,
        },
      ],
      schema: {
        type: 'object',
        properties: {
          companySize: { type: 'string', enum: ['1-10', '11-50', '51-200', '200+'] },
          usesCompetitor: { type: 'boolean' },
        },
        required: ['companySize', 'usesCompetitor'],
      },
      uischema: {
        type: 'VerticalLayout',
        elements: [
          { type: 'Control', scope: '#/properties/companySize', label: 'Company size' },
          {
            type: 'Control',
            scope: '#/properties/usesCompetitor',
            label: 'Currently using a competitor product?',
          },
        ],
      },
      branch: [
        {
          id: 'rule_1',
          when: {
            logic: 'AND',
            conditions: [{ fieldPath: '#/properties/usesCompetitor', operator: 'eq', value: true }],
          },
          goToPageId: 'page_2b',
        },
      ],
      defaultNextPageId: 'page_2a',
    },
    {
      id: 'page_2a',
      title: 'New user questions',
      questions: [
        {
          id: 'npsScore',
          slug: 'npsScore',
          title: 'NPS score',
          type: 'nps',
          label: 'How likely are you to recommend us?',
          min: 0,
          max: 10,
        },
      ],
      schema: {
        type: 'object',
        properties: {
          npsScore: { type: 'integer', minimum: 0, maximum: 10 },
        },
      },
      uischema: {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Control',
            scope: '#/properties/npsScore',
            label: 'How likely are you to recommend us?',
            options: { renderer: 'nps' },
          },
        ],
      },
      branch: [],
      defaultNextPageId: 'end',
    },
    {
      id: 'page_2b',
      title: 'Switching questions',
      questions: [
        {
          id: 'competitorName',
          slug: 'competitorName',
          title: 'Competitor name',
          type: 'shortText',
          label: 'Which product?',
        },
        {
          id: 'switchReason',
          slug: 'switchReason',
          title: 'Switch reason',
          type: 'singleChoice',
          label: 'Main reason for switching',
          required: true,
          choices: ['Price', 'Features', 'Support', 'Other'],
          visibilityRule: {
            logic: 'AND',
            conditions: [{ fieldPath: '#/properties/competitorName', operator: 'isNotEmpty' }],
          },
        },
      ],
      schema: {
        type: 'object',
        properties: {
          competitorName: { type: 'string' },
          switchReason: { type: 'string', enum: ['Price', 'Features', 'Support', 'Other'] },
        },
        required: ['switchReason'],
      },
      uischema: {
        type: 'VerticalLayout',
        elements: [
          { type: 'Control', scope: '#/properties/competitorName', label: 'Which product?' },
          {
            type: 'Control',
            scope: '#/properties/switchReason',
            label: 'Main reason for switching',
            rule: {
              effect: RuleEffect.SHOW,
              condition: {
                scope: '#/properties/competitorName',
                schema: { minLength: 1 },
              },
            },
          },
        ],
      },
      branch: [],
      defaultNextPageId: 'end',
    },
  ],
  scoringMap: {
    '#/properties/switchReason': {
      categoryId: 'fit',
      optionScores: { Price: 1, Features: 3, Support: 2, Other: 0 },
    },
    '#/properties/npsScore': {
      categoryId: 'fit',
      linearScore: { min: 0, max: 10, minPoints: 0, maxPoints: 5 },
    },
  },
};

// Simple linear (no branching, no scoring) fixture for the earliest player smoke test.
export const simpleFeedbackSurvey: Survey = {
  id: 'survey_simple_feedback',
  title: 'Quick Feedback',
  schemaVersion: 1,
  version: 1,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  startPageId: 'page_1',
  pages: [
    {
      id: 'page_1',
      title: 'Your feedback',
      questions: [
        { id: 'name', slug: 'name', title: 'Name', type: 'shortText', label: 'Name', required: true },
        { id: 'comments', slug: 'comments', title: 'Comments', type: 'longText', label: 'Comments' },
      ],
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          comments: { type: 'string' },
        },
        required: ['name'],
      },
      uischema: {
        type: 'VerticalLayout',
        elements: [
          { type: 'Control', scope: '#/properties/name', label: 'Name' },
          {
            type: 'Control',
            scope: '#/properties/comments',
            label: 'Comments',
            options: { multi: true },
          },
        ],
      },
      branch: [],
      defaultNextPageId: 'end',
    },
  ],
};

export const sampleSurveys: Survey[] = [competitorSwitchSurvey, simpleFeedbackSurvey];
