import { describe,expect,it } from "vitest";
import { compareRounds } from "./analytics";
describe("rundesammenligning",()=>{
  it("bruker samme varehus i endringsberegningen",()=>{
    const result=compareRounds([{storeId:"a",totalQuartersSum:128},{storeId:"b",totalQuartersSum:160}],
      [{storeId:"a",totalQuartersSum:112},{storeId:"c",totalQuartersSum:16}]);
    expect(result.currentAverage).toBe(9);
    expect(result.previousAverage).toBe(4);
    expect(result.commonCount).toBe(1);
    expect(result.commonChange).toBe(1);
  });
  it("viser manglende sammenligning uten å tolke den som null",()=>{
    expect(compareRounds([{storeId:"a",totalQuartersSum:100}],[]).commonChange).toBeNull();
  });
});
