# Status før pilot og lansering

Oppdatert 8. oktober 2026.

## Klart for kontrollert prøve

- `driftssjekk.vercel.app` er bak innlogging. Åpen prøvedemo og fiktive testkontoer, rapporter og runder er fjernet.
- 65 aktive Obs Bygg-varehus i 16 samvirkelag er lagt inn. Coop Sørøst har fem varehus. Den utelatte Larvik-raden var markert med `X` i Excel-filen.
- `ole.kristiansen@coop.no` er systemadministrator med tilgang til samvirkelagene, og er varehussjef for Obs Bygg Tønsberg. Kontoen kan lage både uanmeldt konseptsjekk og månedlig driftsgjennomgang i Tønsberg. Systemadministrator kan slette testene etterpå.
- Driftssjefer kan tildeles alle eller valgte varehus i et samvirkelag. Oppgaver fra publiserte rapporter vises for tilhørende varehus, som kan svare med tekst, status og bilde.
- PDF og PowerPoint er kontrollert med både stående og liggende testbilder. Kriteriene er komprimert til et vedlegg i konseptsjekkeksportene.
- Supabase-databasen ligger i Stockholm. Vercel-funksjoner er konfigurert for Stockholm (`arn1`); produksjonsdistribusjonen må verifiseres etter publisering.

## Før bredere bruk

1. Gjennomfør en ekte test i Tønsberg med bilder fra mobil: kladd, publisering, oppgave, svar, PDF, PowerPoint og sletting. Kontroller resultatet på iPhone og Android, også ved svak dekning.
2. Sett opp SMTP for Supabase Auth, e-post for publiseringsvarsler og en trygg prosess for passordgjenoppretting. Nå setter administrator et midlertidig passord manuelt, og `/onsker-tilgang` åpner brukerens e-postprogram uten å lagre en sak.
3. Verifiser cron-jobben og Vercel-planen. Jobben er konfigurert hvert tiende minutt; frekvensen må støttes av valgt plan eller en egen jobbkjører.
4. Kontroller RLS og tilordning med representative driftssjef- og varehussjefkontoer, særlig driftssjefer med utvalgte varehus.
5. Avklar databehandleravtaler, lagringstid og sikkerhetskopi for både database og bilder. Test gjenoppretting før ordinær lansering.
6. Kvalitetssikre teksten i vurderingskriteriene mot originaldokumentet. Avklar offisiell visuell profil og eventuelle merkevareelementer.

Store samleeksporter som egen nedlastbar fil, automatiske miniatyrbilder og full Unicode-støtte i PDF er ikke ferdigstilt. Nåværende rapportoversikter henter inntil 500 rapporter og bør pagineres i databasen når datamengden vokser.
