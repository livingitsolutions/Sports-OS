import type { Competition,Contest,Division,Event,Stage } from "@domain/competition/competition.types";import type { Id,Result } from "@shared/kernel";
export type CompetitionPersistenceError={kind:"duplicate_id"|"duplicate_key"|"duplicate_sequence"|"parent_not_found"|"concurrency_conflict"|"invalid_persistence_state"|"unavailable";detail?:string};
export type Lookup<T,N extends string>={kind:"found"}&Record<N,T>|{kind:"not_found"}|{kind:"invalid_persistence_state"|"unavailable";detail?:string};
interface Base<T,N extends string>{create(value:T):Promise<Result<T,CompetitionPersistenceError>>;save(value:T,expectedVersion:number):Promise<Result<T,CompetitionPersistenceError>>;findById(id:Id<N>):Promise<Lookup<T,Lowercase<N>>>;}
export interface EventRepository extends Base<Event,"Event">{findByOrganizationAndKey(id:Id<"Organization">,key:string):Promise<Lookup<Event,"event">>;}
export interface CompetitionRepository extends Base<Competition,"Competition">{findByEventAndKey(id:Id<"Event">,key:string):Promise<Lookup<Competition,"competition">>;}
export interface DivisionRepository extends Base<Division,"Division">{findByCompetitionAndKey(id:Id<"Competition">,key:string):Promise<Lookup<Division,"division">>;}
export interface StageRepository extends Base<Stage,"Stage">{findByCompetitionAndKey(id:Id<"Competition">,key:string):Promise<Lookup<Stage,"stage">>;}
export interface ContestRepository extends Base<Contest,"Contest">{findByStageAndSequence(id:Id<"Stage">,sequence:number):Promise<Lookup<Contest,"contest">>;}
