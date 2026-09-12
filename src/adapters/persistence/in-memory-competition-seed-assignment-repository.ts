import type {CompetitionSeedAssignmentRepository,CompetitionSeedAssignmentLookup,CompetitionSeedAssignmentPersistenceError} from "@app/contracts";
import type {CompetitionSeedAssignment} from "@domain/competition/competition-seed-assignment";
import type {InMemoryCompetitionStructureMaterializer} from "@adapters/persistence/in-memory-competition-structure-materializer";
import type {Id,Result} from "@shared/kernel";
const bad=(kind:CompetitionSeedAssignmentPersistenceError["kind"]):Result<never,CompetitionSeedAssignmentPersistenceError>=>({ok:false,error:{kind}});
export class InMemoryCompetitionSeedAssignmentRepository implements CompetitionSeedAssignmentRepository{
 private readonly values=new Map<string,CompetitionSeedAssignment>();
 constructor(private readonly materializer?:InMemoryCompetitionStructureMaterializer){}
 private lookup(x?:CompetitionSeedAssignment):CompetitionSeedAssignmentLookup{return x?{kind:"found",assignment:x}:{kind:"not_found"};}
 async findById(id:Id<"CompetitionSeedAssignment">){return this.lookup(this.values.get(id));}
 async findByFormatAndSeed(f:Id<"CompetitionFormat">,s:number){return this.lookup([...this.values.values()].find(x=>x.competitionFormatId===f&&x.seedNumber===s));}
 async findByFormatAndEntry(f:Id<"CompetitionFormat">,e:Id<"CompetitionEntry">){return this.lookup([...this.values.values()].find(x=>x.competitionFormatId===f&&x.competitionEntryId===e));}
 async listByFormat(f:Id<"CompetitionFormat">){return{ok:true as const,value:[...this.values.values()].filter(x=>x.competitionFormatId===f).sort((a,b)=>a.seedNumber-b.seedNumber)};}
 async create(x:CompetitionSeedAssignment){if(this.materializer?.isSeedFinalized(x.competitionFormatId))return bad("seeding_finalized");if(this.values.has(x.id))return bad("duplicate_id");if([...this.values.values()].some(y=>y.competitionFormatId===x.competitionFormatId&&y.seedNumber===x.seedNumber))return bad("seed_already_assigned");if([...this.values.values()].some(y=>y.competitionFormatId===x.competitionFormatId&&y.competitionEntryId===x.competitionEntryId))return bad("entry_already_assigned");this.values.set(x.id,x);return{ok:true as const,value:x};}
}
