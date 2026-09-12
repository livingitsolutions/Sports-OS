declare const trustedBootstrapper: unique symbol;
export type BootstrapPrincipalType="system"|"admin";
export interface TrustedOrganizationBootstrapper{readonly type:BootstrapPrincipalType;readonly subject:string;readonly [trustedBootstrapper]:true;}
export interface OrganizationBootstrapPrincipalValidator{isValid(value:TrustedOrganizationBootstrapper):boolean;}
