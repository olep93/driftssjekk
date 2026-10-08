import { describe, expect, it } from "vitest";
import { mergeDraft, type DraftFields } from "./draft-merge";

const make = (): DraftFields => ({visitDate:"2026-10-08",summary:"",areas:{
  drive_in:{score_quarters:null,comment:"",needs_follow_up:false},
  store:{score_quarters:null,comment:"",needs_follow_up:false},
  outdoor:{score_quarters:null,comment:"",needs_follow_up:false},
  goods_receiving:{score_quarters:null,comment:"",needs_follow_up:false},
}});

describe("shared draft merge", () => {
  it("keeps a colleague's score while saving my comment", () => {
    const base=make(), mine=make(), theirs=make();
    mine.areas.store.comment="Må fylle hyllene";
    theirs.areas.store.score_quarters=24;
    const result=mergeDraft(base,mine,theirs);
    expect(result.conflicts).toEqual([]);
    expect(result.merged.areas.store).toEqual({score_quarters:24,comment:"Må fylle hyllene",needs_follow_up:false});
  });
  it("flags edits to the same field and lets a person choose which text wins", () => {
    const base=make(), mine=make(), theirs=make();
    mine.areas.outdoor.comment="Mitt notat";
    theirs.areas.outdoor.comment="Kollegaens notat";
    expect(mergeDraft(base,mine,theirs).conflicts).toEqual(["Uteområde: kommentar"]);
    expect(mergeDraft(base,mine,theirs,"theirs").merged.areas.outdoor.comment).toBe("Kollegaens notat");
  });
});
