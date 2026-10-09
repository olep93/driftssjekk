import { describe, expect, it } from "vitest";
import { peersFromPresence } from "./draft-live";

describe("peersFromPresence", () => {
  it("lists colleagues once and leaves out the current user", () => {
    const peers = peersFromPresence({
      me: [{ name: "Ole", area: "store" }],
      kari: [{ name: "Kari", area: null }, { name: "Kari", area: "outdoor" }],
      anne: [{ name: "Anne" }],
      gone: [],
    }, "me");
    expect(peers).toEqual([
      { userId: "anne", name: "Anne", area: null },
      { userId: "kari", name: "Kari", area: "outdoor" },
    ]);
  });
});
