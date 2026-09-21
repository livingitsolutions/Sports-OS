import { describe,expect,it,vi } from "vitest";
import { ManageOrganizerContestLifecycle } from "@app/use-cases/manage-organizer-contest-lifecycle";

const context={execute:vi.fn().mockResolvedValue({ok:true,value:{organizations:[{organizationId:"org",membershipId:"member"}]}})};
describe("authenticated organizer contest lifecycle facade",()=>{
  it("resolves the current contest version server-side",async()=>{
    const execute=vi.fn().mockResolvedValue({ok:true,value:{contest:{id:"contest",status:"in_progress"}}});
    const useCase=new ManageOrganizerContestLifecycle({organizerContext:context as never,contests:{findById:vi.fn().mockResolvedValue({kind:"found",contest:{version:7}})} as never,schedule:{execute:vi.fn()} as never,start:{execute} as never,complete:{execute:vi.fn()} as never});
    const result=await useCase.execute({organizationId:"org",contestId:"contest",operation:"start"});
    expect(result.ok).toBe(true);expect(execute).toHaveBeenCalledWith({actingMembershipId:"member",aggregateId:"contest",expectedVersion:7});
  });
  it("rejects an organization outside authenticated memberships",async()=>{
    const findById=vi.fn();const useCase=new ManageOrganizerContestLifecycle({organizerContext:context as never,contests:{findById} as never,schedule:{} as never,start:{} as never,complete:{} as never});
    const result=await useCase.execute({organizationId:"other",contestId:"contest",operation:"start"});
    expect(result).toMatchObject({ok:false,error:{kind:"forbidden"}});expect(findById).not.toHaveBeenCalled();
  });
});
