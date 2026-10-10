import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatDate } from "../scoring";
import { contentWidth } from "./layout";
import { Chrome, PhotoGrid, s, statusLabel, tokens, type ReportPhoto } from "./report-document";

export type FollowupDocumentTask = {
  area: string; description: string; status: string; dueDate: string | null; createdAt: string; photos: ReportPhoto[];
  updates: { author: string; createdAt: string; status: string | null; comment: string; photos: ReportPhoto[] }[];
};
export type FollowupDocumentData = { storeName: string; cooperativeName: string; reportLabel: string; visitDate: string | null; generatedAt: string; tasks: FollowupDocumentTask[] };

const stamp = (value: string) => new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const tone = (status: string | null) => status === "done" ? [tokens.goodSoft, tokens.good] : status === "in_progress" ? [tokens.flagSoft, tokens.flag] : [tokens.midSoft, tokens.mid];

function Status({ value }: { value: string | null }) {
  const [background, color] = tone(value);
  return <Text style={[s.pill, { backgroundColor: background, color }]}>{statusLabel[value || ""] || value || "Åpen"}</Text>;
}

/** Follow-up report in the same template as the report: status overview, then one block per task. */
export function FollowupDocument({ data }: { data: FollowupDocumentData }) {
  const counts = (["open", "in_progress", "done"] as const).map((status) => ({ status, count: data.tasks.filter((task) => task.status === status).length }));
  return <Document title={`${data.storeName} – oppfølging`} author="Driftssjekk" language="nb-NO">
    <Page size="A4" style={s.page}>
      <Chrome label="Oppfølging" storeName={data.storeName} date={`status ${stamp(data.generatedAt)}`} />
      <Text style={s.eyebrow}>{data.cooperativeName} · {data.reportLabel}</Text>
      <Text style={[s.h1, { marginTop: 6 }]}>{data.storeName}</Text>
      <Text style={[s.sub, { marginTop: 6 }]}>{data.visitDate ? `Besøk ${formatDate(data.visitDate)} · ` : ""}Status per {stamp(data.generatedAt)}</Text>
      <View style={{ flexDirection: "row", marginTop: 22, backgroundColor: tokens.soft, borderRadius: 8, padding: 16 }}>
        {counts.map(({ status, count }) => <View key={status} style={{ flexGrow: 1, flexBasis: 0 }}>
          <Text style={s.label}>{statusLabel[status]}</Text>
          <Text style={[s.big, { fontSize: 34, marginTop: 6, color: tone(status)[1] }]}>{count}</Text>
        </View>)}
      </View>
      {!data.tasks.length && <Text style={[s.body, { marginTop: 20, color: tokens.muted }]}>Ingen oppgaver er opprettet fra denne rapporten.</Text>}
      {data.tasks.map((task, index) => <View key={index} style={{ marginTop: 26 }}>
        <View wrap={false} minPresenceAhead={120}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1.2, borderTopColor: tokens.ink, paddingTop: 10 }}>
            <Text style={s.eyebrow}>Oppgave {index + 1} · {task.area}</Text>
            <Status value={task.status} />
          </View>
          <Text style={[s.h3, { fontSize: 14, marginTop: 6 }]}>{task.description}</Text>
          <Text style={[s.small, { marginTop: 3 }]}>{task.dueDate ? `Frist ${formatDate(task.dueDate)}` : "Ingen frist"} · Opprettet {stamp(task.createdAt)}</Text>
        </View>
        {task.photos.length > 0 && <PhotoGrid photos={task.photos} />}
        <Text style={[s.label, { marginTop: 14 }]}>Svar og fremdrift</Text>
        {!task.updates.length && <Text style={[s.small, { marginTop: 4 }]}>Ingen svar fra varehuset ennå.</Text>}
        {task.updates.map((update, updateIndex) => <View key={updateIndex} style={{ marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: tone(update.status)[1] }}>
          <View wrap={false}>
            <Text style={{ fontSize: 8.5, fontWeight: 600 }}>{update.author} · {stamp(update.createdAt)}{update.status ? ` · ${statusLabel[update.status] || update.status}` : ""}</Text>
            {update.comment ? <Text style={[s.body, { marginTop: 2 }]}>{update.comment}</Text> : null}
          </View>
          {update.photos.length > 0 && <PhotoGrid photos={update.photos} width={contentWidth - 12} />}
        </View>)}
      </View>)}
    </Page>
  </Document>;
}
