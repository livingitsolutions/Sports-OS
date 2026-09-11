import type { ClaimAccountLinkError, ClaimAccountLinkRepository, PersonClaimLookupResult, PersonClaimPersistenceError, PersonClaimRepository } from "@app/contracts";
import type { Sql } from "@adapters/persistence/pg/connection";
import { neutralDetail, pgErrorInfo } from "@adapters/persistence/pg/errors";
import type { Account } from "@domain/auth/account";
import type { AggregateVersion } from "@domain/aggregate";
import type { ClaimHashKeyVersion, ClaimIssuerType, ClaimLookupId, ClaimTokenHash, PersonClaim, PersonClaimStatus } from "@domain/auth/person-claim";
import type { Id, ISODateString, Result } from "@shared/kernel";

interface ClaimRow { id:string;person_id:string;token_hash:string;lookup_id:string;hash_key_version:string;issued_by_type:string;issued_by_subject:string;status:string;expires_at:Date|string;consumed_at:Date|string|null;created_at:Date|string;updated_at:Date|string;version:number; }
export class PgPersonClaimRepository implements PersonClaimRepository, ClaimAccountLinkRepository {
  constructor(private readonly sql: Sql) {}
  async issueReplacingPending(claim: PersonClaim, replacement?: { readonly revokedClaim: PersonClaim; readonly expectedVersion: AggregateVersion }): Promise<Result<PersonClaim, PersonClaimPersistenceError>> {
    if (claim.version !== 1 || claim.status !== "pending") return { ok: false, error: { kind: "invalid_persistence_state" } };
    try {
      return await this.sql.begin(async (tx) => {
        const people = await tx<{ id: string }[]>`SELECT id FROM persons WHERE id=${claim.personId} FOR UPDATE`;
        if (people.length === 0) return { ok: false, error: { kind: "person_not_found" } } as const;
        const accounts = await tx<{ id: string }[]>`SELECT id FROM accounts WHERE person_id=${claim.personId}`;
        if (accounts.length > 0) return { ok: false, error: { kind: "person_already_linked" } } as const;
        const pending = await tx<{ id: string; version: number }[]>`SELECT id, version FROM person_claims WHERE person_id=${claim.personId} AND status='pending'`;
        if (pending.length > 0 && (replacement === undefined || pending[0]?.id !== replacement.revokedClaim.id || pending[0]?.version !== replacement.expectedVersion)) return { ok: false, error: { kind: "concurrency_conflict" } } as const;
        if (replacement !== undefined) {
          if (replacement.revokedClaim.version !== replacement.expectedVersion + 1 || replacement.revokedClaim.status !== 'revoked') return { ok: false, error: { kind: "invalid_persistence_state" } } as const;
          const changed = await tx<{ id: string }[]>`UPDATE person_claims SET status=${replacement.revokedClaim.status}, updated_at=${replacement.revokedClaim.updatedAt}, version=${replacement.revokedClaim.version} WHERE id=${replacement.revokedClaim.id} AND status='pending' AND version=${replacement.expectedVersion} RETURNING id`;
          if (changed.length !== 1) return { ok: false, error: { kind: "concurrency_conflict" } } as const;
        }
        await tx`INSERT INTO person_claims (id, person_id, token_hash, lookup_id, hash_key_version, issued_by_type, issued_by_subject, status, expires_at, consumed_at, created_at, updated_at, version) VALUES (${claim.id}, ${claim.personId}, ${claim.tokenHash}, ${claim.lookupId}, ${claim.hashKeyVersion}, ${claim.issuedBy.type}, ${claim.issuedBy.subject}, ${claim.status}, ${claim.expiresAt}, ${claim.consumedAt}, ${claim.createdAt}, ${claim.updatedAt}, ${claim.version})`;
        return { ok: true, value: claim } as const;
      });
    } catch (error) { return { ok: false, error: mapIssueError(error) }; }
  }
  async findByLookupId(lookupId: ClaimLookupId): Promise<PersonClaimLookupResult> {
    try {
      const rows = await this.sql<ClaimRow[]>`SELECT id, person_id, token_hash, lookup_id, hash_key_version, issued_by_type, issued_by_subject, status, expires_at, consumed_at, created_at, updated_at, version FROM person_claims WHERE lookup_id=${lookupId} LIMIT 1`;
      if (rows[0] === undefined) return { kind: "not_found" };
      const claim = toClaim(rows[0]);
      return claim === null ? { kind: "invalid_persistence_state" } : { kind: "found", claim };
    } catch (error) { return { kind: "unavailable", detail: neutralDetail(error) }; }
  }
  async findPendingByPersonId(personId: Id<"Person">): Promise<PersonClaimLookupResult> {
    try {
      const rows = await this.sql<ClaimRow[]>`SELECT id, person_id, token_hash, lookup_id, hash_key_version, issued_by_type, issued_by_subject, status, expires_at, consumed_at, created_at, updated_at, version FROM person_claims WHERE person_id=${personId} AND status='pending' LIMIT 1`;
      if (rows[0] === undefined) return { kind: "not_found" };
      const claim = toClaim(rows[0]);
      return claim === null ? { kind: "invalid_persistence_state" } : { kind: "found", claim };
    } catch (error) { return { kind: "unavailable", detail: neutralDetail(error) }; }
  }
  async createAccountAndConsumeClaim(account: Account, consumed: PersonClaim, expected: AggregateVersion): Promise<Result<Account, ClaimAccountLinkError>> {
    if (consumed.version !== expected + 1 || consumed.status !== "consumed" || consumed.consumedAt === null) return { ok: false, error: { kind: "invalid_persistence_state" } };
    const consumedAt = consumed.consumedAt;
    try {
      return await this.sql.begin(async (tx) => {
        const people = await tx<{ id: string }[]>`SELECT id FROM persons WHERE id=${account.personId} FOR UPDATE`;
        if (people.length === 0) return { ok: false, error: { kind: "person_not_found" } } as const;
        const changed = await tx<{ id: string }[]>`UPDATE person_claims SET status='consumed', consumed_at=${consumedAt}, updated_at=${consumed.updatedAt}, version=${consumed.version} WHERE id=${consumed.id} AND person_id=${account.personId} AND status='pending' AND version=${expected} AND expires_at > ${consumedAt} RETURNING id`;
        if (changed.length === 0) {
          const rows = await tx<ClaimRow[]>`SELECT id, person_id, token_hash, lookup_id, hash_key_version, issued_by_type, issued_by_subject, status, expires_at, consumed_at, created_at, updated_at, version FROM person_claims WHERE id=${consumed.id}`;
          return { ok: false, error: classifyRejected(rows[0], consumedAt) } as const;
        }
        await tx`INSERT INTO accounts (id, auth_subject, person_id, status, version, created_at, updated_at) VALUES (${account.id}, ${account.authSubject}, ${account.personId}, ${account.status}, ${account.version}, ${account.createdAt}, ${account.updatedAt})`;
        return { ok: true, value: account } as const;
      });
    } catch (error) { return { ok: false, error: mapLinkError(error) }; }
  }
}

function toClaim(row: ClaimRow): PersonClaim | null {
  if (!(["pending", "consumed", "expired", "revoked"] as string[]).includes(row.status) || !(["system","admin","onboarding"] as string[]).includes(row.issued_by_type) || !Number.isInteger(row.version) || row.version < 1) return null;
  return { id:row.id as Id<"PersonClaim">,personId:row.person_id as Id<"Person">,tokenHash:row.token_hash as ClaimTokenHash,lookupId:row.lookup_id as ClaimLookupId,hashKeyVersion:row.hash_key_version as ClaimHashKeyVersion,issuedBy:{type:row.issued_by_type as ClaimIssuerType,subject:row.issued_by_subject},status:row.status as PersonClaimStatus,expiresAt:iso(row.expires_at),consumedAt:row.consumed_at===null?null:iso(row.consumed_at),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),version:row.version as AggregateVersion };
}
function classifyRejected(row: ClaimRow | undefined, at: ISODateString): ClaimAccountLinkError {
  if (row === undefined) return { kind: "claim_not_found" };
  if (row.status === "consumed") return { kind: "consumed_claim" };
  if (row.status === "revoked") return { kind: "revoked_claim" };
  if (iso(row.expires_at) <= at || row.status === "expired") return { kind: "expired_claim" };
  return { kind: "concurrency_conflict" };
}
function mapIssueError(error: unknown): PersonClaimPersistenceError { const info=pgErrorInfo(error); if(info?.code==="23503") return {kind:"person_not_found"}; if(info?.code==="23505") return {kind:info.constraint.includes("token_hash")?"duplicate_token_hash":"duplicate_claim_id"}; return {kind:"unavailable",detail:neutralDetail(error)}; }
function mapLinkError(error: unknown): ClaimAccountLinkError { const info=pgErrorInfo(error); if(info?.code==="23503") return {kind:"person_not_found"}; if(info?.code==="23505") return {kind:info.constraint.includes("auth_subject")?"auth_subject_already_linked":info.constraint.includes("person_id")?"person_already_linked":"concurrency_conflict"}; return {kind:"unavailable",detail:neutralDetail(error)}; }
function iso(value: Date | string): ISODateString { return (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) as ISODateString; }
