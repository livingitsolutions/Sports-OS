import type { AccountRepository, AppError, AuthIdentityProvider, ClaimAccountLinkRepository, ClaimHashKeyProvider, ClaimTokenGenerator, Clock, IdGenerator, PersonClaimRepository, PersonRepository, RawClaimToken, UseCase } from "@app/contracts";
import { createAccount } from "@domain/auth/account";
import type { Account } from "@domain/auth/account";
import { consumePersonClaim } from "@domain/auth/person-claim";
import type { Result } from "@shared/kernel";

/** No personId is accepted: the verified claim is the only source of Person authority. */
export interface LinkAuthenticatedAccountInput { readonly rawClaimToken: RawClaimToken; }
export interface LinkAuthenticatedAccountOutput { readonly account: Account; }
export type LinkAuthenticatedAccountErrorKind = "authenticated_subject_required" | "identity_provider_unavailable" | "invalid_claim" | "hash_key_unavailable" | "expired_claim" | "consumed_claim" | "revoked_claim" | "person_not_found" | "person_not_linkable" | "auth_subject_already_linked" | "person_already_linked" | "persistence_unavailable" | "concurrency_conflict";
export interface LinkAuthenticatedAccountError extends AppError { readonly kind: LinkAuthenticatedAccountErrorKind; }
export interface LinkAuthenticatedAccountDeps { readonly authIdentityProvider: AuthIdentityProvider; readonly tokenGenerator: ClaimTokenGenerator; readonly hashKeys: ClaimHashKeyProvider; readonly personClaimRepository: PersonClaimRepository; readonly claimAccountLinkRepository: ClaimAccountLinkRepository; readonly accountRepository: AccountRepository; readonly personRepository: PersonRepository; readonly idGenerator: IdGenerator; readonly clock: Clock; }

export class LinkAuthenticatedAccountToExistingPerson implements UseCase<LinkAuthenticatedAccountInput, LinkAuthenticatedAccountOutput> {
  constructor(private readonly deps: LinkAuthenticatedAccountDeps) {}
  async execute(input: LinkAuthenticatedAccountInput): Promise<Result<LinkAuthenticatedAccountOutput, LinkAuthenticatedAccountError>> {
    const identity = await this.deps.authIdentityProvider.getCurrentIdentity();
    if (identity.kind === "unauthenticated") return failure("authenticated_subject_required", "An authenticated identity is required.");
    if (identity.kind === "unavailable") return failure("identity_provider_unavailable", "Authentication is currently unavailable.");
    const parsed = this.deps.tokenGenerator.parse(input.rawClaimToken);
    if (parsed === null) return failure("invalid_claim", "The claim is invalid.");
    const lookup = await this.deps.personClaimRepository.findByLookupId(parsed.lookupId);
    if (lookup.kind === "not_found") return failure("invalid_claim", "The claim is invalid.");
    if (lookup.kind !== "found") return failure("persistence_unavailable", "Claim storage is currently unavailable.");
    if (parsed.version !== lookup.claim.hashKeyVersion) return failure("invalid_claim", "The claim is invalid.");
    const verified = this.deps.hashKeys.verify(lookup.claim.hashKeyVersion, lookup.claim.lookupId, parsed.secret, lookup.claim.tokenHash);
    if (!verified.ok) return failure("hash_key_unavailable", "The claim hash key is unavailable.");
    if (!verified.matches) return failure("invalid_claim", "The claim is invalid.");
    const now = this.deps.clock.now();
    const consumed = consumePersonClaim(lookup.claim, now);
    if (!consumed.ok) return failure(consumed.error.code, consumed.error.message);
    const person = await this.deps.personRepository.findById(lookup.claim.personId);
    if (person.kind === "not_found") return failure("person_not_found", "The claimed Person does not exist.");
    if (person.kind !== "found") return failure("persistence_unavailable", "Person storage is currently unavailable.");
    if (person.person.lifecycleStatus !== "active") return failure("person_not_linkable", "Only an active Person can be linked.");
    const bySubject = await this.deps.accountRepository.findByAuthSubject(identity.identity.subject);
    if (bySubject.kind === "found") return failure("auth_subject_already_linked", "The authenticated identity is already linked.");
    if (bySubject.kind !== "not_found") return failure("persistence_unavailable", "Account storage is currently unavailable.");
    const byPerson = await this.deps.accountRepository.findByPersonId(lookup.claim.personId);
    if (byPerson.kind === "found") return failure("person_already_linked", "The Person already has an Account.");
    if (byPerson.kind !== "not_found") return failure("persistence_unavailable", "Account storage is currently unavailable.");
    const account = createAccount({ id: this.deps.idGenerator.next("Account"), authSubject: identity.identity.subject, personId: lookup.claim.personId, now });
    if (!account.ok) return failure("persistence_unavailable", account.error.message);
    const linked = await this.deps.claimAccountLinkRepository.createAccountAndConsumeClaim(account.value, consumed.value, lookup.claim.version);
    if (!linked.ok) return failure(mapAtomicError(linked.error.kind), "Account linkage could not be completed.");
    return { ok: true, value: { account: linked.value } };
  }
}
function mapAtomicError(kind: string): LinkAuthenticatedAccountErrorKind {
  if (kind === "claim_not_found") return "invalid_claim";
  if (kind === "invalid_persistence_state" || kind === "unavailable") return "persistence_unavailable";
  return kind as LinkAuthenticatedAccountErrorKind;
}
function failure(kind: LinkAuthenticatedAccountErrorKind, message: string): Result<never, LinkAuthenticatedAccountError> { return { ok: false, error: { kind, code: kind, message } }; }
