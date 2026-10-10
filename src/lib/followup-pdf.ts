import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { areas } from "./scoring";
import { loadPhoto } from "./report-template/build";
import { FollowupDocument } from "./report-template/followup-document";
import type { ReportPhoto } from "./report-template/report-document";

export type FollowupImage = { path: string; caption: string };
export type FollowupUpdate = { author: string; createdAt: string; status: string | null; comment: string; images: FollowupImage[] };
export type FollowupTask = { areaKey: string | null; description: string; status: string; dueDate: string | null; createdAt: string; images: FollowupImage[]; updates: FollowupUpdate[] };
export type Followup = { storeName: string; cooperativeName: string; reportLabel: string; visitDate: string | null; generatedAt: string; tasks: FollowupTask[] };

/** Orders tasks the way the report reads: by area, then oldest first. */
export function sortTasks<T extends { areaKey: string | null; createdAt: string }>(tasks: T[]) {
  const rank = (key: string | null) => { const index = areas.findIndex((area) => area.key === key); return index < 0 ? areas.length : index; };
  return [...tasks].sort((a, b) => rank(a.areaKey) - rank(b.areaKey) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Builds a follow-up report for the tasks created from a published report. It is generated on
 * download, so it always shows current status, replies and photos; the published report itself stays locked.
 */
export async function buildFollowupPdf(data: Followup, storage: SupabaseClient): Promise<Uint8Array> {
  const photos = async (images: FollowupImage[]) => (await Promise.all(images.map((image) => loadPhoto(storage, "action-images", image.path, image.caption))))
    .filter((photo): photo is ReportPhoto => !!photo);
  const tasks = await Promise.all(sortTasks(data.tasks).map(async (task) => ({
    area: areas.find((area) => area.key === task.areaKey)?.label || "Generelt", description: task.description, status: task.status,
    dueDate: task.dueDate, createdAt: task.createdAt, photos: await photos(task.images),
    updates: await Promise.all(task.updates.map(async (update) => ({ author: update.author, createdAt: update.createdAt, status: update.status, comment: update.comment, photos: await photos(update.images) }))),
  })));
  const document = createElement(FollowupDocument, { data: { ...data, tasks } });
  return new Uint8Array(await renderToBuffer(document as Parameters<typeof renderToBuffer>[0]));
}
