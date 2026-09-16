import type { AggregateRoot, AggregateVersion } from "@domain/aggregate";
import type { Id, ISODateString } from "@shared/kernel";
export type EventStatus="draft"|"active"|"completed"|"cancelled";export type CompetitionStatus=EventStatus;export type DivisionStatus="active"|"inactive";export type StageStatus="pending"|"active"|"completed"|"cancelled";export type ContestStatus="pending"|"scheduled"|"in_progress"|"completed"|"cancelled";
interface Named{readonly name:string;readonly key:string;readonly createdAt:ISODateString;readonly updatedAt:ISODateString;readonly version:AggregateVersion;}
export interface Event extends AggregateRoot<"Event">,Named{readonly organizationId:Id<"Organization">;readonly status:EventStatus;readonly startsAt:ISODateString|null;readonly endsAt:ISODateString|null;}
export interface Competition extends AggregateRoot<"Competition">,Named{readonly eventId:Id<"Event">;readonly sportId:Id<"Sport">;readonly status:CompetitionStatus;}
export interface Division extends AggregateRoot<"Division">,Named{readonly competitionId:Id<"Competition">;readonly status:DivisionStatus;}
export interface Stage extends AggregateRoot<"Stage">,Named{readonly competitionId:Id<"Competition">;readonly divisionId:Id<"Division">|null;readonly competitionFormatId?:Id<"CompetitionFormat">|null;readonly sequence:number;readonly status:StageStatus;}
export interface Contest extends AggregateRoot<"Contest">{readonly stageId:Id<"Stage">;readonly planRef?:string|null;readonly sequence:number;readonly status:ContestStatus;readonly scheduledAt:ISODateString|null;readonly createdAt:ISODateString;readonly updatedAt:ISODateString;readonly version:AggregateVersion;}
