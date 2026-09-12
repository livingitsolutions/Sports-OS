declare const trustedOnboarder: unique symbol;
export type OnboardingPrincipalType = "system" | "admin";
export interface TrustedOrganizationOnboarder { readonly type: OnboardingPrincipalType; readonly subject: string; readonly [trustedOnboarder]: true; }
export interface OrganizationOnboardingPrincipalValidator { isValid(value: TrustedOrganizationOnboarder): boolean; }
