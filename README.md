# Driftssjekk

Intern webapp for uanmeldte konseptsjekker og månedlige driftsgjennomganger i varehus. Grensesnittet er på norsk bokmål. Koden bruker Next.js 16, Supabase Auth/Postgres/Storage og en privat jobbkjø for PDF og e-post. Den fiktive testløsningen på [driftssjekk.vercel.app](https://driftssjekk.vercel.app) krever innlogging. Dette er **ikke produksjonsbruk**. Tidligere lenker til `/demo` sender besøkende til innlogging eller oversikten. Se [status før pilot og lansering](docs/release-readiness.md).

## Kort om løsningen

- Fire områder: Drive-In, Butikk, Uteområde og Varemottak. Hvert område får 1,00–10,00 i kvartsteg. Totalen er summen av `score_quarters` delt på 16. Bare visningen avrundes.
- Uanmeldte konseptsjekker får karakter. Månedlig driftsgjennomgang lagrer observasjoner og bilder uten konseptkarakter. Bare publiserte konseptsjekker i en runde inngår i rangering.
- Roller er eksplisitte per samvirkelag eller varehus. E-postdomene gir ingen tilgang. Publiserte versjoner og øyeblikksbilder er uforanderlige.
- Databasen håndhever rettigheter og sentrale overganger via RLS og `SECURITY DEFINER`-funksjoner. Frontend og API er ikke eneste tilgangssperre.
- Bilder lagres i privat Storage. Nettleseren reduserer bildestørrelse og koder om til JPEG før direkte opplasting. Dette fjerner vanlig EXIF fra lagret visningsfil. HEIC/HEIF støttes ikke i første versjon.
- PDF og e-post legges i jobbkø ved publisering. Autoriserte lesere kan også lage PowerPoint fra en publisert rapport.

Vurderingskriteriene er transkribert fra originalmalen som ble levert 7. oktober 2026. Karakter 6 er konsept, under 6 er under konsept, og over 6 er over konsept. Kriteriene finnes på egen side og som vedlegg i konseptsjekkrapporter. Tekstene bør kvalitetssikres mot originaldokumentet før reell bruk. Ingen offisiell logo er brukt.

## Lokal oppstart

1. Bruk Node 20 eller nyere og pnpm. Kjør `pnpm install`.
2. Opprett et **eget utviklingsprosjekt** i Supabase, helst i europeisk region. Kopier `.env.example` til `.env.local` og fyll inn URL, publishable key og secret key. Secret key skal aldri eksponeres i klientkode eller commits.
3. Kjør SQL-filene i `supabase/migrations/` i nummerrekkefølge mot prosjektet, for eksempel med Supabase CLI `supabase db push` etter at prosjektet er koblet til. Migrasjonene oppretter også private Storage-buckets.
4. Slå av åpen registrering i Supabase Auth. Sett opp e-post/passord, SMTP for invitasjoner og passordgjenoppretting, og tillatte redirect-URL-er for `/auth/callback`.
5. Opprett første administrator kontrollert: legg først inn samvirkelaget i SQL Editor med `insert into public.cooperatives(name) values ('Samvirkelagets navn') returning id;`. Opprett deretter brukeren i Supabase Auth, finn UUID-en, og kjør følgende i SQL Editor. Erstatt plassholderne med faktiske verdier:

   ```sql
   insert into public.profiles(id, display_name) values ('<auth-user-uuid>', 'Navn');
   insert into public.memberships(user_id, cooperative_id, store_id, role)
     values ('<auth-user-uuid>', '<cooperative-uuid>', null, 'cooperative_admin');
   ```

   Driftssjefrollen legges inn separat på samme måte med `role = 'operations'`. Ikke gi nasjonal tilgang som standard.
6. Kjør `pnpm dev` og åpne `http://localhost:3000`.

`NEXT_PUBLIC_SITE_URL` må peke på riktig miljø for lenker i varsler. Preview og produksjon skal ha egne Supabase-prosjekter, nøkler og SMTP-oppsett.

## Fiktive demodata og tilgangstest

Etter migrering kan fiktive demodata legges inn mot lokal Supabase. For et eget eksternt demoprosjekt kreves både eksakt prosjekt-ID i `DEMO_REMOTE_PROJECT_REF` og `DEMO_REMOTE_CONFIRM=driftssjekk-demo:<prosjekt-ID>`. Skriptet avviser andre verter og databaser som allerede inneholder samvirkelag. Sett `DEMO_PASSWORD` til et midlertidig passord på minst 12 tegn og kjør:

```bash
node --env-file=.env.local scripts/seed-demo.mjs
node --env-file=.env.local scripts/check-rls.mjs
```

Skriptene oppretter fiktive vurderinger for Coop Sørøst og Tønsberg, Mjøndalen, Skien, Sandefjord og Kongsberg, tre runder, en korrigering, en kladd, en ufullstendig runde, et arkivert demovarehus og et ekstra fiktivt samvirkelag. Demobrukere har adresser under `demo.invalid`. Ikke bruk disse dataene som faktiske vurderinger. `check-rls.mjs` prøver direkte lesing/skriving, skjult kladd i Storage og tilgang etter rolletilbaketrekking. Denne testen er ikke kjørt mot et ekte Supabase-prosjekt ennå.

## Jobbkø, PDF og varsler

`/api/jobs/run` krever `Authorization: Bearer <CRON_SECRET>`. `vercel.json` kjører jobben hvert tiende minutt i produksjon. [Vercel Hobby tillater bare daglig cron](https://vercel.com/docs/cron-jobs/usage-and-pricing); denne frekvensen krever Pro eller en annen sikker jobbkjører. Vercel cron kjører ikke automatisk for preview.

Jobben lager PDF fra `publication_snapshots` og lagrer den i privat `report-exports`. PowerPoint kan lages ved behov fra samme publiserte øyeblikksbilde og lagres i den samme private bøtten. Autoriserte brukere får en signert lenke som varer i fem minutter. PDF som allerede er lastet ned kan ikke tilbakekalles. Varsler sendes med Resend hvis `RESEND_API_KEY` og `NOTIFICATION_FROM` er satt. Oppsett av Auth-e-post gjøres separat i Supabase SMTP. Varseltekst inneholder bare varehus, eventuell runde og innloggingslenke. [Resends idempotensnøkkel varer i 24 timer](https://resend.com/changelog/idempotency-keys); automatisk gjentakelse av varsler begrenses derfor til 23 timer etter opprettelse. Eldre feil må gjennomgås manuelt for å unngå mulig dobbeltutsending.

## Verifisering

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

SQL-migrasjonene kan syntakssjekkes med PostgreSQL-parser, men må også kjøres mot en ekte Supabase-instans. PDF-testen dekker flersidig A4, lange kommentarer, norske tegn og månedlig rapport uten karakter. PowerPoint-testen kontrollerer en åpnebar presentasjon med kriterier. Bruk `PDF_VISUAL_QA=1 pnpm test` for å skrive en midlertidig QA-PDF under `tmp/pdfs/`; den er ikke et publisert rapportarkiv.

Sist kontrollert 7. oktober 2026: typekontroll, lint og produksjonsbygg besto. Migrasjoner er kjørt i et eget Supabase-demoprosjekt med fiktive data, og RLS-tilgangstestene er kjørt der. Innlogging og rapport-PDF er prøvd mot Vercel-demoen. Dette bekrefter demomiljøet, ikke et ferdig produksjonsoppsett.

## Produksjonsavklaringer og kjente begrensninger

- Demoprosjektet bruker kun fiktive vurderinger. Oppsettet for virkelige brukere, varehus, invitasjoner, jobbkjø og e-post må testes samlet i et eget produksjonsmiljø.
- Runde- og perioderapporter har nettsidegrunnlag og utskrift / «Lagre som PDF» i nettleseren, men egne arkiverte PDF-jobber for disse nivåene og store samleeksporter er ikke ferdigstilt.
- Dashboard viser rundesnitt, rangering, områdematrise, dekning og tiltak. Mer avanserte diagrammer, tidsfilter og områdeanalyse kan bygges videre på de lagrede versjonene.
- Store antall rapporter krever videre arbeid med databasepaginering og ytelse; gjeldende oversiktslaster henter inntil 500 rapporter.
- Bildeflyten lager ikke en egen miniatyrfil. Kameraflyt, bildeorientering og ustabilt nett må testes på faktiske iPhone- og Android-enheter.
- PDF-koden bruker innebygd Helvetica. Norske bokstaver er testet; øvrige Unicode-tegn erstattes foreløpig med `?` i PDF. For produksjon bør en Unicode-font bygges inn.
- Automatisk rydding av foreldreløse opplastinger, gjenopprettingsrutine for bildefiler og formelle, versjonerte rundeoppsummeringer gjenstår.
- Vurder leverandøravtaler, kostnader, europeisk datalagring, oppbevaringsregler og backup av **både database og Storage**. Test en full gjenoppretting før produksjon. Databasebackup alene er ikke backup av bilder.

## Teknisk dokumentasjon

Oppsettet følger [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage-buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) og [Vercel Functions](https://vercel.com/docs/functions/limitations). Kontroller leverandørdokumentasjonen på nytt ved produksjonssetting.
