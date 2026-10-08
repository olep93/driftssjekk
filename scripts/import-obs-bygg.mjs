import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const catalog = JSON.parse(readFileSync(new URL("../src/data/obs-bygg-catalog.json", import.meta.url), "utf8"));
const adminId = "ab5c5d64-781c-4f18-9b6a-4ccf29b6519f";

function check(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

const cooperatives = check(await supabase.from("cooperatives").select("id,name"), "Read cooperatives");
const stores = check(await supabase.from("stores").select("id,cooperative_id,name,code"), "Read stores");
const memberships = check(await supabase.from("memberships").select("user_id,cooperative_id,role,store_id").eq("user_id", adminId), "Read memberships");

for (const name of [...new Set(catalog.map((item) => item.cooperative))]) {
  let cooperative = cooperatives.find((item) => item.name === name);
  if (!cooperative) {
    cooperative = check(await supabase.from("cooperatives").insert({ name }).select("id,name").single(), `Create ${name}`);
    cooperatives.push(cooperative);
  }
  for (const item of catalog.filter((entry) => entry.cooperative === name)) {
    const exact = stores.find((store) => store.cooperative_id === cooperative.id && store.name === item.store);
    const shortName = item.store.replace(/^Obs Bygg /, "");
    const legacy = stores.find((store) => store.cooperative_id === cooperative.id && store.name === shortName);
    if (exact || legacy) {
      const prior = exact || legacy;
      if (prior.name !== item.store || prior.code !== item.storeCode) {
        check(await supabase.from("stores").update({ name: item.store, code: item.storeCode, active: true }).eq("id", prior.id), `Update ${item.store}`);
        prior.name = item.store;
        prior.code = item.storeCode;
      }
    } else {
      const created = check(await supabase.from("stores").insert({ cooperative_id: cooperative.id, name: item.store, code: item.storeCode }).select("id,cooperative_id,name,code").single(), `Create ${item.store}`);
      stores.push(created);
    }
  }
  for (const role of ["cooperative_admin", "operations"]) {
    if (!memberships.some((entry) => entry.cooperative_id === cooperative.id && entry.role === role && entry.store_id === null)) {
      check(await supabase.from("memberships").insert({ user_id: adminId, cooperative_id: cooperative.id, store_id: null, role }), `Assign ${role} in ${name}`);
      memberships.push({ user_id: adminId, cooperative_id: cooperative.id, store_id: null, role });
    }
  }
}

const identity = check(await supabase.auth.admin.getUserById(adminId), "Read system administrator");
check(await supabase.auth.admin.updateUserById(adminId, {
  app_metadata: { ...identity.user.app_metadata, system_admin: true },
}), "Set system administrator");
console.log(`Imported ${catalog.length} active Obs Bygg stores in ${new Set(catalog.map((item) => item.cooperative)).size} cooperatives.`);
