/** Brand & product constants */
export const APP_NAME = 'Amanah';
export const APP_DESCRIPTION =
  'The financial operating system for trusted communities — Shariah-compliant circles, wallet, and savings.';
export const APP_TAGLINE = 'Your money. Your people. Your Amanah.';

/** Supported currencies (ISO 4217). Expand as markets open. */
export const SUPPORTED_CURRENCIES = ['KES', 'USD', 'AED', 'SAR', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: SupportedCurrency = 'KES';

/** Contribution / cycle constraints */
export const JAMIYA_CONSTRAINTS = {
  nameMinLength: 3,
  nameMaxLength: 80,
  descriptionMaxLength: 1000,
  /** Floor when a member cap is set (a circle needs at least 2 people). */
  minMembers: 2,
  /** Hard ceiling if someone types a cap (must match DB check). */
  maxMembers: 50,
  /** Used when "Maximum members" is left blank — open chama. */
  openMaxMembers: 50,
  minContributionAmount: 100,
  maxContributionAmount: 10_000_000,
  minCycles: 2,
  maxCycles: 50,
} as const;

/** Pagination defaults */
export const PAGINATION = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

/** Platform roles ordered by privilege (ascending). */
export const PLATFORM_ROLE_HIERARCHY = [
  'member',
  'compliance_officer',
  'platform_admin',
  'super_admin',
] as const;
