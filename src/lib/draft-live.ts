"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "./supabase/browser";
import type { AreaKey } from "./scoring";

export type DraftPeer = { userId: string; name: string; area: AreaKey | null };
type Meta = { name?: string; area?: AreaKey | null };

/** Collapses Supabase presence state to one entry per colleague, ignoring the current user's own devices. */
export function peersFromPresence(state: Record<string, Meta[]>, selfId: string): DraftPeer[] {
  return Object.entries(state)
    .filter(([userId, metas]) => userId !== selfId && metas.length > 0)
    .map(([userId, metas]) => {
      const active = metas.find((meta) => meta.area) || metas[0];
      return { userId, name: active.name || "Kollega", area: active.area || null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/**
 * Joins the private Realtime channel for a draft. Colleagues' saves and photo changes arrive as
 * "changed" signals, and presence shows who is in the draft and which area they are working on.
 * The editor keeps polling as a fallback, so a blocked or dropped connection only slows updates down.
 */
export function useDraftLive(versionId: string, self: { id: string; name: string }, onRemoteChange: () => void) {
  const [peers, setPeers] = useState<DraftPeer[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);
  const areaRef = useRef<AreaKey | null>(null);
  const changeRef = useRef(onRemoteChange);
  useEffect(() => { changeRef.current = onRemoteChange; }, [onRemoteChange]);

  useEffect(() => {
    const client = createClient();
    let active = true, pending: number | undefined;
    const channel = client.channel(`draft:${versionId}`, { config: { private: true, presence: { key: self.id } } });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => setPeers(peersFromPresence(channel.presenceState<Meta>(), self.id)))
      .on("broadcast", { event: "changed" }, () => {
        // Bursts of uploads become one fetch.
        window.clearTimeout(pending);
        pending = window.setTimeout(() => changeRef.current(), 250);
      });
    void client.realtime.setAuth().then(() => {
      if (!active) return;
      channel.subscribe((status) => {
        if (!active) return;
        joinedRef.current = status === "SUBSCRIBED";
        setConnected(joinedRef.current);
        if (status === "SUBSCRIBED") {
          void channel.track({ name: self.name, area: areaRef.current });
          // Catch up on anything that happened while the connection was down.
          changeRef.current();
        }
      });
    });
    return () => {
      active = false; window.clearTimeout(pending); channelRef.current = null; joinedRef.current = false;
      void client.removeChannel(channel);
    };
  }, [versionId, self.id, self.name]);

  const notifyChanged = useCallback(() => {
    if (joinedRef.current) void channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }, []);
  const setArea = useCallback((area: AreaKey | null) => {
    if (areaRef.current === area) return;
    areaRef.current = area;
    // Before joining, the area is sent with the first track call instead.
    if (joinedRef.current) void channelRef.current?.track({ name: self.name, area });
  }, [self.name]);
  return { peers, connected, notifyChanged, setArea };
}
