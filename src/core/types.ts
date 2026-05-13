import { z } from 'zod';

export const PiiPolicySchema = z.enum(['keep', 'mask', 'strip']);
export type PiiPolicy = z.infer<typeof PiiPolicySchema>;

export const WorkModeSchema = z.enum(['remote', 'onsite', 'hybrid', 'any']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const PersonaInstanceSchema = z.object({
  pluginId: z.string(),
  data: z.unknown(),
  createdAt: z.string(),
});
export type PersonaInstance = z.infer<typeof PersonaInstanceSchema>;

export const ResumeStructuredSchema = z.object({
  basic: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
  }),
  summary: z.string().optional(),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string(),
      major: z.string(),
      gpa: z.string().optional(),
      years: z.string(),
    }),
  ),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      period: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.object({
    hard: z.array(z.string()),
    soft: z.array(z.string()),
    languages: z.array(z.string()),
    tools: z.array(z.string()),
  }),
  projects: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      bullets: z.array(z.string()),
      tech: z.array(z.string()),
    }),
  ),
  certifications: z.array(z.string()).optional(),
  rawHighlights: z.array(z.string()).optional(),
});
export type ResumeStructured = z.infer<typeof ResumeStructuredSchema>;

export const ResumeProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  rawText: z.string().optional(),
  rawFileRef: z
    .object({
      mime: z.string(),
      blobId: z.string(),
    })
    .optional(),
  structured: ResumeStructuredSchema,
  piiPolicy: PiiPolicySchema,
  createdAt: z.string(),
});
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;

export const UserPreferencesSchema = z.object({
  salaryRange: z.tuple([z.number(), z.number()]).optional(),
  preferredLocations: z.array(z.string()).optional(),
  preferredIndustries: z.array(z.string()).optional(),
  avoidKeywords: z.array(z.string()).optional(),
  workMode: WorkModeSchema.optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UserContextSchema = z.object({
  personas: z.array(PersonaInstanceSchema),
  resumes: z.array(ResumeProfileSchema),
  preferences: UserPreferencesSchema,
  activeResumeId: z.string().optional(),
  activePersonaIds: z.array(z.string()),
});
export type UserContext = z.infer<typeof UserContextSchema>;

export const EMPTY_USER_CONTEXT: UserContext = {
  personas: [],
  resumes: [],
  preferences: {},
  activePersonaIds: [],
};

export const EMPTY_RESUME_STRUCTURED: ResumeStructured = {
  basic: {},
  education: [],
  experience: [],
  skills: { hard: [], soft: [], languages: [], tools: [] },
  projects: [],
};
