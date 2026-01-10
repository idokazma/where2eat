import * as z from 'zod';

const menuItemSchema = z.object({
  item: z.string().min(1, 'Item name is required'),
  recommendation_level: z.enum(['must_try', 'recommended', 'mentioned']),
});

const locationSchema = z.object({
  city: z.string().nullable(),
  neighborhood: z.string().nullable(),
  address: z.string().nullable(),
  region: z.enum(['North', 'Center', 'South']).nullable(),
});

const contactInfoSchema = z.object({
  hours: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().url('Must be a valid URL').nullable().or(z.literal('')),
});

export const restaurantSchema = z.object({
  name_hebrew: z.string().min(1, 'Hebrew name is required'),
  name_english: z.string().nullable(),
  location: locationSchema,
  cuisine_type: z.string().min(1, 'Cuisine type is required'),
  status: z.enum(['open', 'closed', 'new_opening', 'closing_soon', 'reopening']),
  price_range: z.enum(['budget', 'mid-range', 'expensive', 'not_mentioned']),
  host_opinion: z.enum(['positive', 'negative', 'mixed', 'neutral']),
  host_comments: z.string(),
  menu_items: z.array(menuItemSchema).default([]),
  special_features: z.array(z.string()).default([]),
  contact_info: contactInfoSchema,
  business_news: z.string().nullable(),
  mention_context: z.enum(['new_opening', 'review', 'news', 'recommendation', 'comparison', 'business_news']),
  food_trends: z.array(z.string()).default([]),
});

export type RestaurantFormData = z.infer<typeof restaurantSchema>;
