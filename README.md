# Driftssjekk

Intern webapp for Obs Bygg. Løsningen har uanmeldte konseptsjekker, månedlige driftsgjennomganger, oppgaver til varehus og rapporter i PDF og PowerPoint. [Åpne innloggingen](https://driftssjekk.vercel.app/login).

## Slik fungerer det

- Begge rapporttyper får karakter 1–10 for Drive-In, Butikk, Uteområde og Varemottak. Karakter 6 er konsept. Bare uanmeldte konseptsjekker teller i konseptrangeringen; månedlige karakterer viser intern progresjon.
- Vurderinger kan lagres som kladd, suppleres med bilder per område og publiseres. Publiserte versjoner er låst; korrigeringer får en ny versjon.
- Driftssjefen kan gi en oppgave fra hvert område i en publisert rapport, med tekst, frist og et opplastet bilde eller et bilde fra rapporten. Varehuset ser oppgaven under **Oppfølging** og kan svare, endre status og laste opp bilde av løsningen.
- Administrator velger samvirkelag, rolle og varehustilgang. Driftssjef kan ha hele samvirkelaget eller utvalgte varehus. Systemadministrator kan slette testrapporter og tomme runder, og tilbakestille brukerpassord med et midlertidig passord. Brukeren må velge eget passord ved neste innlogging.
- Dataene har RLS i Supabase. Filer ligger i private Storage-bøtter, og vises med kortvarige signerte lenker.
- Vurderingskriteriene er transkribert fra originalmalen datert 7. oktober 2026. De finnes på egen side og i konseptsjekkrapporten.

## Varehusregister

`src/data/obs-bygg-catalog.json` inneholder 65 aktive Obs Bygg-varehus i 16 samvirkelag, hentet fra Excel-oversikten. Raden `X Obs Bygg Larvik` er utelatt. De fem varehusene i Coop Sørøst er Mjøndalen, Kongsberg, Sandefjord, Tønsberg og Skien. `scripts/import-obs-bygg.mjs` importerer registeret idempotent og er tilpasset den eksisterende systemadministratorkontoen i dette prosjektet.

## Lokal oppstart

1. Installer Node 20+ og pnpm. Kjør `pnpm install`.
2. Kopier `.env.example` til `.env.local` og sett Supabase URL, publishable key og serverens secret key. Secret key må aldri sendes til nettleseren eller Git.
3. Kjør migrasjonene i `supabase/migrations/` i nummerrekkefølge mot et eget Supabase-prosjekt. De oppretter også private bildebøtter.
4. Sett opp Supabase Auth med e-post/passord, tillatte callback-URL-er og lukket registrering.
5. Kjør `pnpm dev`.

`NEXT_PUBLIC_SITE_URL` skal peke på gjeldende miljø. Produksjon og preview bør ha hver sin database og nøkler.

## Eksporter og varsler

PDF og PowerPoint bygges fra publiserte øyeblikksbilder. Eksportene håndterer liggende JPEG og stående WebP/PNG uten å beskjære motivet. Kriteriene ligger kompakt i slutten av konseptsjekkrapporten. Oppgavebilder følger foreløpig oppgavevisningen, ikke eksportfilen.

`/api/jobs/run` krever `Authorization: Bearer <CRON_SECRET>`. Vercel-oppsettet ber om kjøring hvert tiende minutt; dette krever en plan eller jobbkjører som støtter frekvensen. Publiseringsvarsler krever `RESEND_API_KEY` og `NOTIFICATION_FROM`. Brukeropprettelse og passordtilbakestilling fungerer uten SMTP: administrator setter et midlertidig passord og deler det direkte med brukeren gjennom en avtalt, trygg kanal. Brukeren må deretter velge eget passord. SMTP trengs først hvis automatiske e-poster ønskes.

## Verifisering

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Testene dekker skåring, rapporttyper, kriterievedlegg og stående/liggende bilder i PDF og PowerPoint. `PDF_VISUAL_QA=1 PPTX_VISUAL_QA=1 pnpm test` skriver kontrollfiler under `tmp/`.

Se [status før lansering](docs/release-readiness.md) for gjenværende arbeid.
