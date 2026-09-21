import type { CompetitionFormatKind, CompetitionFormatStatus } from "@domain/competition/competition-format";
import type { CompetitionStatus, ContestStatus, StageStatus } from "@domain/competition/competition.types";

export type TournamentProgressionState="not_applicable"|"awaiting_result"|"awaiting_progression"|"progressed"|"terminal_progressed";
export type TournamentEntrantIdentityView=
 |{readonly competitionEntryId:string;readonly entrantType:"team"|"athlete";readonly identityStatus:"resolved";readonly displayName:string}
 |{readonly competitionEntryId:string;readonly entrantType:"team"|"athlete"|"unknown";readonly identityStatus:"unavailable"};
export interface TournamentSeedAssignmentView{readonly seedNumber:number;readonly competitionEntryId:string;}
export interface TournamentParticipantView{readonly contestParticipantId:string;readonly position:number;readonly competitionEntryId:string;readonly sourceType:"seed"|"contest_outcome";readonly sourceSeedNumber?:number;readonly sourceContestResultId?:string;readonly sourceOutcome?:"winner"|"loser";}
export interface TournamentResultView{readonly contestResultId:string;readonly status:"finalized";readonly finalizedAt:string;readonly winnerCompetitionEntryId:string;readonly loserCompetitionEntryId:string;readonly progressionConsumed:boolean;}
export interface TournamentContestView{readonly contestId:string;readonly planRef:string;readonly stageId:string;readonly sequence:number;readonly status:ContestStatus;readonly scheduledAt?:string;readonly capacity:number;readonly participants:readonly TournamentParticipantView[];readonly result?:TournamentResultView;readonly progressionState:TournamentProgressionState;}
export interface TournamentStageView{readonly stageId:string;readonly sequence:number;readonly status:StageStatus;readonly divisionId?:string;readonly contests:readonly TournamentContestView[];}
export interface TournamentOutcomeView{readonly competitionOutcomeId:string;readonly finalizedAt:string;readonly placements:readonly {readonly position:number;readonly competitionEntryId:string;readonly sourceContestResultId:string}[];}
export type TournamentOperationsPhase="setup"|"awaiting_seeding"|"seeding"|"ready"|"in_progress"|"final_pending"|"completed";
export interface TournamentOperationsView{readonly competitionFormatId:string;readonly competitionId:string;readonly eventId:string;readonly organizationId:string;readonly divisionId?:string;readonly sportId:string;readonly formatKind:CompetitionFormatKind;readonly competitionStatus:CompetitionStatus;readonly formatStatus:CompetitionFormatStatus;readonly phase:TournamentOperationsPhase;readonly entrantCount?:number;readonly entrants:readonly TournamentEntrantIdentityView[];readonly seeding:{readonly frozenEntrantCount?:number;readonly finalized:boolean;readonly finalizedAt?:string;readonly assignedCount:number;readonly assignments:readonly TournamentSeedAssignmentView[]};readonly stages:readonly TournamentStageView[];readonly contests:readonly TournamentContestView[];readonly outcome?:TournamentOutcomeView;}

/** A persistence-neutral, coherent snapshot. The application derives phase from it. */
export interface TournamentOperationsSnapshot extends Omit<TournamentOperationsView,"phase">{}
export type TournamentOperationsReadResult={kind:"found";snapshot:TournamentOperationsSnapshot}|{kind:"not_found"}|{kind:"unsupported_operations_format"}|{kind:"unavailable";detail?:string};
export interface TournamentOperationsReader{read(competitionFormatId:string):Promise<TournamentOperationsReadResult>;}
