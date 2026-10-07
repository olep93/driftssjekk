export function assertDemoTarget(url) {
  const host = new URL(url).hostname;
  if (["localhost", "127.0.0.1"].includes(host)) return;

  const ref = process.env.DEMO_REMOTE_PROJECT_REF;
  const confirmation = process.env.DEMO_REMOTE_CONFIRM;
  if (!ref || !/^[a-z0-9]+$/.test(ref) ||
      host !== `${ref}.supabase.co` ||
      confirmation !== `driftssjekk-demo:${ref}`) {
    throw new Error("Ekstern seed/test krever eksakt DEMO_REMOTE_PROJECT_REF og DEMO_REMOTE_CONFIRM=driftssjekk-demo:<ref>.");
  }
}
