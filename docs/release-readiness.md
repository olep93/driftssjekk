# Status før pilot og lansering

Oppdatert 7. oktober 2026. Løsningen på `driftssjekk.vercel.app` er en prøvbar demo med fiktive vurderinger. Den separate `/demo`-visningen lagrer ingenting. Den innloggede demoen har database, roller og rapportflyt, men er ikke satt opp for ordinær drift.

## Kan prøves nå

- Oversikt, konseptsjekkrunder, varehus, rapporter, kriterier, oppfølging og administrasjon kan utforskes med demodata.
- Den åpne prøvevurderingen viser karakterberegning uten å lagre endringer.
- Innlogging, publisering, tilgangstester mot demodatabasen og nedlasting av rapport-PDF er verifisert i demomiljøet. PowerPoint-eksporten er implementert og kontrollert som fil, men må også prøves med innlogget bruker på Vercel.
- Testkontoen `ole.kristiansen@coop.no` er knyttet til Tønsberg og har administrasjons- og driftsrolle i begge nåværende testsamvirkelag. En testkladd og en publisert fiktiv rapport uten rundetilknytning er opprettet.
- Typografi, felter og prøvevurdering er kontrollert på PC og smal mobilvisning.

## Før en pilot med faktiske Coop-brukere

1. Avklar hvilke samvirkelag og varehus som skal være med. Excel-oversikten som er lagt i prosjektmappen inneholder 66 Obs BYGG-rader fordelt på 16 samvirkelag. Kontroller navn, identifikatorer og raden `X Obs Bygg Larvik` før import. Ikke bland virkelige varehus med fiktive vurderinger.
2. Avklar og opprett brukere med eksplisitt rolle og tilgang. Appen har samvirkelagsadministrator, driftssjef og varehussjef; den har ingen egen global systemadministratorrolle. Nye samvirkelag gir ikke automatisk tilgang til eksisterende administratorer.
3. Konfigurer produksjonsegnet SMTP i Supabase Auth og verifiser invitasjon og passordgjenoppretting. Dagens demoprosjekt sender ikke vanlige invitasjoner til vilkårlige adresser. Varsler ved publisering krever dessuten egen e-postleverandør og avsenderdomene.
4. Skill pilotens Supabase-prosjekt og Vercel-miljø fra demodata. Gå gjennom redirect-URL-er, hemmeligheter, åpne registreringer og filtilgang før brukerne inviteres.
5. Kjør en ende-til-ende-prøve med representative roller: opprett kladd, last opp bilder, publiser, les som varehussjef, korriger, last ned PDF og trekk tilbake tilgang. Test på faktiske iPhone- og Android-enheter og ved ustabilt nett.

## Før ordinær lansering

- Kvalitetssikre transkripsjonen av originalkriteriene og avklare månedlige driftskriterier, visuell profil og eventuelle offisielle merkevareelementer.
- Avklar databehandleravtaler, europeisk datalagring, oppbevaring/sletting og kostnadsplan. Sett opp backup av både database og Storage, og gjennomfør en gjenopprettingstest.
- Verifiser bakgrunnsjobber og varselutsending på valgt Vercel-plan. `vercel.json` ber om jobb hvert tiende minutt; dette må passe plan og driftsoppsett. Kontroller feilhåndtering og varsler ved jobbfeil.
- Gjennomfør brukerakseptanse, tilgjengelighetskontroll, ytelsestest med faktisk datamengde og sikkerhetsgjennomgang av roller, RLS, API og private filer.
- Ta stilling til kjente begrensninger: HEIC/HEIF støttes ikke direkte, bildeopplasting har ingen egen miniatyrfil, PDF erstatter foreløpig enkelte Unicode-tegn, og arkiverte PDF-jobber for runde-/periodeoppsummering og store samleeksporter er ikke ferdige.

Ingen av disse punktene hindrer en demonstrasjon med fiktive data. Pilot med virkelige ansatte og varehus bør starte først når de fem pilotpunktene er gjennomført.
