// UI contracts and validation schemas

import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().url().optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().optional(),
  size: z.string().optional(),
  industry: z.string().optional(),
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  location: z.string().optional(),
});

export const CreateOpportunitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  stage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  value: z.number().min(0).optional(),
  closeDate: z.string().datetime().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]),
  companyId: z.string().optional(),
});

export const CreatePersonSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email().optional(),
  title: z.string().max(100).optional(),
  seniority: z.string().optional(),
  department: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  companyId: z.string(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().datetime().optional(),
  opportunityId: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type CreateOpportunityInput = z.infer<typeof CreateOpportunitySchema>;
export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
