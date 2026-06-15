import type { ApplyProfile, Job } from '../types';

export interface ApplyField {
  key: keyof ApplyProfile;
  label: string;
  value: string;
}

export function getApplyProfileFields(applyProfile?: ApplyProfile): ApplyField[] {
  if (!applyProfile) return [];

  const fields: Array<{ key: keyof ApplyProfile; label: string }> = [
    { key: 'fullName', label: 'Full name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'location', label: 'Location' },
    { key: 'linkedIn', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'workAuthStatus', label: 'Work authorization' },
    { key: 'yearsExperience', label: 'Years of experience' },
    { key: 'willingToRelocate', label: 'Willing to relocate' },
    { key: 'earliestStartDate', label: 'Earliest start date' },
  ];

  return fields.flatMap(({ key, label }) => {
    const raw = applyProfile[key];
    if (typeof raw !== 'string' || !raw.trim()) return [];
    return [{ key, label, value: raw.trim() }];
  });
}

export function buildApplyEmail(args: {
  applyProfile?: ApplyProfile;
  job: Pick<Job, 'title' | 'company'>;
  selectedAnswerId?: string;
}): string {
  const { applyProfile, job, selectedAnswerId } = args;
  const selectedAnswer = applyProfile?.savedAnswers?.find(
    (answer) => answer.id === selectedAnswerId,
  );
  const answerContent = selectedAnswer?.content.trim();
  const signature = buildSignature(applyProfile);

  return [
    'Dear Hiring Team,',
    `I am writing to express my interest in the ${job.title} role at ${job.company}.`,
    answerContent || undefined,
    'I have attached my resume for your review. Please find my contact below.',
    'Best regards,',
    signature || undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
}

function buildSignature(applyProfile?: ApplyProfile): string {
  const explicit = applyProfile?.signature?.trim();
  if (explicit) return explicit;

  return [applyProfile?.fullName, applyProfile?.email, applyProfile?.phone]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n');
}
