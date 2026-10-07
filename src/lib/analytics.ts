export type RankedStore = { storeId: string; totalQuartersSum: number };
export function compareRounds(current: RankedStore[], previous: RankedStore[]) {
  const previousByStore = new Map(previous.map((r) => [r.storeId, r.totalQuartersSum]));
  const common = current.filter((r) => previousByStore.has(r.storeId));
  const changes = common.map((r) => ({ storeId:r.storeId, change:(r.totalQuartersSum-previousByStore.get(r.storeId)!)/16 }))
    .sort((a,b)=>b.change-a.change);
  const average = (rows: RankedStore[]) => rows.length ? rows.reduce((sum,r) => sum + r.totalQuartersSum,0) / (rows.length * 16) : null;
  const currentCommonAverage = average(common);
  const previousCommonAverage = common.length ? common.reduce((sum,r) => sum + previousByStore.get(r.storeId)!,0)/(common.length*16) : null;
  return { currentAverage: average(current), previousAverage: average(previous), commonCount: common.length, changes,
    currentCommonAverage, previousCommonAverage,
    commonChange: currentCommonAverage === null || previousCommonAverage === null ? null : currentCommonAverage - previousCommonAverage };
}
