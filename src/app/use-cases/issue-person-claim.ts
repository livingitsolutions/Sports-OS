import type { AccountRepository, AppError, ClaimTokenGenerator, ClaimTokenHasher, Clock, IdGenerator, PersonClaimRepository, PersonRepository, RawClaimToken, UseCase } from "@app/contracts";
import { createPersonClaim } from "@domain/auth/person-claim";
import { revokePersonClaim } from "@domain/auth/person-claim";
import type { PersonClaim } from "@domain/auth/person-claim";
import type { Id, Result } from "@shared/kernel";

export interface IssuePersonClaimInput { readonly personId: Id<"Person">; }
export interface IssuePersonClaimOutput { readonly claim: PersonClaim; readonly rawToken: RawClaimToken; }
export type IssuePersonClaimErrorKind = "person_not_found" | "person_not_linkable" | "person_already_linked" | "persistence_unavailable";
export interface IssuePersonClaimError extends AppError { readonly kind: IssuePersonClaimErrorKind; }
export interface IssuePersonClaimDeps { readonly personRepository: PersonRepository; readonly accountRepository: AccountRepository; readonly personClaimRepository: PersonClaimRepository; readonly tokenGenerator: ClaimTokenGenerator; readonly tokenHasher: ClaimTokenHasher; readonly idGenerator: IdGenerator; readonly clock: Clock; readonly lifetimeMs?: number; }

/** Internal/trusted use case. A future administrative/onboarding boundary controls invocation. */
export class IssuePersonClaim implements UseCase<IssuePersonClaimInput, IssuePersonClaimOutput> {
  constructor(private readonly deps: IssuePersonClaimDeps) {}
  async execute(input: IssuePersonClaimInput): Promise<Result<IssuePersonClaimOutput, IssuePersonClaimError>> {
    const person = await this.deps.personRepository.findById(input.personId);
    if (person.kind === "not_found") return failure("person_not_found", "The Person does not exist.");
    if (person.kind !== "found") return failure("persistence_unavailable", "Person storage is currently unavailable.");
    if (person.person.lifecycleStatus !== "active") return failure("person_not_linkable", "Only an active Person can be claimed.");
    const account = await this.deps.accountRepository.findByPersonId(input.personId);
    if (account.kind === "found") return failure("person_already_linked", "The Person already has an Account.");
    if (account.kind !== "not_found") return failure("persistence_unavailable", "Account storage is currently unavailable.");
    const now = this.deps.clock.now();
    const prior = await this.deps.personClaimRepository.findPendingByPersonId(input.personId);
    if (prior.kind !== "found" && prior.kind !== "not_found") return failure("persistence_unavailable", "Claim storage is currently unavailable.");
    const expiresAt = new Date(new Date(now).getTime() + (this.deps.lifetimeMs ?? 86_400_000)).toISOString() as typeof now;
    const rawToken = this.deps.tokenGenerator.generate();
    const claim = createPersonClaim({ id: this.deps.idGenerator.next("PersonClaim"), personId: input.personId, tokenHash: this.deps.tokenHasher.hash(rawToken), now, expiresAt });
    if (!claim.ok) return failure("persistence_unavailable", claim.error.message);
    const revoked = prior.kind === "found" ? revokePersonClaim(prior.claim, now) : null;
    if (revoked !== null && !revoked.ok) return failure("persistence_unavailable", revoked.error.message);
    const replacement = prior.kind === "found" && revoked?.ok === true ? { revokedClaim: revoked.value, expectedVersion: prior.claim.version } : undefined;
    const persisted = await this.deps.personClaimRepository.issueReplacingPending(claim.value, replacement);
    if (!persisted.ok) {
      if (persisted.error.kind === "person_not_found") return failure("person_not_found", "The Person does not exist.");
      if (persisted.error.kind === "person_already_linked") return failure("person_already_linked", "The Person already has an Account.");
      return failure("persistence_unavailable", "Claim storage is currently unavailable.");
    }
    return { ok: true, value: { claim: persisted.value, rawToken } };
  }
}
function failure(kind: IssuePersonClaimErrorKind, message: string): Result<never, IssuePersonClaimError> { return { ok: false, error: { kind, code: kind, message } }; }
