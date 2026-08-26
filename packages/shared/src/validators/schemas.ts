import { z } from 'zod';
import { JAMIYA_CONSTRAINTS, SUPPORTED_CURRENCIES } from '../constants';
import { toE164Kenya } from '../utils/phone';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[0-9]/, 'Include at least one number');

/** Accepts +254…, 07…, or 254… and stores E.164. */
export const phoneSchema = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (!trimmed) return trimmed;
    return toE164Kenya(trimmed) ?? trimmed;
  },
  z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'Use a Kenya mobile, e.g. 0712345678 or +254712345678'),
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCircleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(JAMIYA_CONSTRAINTS.nameMinLength, `Name must be at least ${JAMIYA_CONSTRAINTS.nameMinLength} characters`)
      .max(JAMIYA_CONSTRAINTS.nameMaxLength),
    description: z
      .string()
      .trim()
      .max(JAMIYA_CONSTRAINTS.descriptionMaxLength)
      .optional()
      .or(z.literal('')),
    contributionAmount: z.coerce
      .number({ invalid_type_error: 'Enter a valid contribution amount' })
      .min(
        JAMIYA_CONSTRAINTS.minContributionAmount,
        `Minimum contribution is ${JAMIYA_CONSTRAINTS.minContributionAmount}`,
      )
      .max(JAMIYA_CONSTRAINTS.maxContributionAmount),
    currency: z.enum(SUPPORTED_CURRENCIES),
    maxMembers: z.preprocess((value) => {
      if (value === '' || value === null || value === undefined) {
        return JAMIYA_CONSTRAINTS.openMaxMembers;
      }
      if (typeof value === 'number' && Number.isNaN(value)) {
        return JAMIYA_CONSTRAINTS.openMaxMembers;
      }
      if (typeof value === 'string' && value.trim() === '') {
        return JAMIYA_CONSTRAINTS.openMaxMembers;
      }
      return value;
    }, z.coerce
      .number({ invalid_type_error: 'Enter a valid member count' })
      .int()
      .min(JAMIYA_CONSTRAINTS.minMembers, `At least ${JAMIYA_CONSTRAINTS.minMembers} if you set a cap`)
      .max(JAMIYA_CONSTRAINTS.maxMembers)),
    cycleCount: z.preprocess((value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return value;
    }, z.coerce
      .number({ invalid_type_error: 'Enter a valid cycle count' })
      .int()
      .min(JAMIYA_CONSTRAINTS.minCycles)
      .max(JAMIYA_CONSTRAINTS.maxCycles)
      .optional()),
    contributionFrequencyDays: z.coerce
      .number({ invalid_type_error: 'Enter a valid frequency' })
      .int()
      .min(1)
      .max(365),
    startDate: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: 'Enter a valid start date',
      }),
    status: z.enum(['draft', 'open']),
    segment: z.enum(['general', 'womens_circle', 'boda_stage']).default('general'),
    challengeKind: z.enum(['rotating', 'savings', 'share_dividend']).default('savings'),
    joinFeeAmount: z.coerce.number().min(0).max(1_000_000).default(0),
    transactionFeeAmount: z.coerce.number().min(0).max(100_000).default(0),
    gracePeriodDays: z.coerce.number().int().min(0).max(14).default(3),
    slotPricingEnabled: z.preprocess(
      (value) => value === true || value === 'true' || value === 'on' || value === 1 || value === '1',
      z.boolean(),
    ).default(false),
    earlySlotFeePct: z.coerce.number().min(0).max(50).default(0),
    lateSlotRebatePct: z.coerce.number().min(0).max(50).default(0),
  });

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema.optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional().or(z.literal('')),
  countryCode: z
    .string()
    .trim()
    .length(2, 'Use a 2-letter country code')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
});

export const createInvitationSchema = z
  .object({
    jamiyaId: z.string().uuid(),
    email: emailSchema.optional().or(z.literal('')),
    phone: phoneSchema.optional().or(z.literal('')),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: 'Provide an email or phone number',
    path: ['email'],
  });

/** Circle admin add-member: email and/or phone (phone-only OK for elders). */
export const addCircleMemberSchema = z
  .object({
    jamiyaId: z.string().uuid(),
    email: emailSchema.optional().or(z.literal('')),
    phone: phoneSchema.optional().or(z.literal('')),
    fullName: z.string().trim().max(120).optional().or(z.literal('')),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: 'Provide an email or phone number',
    path: ['email'],
  });

export const invitationTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(6, 'Invalid invitation code or token'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Kenya mobile for OTP login — accepts 07… or +254… (normalized server-side). */
export const kenyaMobileSchema = z
  .string()
  .trim()
  .min(9, 'Enter a Kenya mobile number')
  .max(20);

export const phoneOtpRequestSchema = z.object({
  phone: kenyaMobileSchema,
});

export const phoneOtpVerifySchema = z.object({
  phone: kenyaMobileSchema,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const topUpSchema = z.object({
  amount: z.coerce.number().min(100).max(10_000_000),
  currency: z.enum(SUPPORTED_CURRENCIES).default('KES'),
  phone: phoneSchema.optional().or(z.literal('')),
  provider: z.enum(['simulated', 'mpesa', 'bank', 'paystack']).default('simulated'),
});

export const openDisputeSchema = z.object({
  jamiyaId: z.string().uuid(),
  type: z.enum([
    'missed_contribution',
    'payout_delay',
    'incorrect_amount',
    'membership',
    'other',
  ]),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;
/** @deprecated Use createCircleSchema */
export const createJamiyaSchema = createCircleSchema;
/** @deprecated Use CreateCircleInput */
export type CreateJamiyaInput = CreateCircleInput;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AddCircleMemberInput = z.infer<typeof addCircleMemberSchema>;
export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;
export type TopUpInput = z.infer<typeof topUpSchema>;
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
