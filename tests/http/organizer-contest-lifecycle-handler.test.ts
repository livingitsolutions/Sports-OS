/* global Request */
import { describe, expect, it, vi } from "vitest";
import { createOrganizerContestLifecycleHandler } from "@adapters/http/organizer-contest-lifecycle-handler";

const valid={organizationId:"org",contestId:"contest",operation:"start"};
const request=(body:unknown,authorization="Bearer verified-token")=>new Request("https://sports.test/lifecycle",{method:"POST",headers:{authorization,"content-type":"application/json"},body:JSON.stringify(body)});

describe("organizer contest lifecycle HTTP boundary",()=>{
  it("rejects unauthenticated commands before composition",async()=>{const create=vi.fn();const response=await createOrganizerContestLifecycleHandler(create)(request(valid,""));expect(response.status).toBe(401);expect(create).not.toHaveBeenCalled();});
  it.each(["actingMembershipId","personId","permission","expectedVersion","status","winnerContestParticipantId"])("rejects browser asserted %s",async field=>{const create=vi.fn();const response=await createOrganizerContestLifecycleHandler(create)(request({...valid,[field]:"tampered"}));expect(response.status).toBe(400);expect(create).not.toHaveBeenCalled();});
  it("accepts only a scheduling timestamp for schedule",async()=>{const execute=vi.fn().mockResolvedValue({ok:true,value:{contestId:"contest",status:"scheduled"}});const response=await createOrganizerContestLifecycleHandler(()=>({contestLifecycle:{execute} as never,close:async()=>undefined}))(request({...valid,operation:"schedule",scheduledAt:"2026-09-22T01:00:00.000Z"}));expect(response.status).toBe(200);expect(execute).toHaveBeenCalledWith({...valid,operation:"schedule",scheduledAt:"2026-09-22T01:00:00.000Z"});});
  it("maps stale concurrent transitions to a safe conflict",async()=>{const execute=vi.fn().mockResolvedValue({ok:false,error:{kind:"concurrency_conflict"}});const response=await createOrganizerContestLifecycleHandler(()=>({contestLifecycle:{execute} as never,close:async()=>undefined}))(request(valid));expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toMatch(/database|postgres|version/i);});
  it("retains forbidden organization authorization",async()=>{const execute=vi.fn().mockResolvedValue({ok:false,error:{kind:"forbidden"}});const response=await createOrganizerContestLifecycleHandler(()=>({contestLifecycle:{execute} as never,close:async()=>undefined}))(request(valid));expect(response.status).toBe(403);});
});
