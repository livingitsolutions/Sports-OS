import type {TournamentOperationsReader,TournamentOperationsSnapshot} from "@app/contracts/tournament-operations-reader";
const copy=(snapshot:TournamentOperationsSnapshot):TournamentOperationsSnapshot=>JSON.parse(JSON.stringify(snapshot)) as TournamentOperationsSnapshot;
export class InMemoryTournamentOperationsReader implements TournamentOperationsReader{
 private readonly snapshots=new Map<string,TournamentOperationsSnapshot>();
 constructor(initial:readonly TournamentOperationsSnapshot[]=[]){for(const snapshot of initial)this.put(snapshot);}
 put(snapshot:TournamentOperationsSnapshot):void{this.snapshots.set(snapshot.competitionFormatId,copy(snapshot));}
 async read(id:string){const snapshot=this.snapshots.get(id);if(!snapshot)return{kind:"not_found" as const};if(snapshot.formatKind!=="single_elimination")return{kind:"unsupported_operations_format" as const};return{kind:"found" as const,snapshot:copy(snapshot)};}
}
