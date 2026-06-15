import { describe, expect, it } from 'vitest';
import type { ApplyProfile } from '../types';
import { buildApplyEmail, getApplyProfileFields } from './applyAssistant';

const job = { title: 'Data Analyst', company: 'Acme' };

describe('applyAssistant', () => {
  it('builds an email with a selected saved answer', () => {
    const applyProfile: ApplyProfile = {
      fullName: 'Yan Tang',
      email: 'yan@example.com',
      phone: '+65 1234 5678',
      signature: 'Yan Tang\nNUS DSML',
      savedAnswers: [
        {
          id: 'answer-1',
          label: 'Startup interest',
          content: 'I am excited by analytical products with fast user feedback loops.',
          updatedAt: '2026-06-15T00:00:00Z',
        },
      ],
    };

    expect(buildApplyEmail({ applyProfile, job, selectedAnswerId: 'answer-1' })).toBe(
      [
        'Dear Hiring Team,',
        'I am writing to express my interest in the Data Analyst role at Acme.',
        'I am excited by analytical products with fast user feedback loops.',
        'I have attached my resume for your review. Please find my contact below.',
        'Best regards,',
        'Yan Tang\nNUS DSML',
      ].join('\n\n'),
    );
  });

  it('omits the middle paragraph when no saved answer is selected', () => {
    const applyProfile: ApplyProfile = {
      fullName: 'Yan Tang',
      email: 'yan@example.com',
      phone: '+65 1234 5678',
    };

    const email = buildApplyEmail({ applyProfile, job });

    expect(email).not.toContain('undefined');
    expect(email).not.toContain('[');
    expect(email).toContain('Yan Tang\nyan@example.com\n+65 1234 5678');
  });

  it('falls back gracefully when signature is missing', () => {
    const email = buildApplyEmail({
      applyProfile: { fullName: 'Yan Tang', email: 'yan@example.com' },
      job,
    });

    expect(email.endsWith('Yan Tang\nyan@example.com')).toBe(true);
  });

  it('returns only filled application fields', () => {
    const fields = getApplyProfileFields({
      fullName: 'Yan Tang',
      email: '',
      linkedIn: 'https://linkedin.com/in/yan',
      savedAnswers: [],
    });

    expect(fields).toEqual([
      { key: 'fullName', label: 'Full name', value: 'Yan Tang' },
      { key: 'linkedIn', label: 'LinkedIn', value: 'https://linkedin.com/in/yan' },
    ]);
  });
});
