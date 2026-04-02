import { z } from 'zod';
import { ContentType } from '../types/content.types';

export const createArticleSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  contentType: z.nativeEnum(ContentType),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).optional(),
});

export const reviewArticleSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().max(1000).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ReviewArticleInput = z.infer<typeof reviewArticleSchema>;
