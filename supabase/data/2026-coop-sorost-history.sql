-- One-off import of Coop Sørøst's three concept check rounds in 2026, from the Excel overview.
-- Scores only (no comments or photos), stored exactly as the app stores a published concept check
-- so they count in history, "siden sist", the cooperative comparison and the round ranking.
-- The visit date is the first day of each round. Safe to rerun: it stops if the rounds exist.
do $$
declare
  v_coop uuid; v_user uuid; v_round uuid; v_report uuid; v_version uuid; v_store uuid;
  v_sum integer; v_at timestamptz; rnd record; score record;
  v_note constant text := 'Historisk import fra Excel-oversikten. Bare karakterer, uten tekst og bilder.';
begin
  select id into v_coop from public.cooperatives where name = 'Coop Sørøst';
  select id into v_user from auth.users where email = 'ole.kristiansen@coop.no';
  if v_coop is null or v_user is null then raise exception 'Fant ikke Coop Sørøst eller importbrukeren'; end if;
  if exists (select 1 from public.rounds where cooperative_id = v_coop and title in
    ('Konseptsjekk februar 2026', 'Konseptsjekk april 2026', 'Konseptsjekk august 2026'))
    then raise exception 'Rundene er allerede importert'; end if;

  for rnd in select * from (values
    (1, 'Konseptsjekk februar 2026', date '2026-02-24', date '2026-02-26'),
    (2, 'Konseptsjekk april 2026',   date '2026-04-08', date '2026-04-09'),
    (3, 'Konseptsjekk august 2026',  date '2026-08-18', date '2026-08-19')
  ) as r(seq, title, d_from, d_to) loop
    insert into public.rounds(cooperative_id, title, sequence_no, planned_from, planned_to, status, summary, created_by, created_at, closed_at)
      values (v_coop, rnd.title, rnd.seq, rnd.d_from, rnd.d_to, 'closed', v_note, v_user, rnd.d_from, rnd.d_to + time '18:00')
      returning id into v_round;
    v_at := rnd.d_from + time '12:00';

    -- Scores in quarter points (score × 4): Uteområde ("Utvendig"), Butikk, Drive-In, Varemottak.
    for score in select * from (values
      (1, 'Skien',      40, 36, 32, 36), (1, 'Tønsberg',   36, 32, 37, 39), (1, 'Sandefjord', 40, 38, 39, 39),
      (1, 'Mjøndalen',  40, 37, 37, 39), (1, 'Kongsberg',  38, 29, 32, 34),
      (2, 'Skien',      30, 35, 28, 36), (2, 'Tønsberg',   40, 35, 36, 36), (2, 'Sandefjord', 35, 35, 36, 36),
      (2, 'Mjøndalen',  38, 33, 37, 40), (2, 'Kongsberg',  33, 22, 31, 30),
      (3, 'Skien',      37, 35, 26, 29), (3, 'Tønsberg',   40, 38, 38, 38), (3, 'Sandefjord', 39, 38, 38, 39),
      (3, 'Mjøndalen',  35, 33, 37, 38), (3, 'Kongsberg',  32, 34, 32, 29)
    ) as s(seq, store, outdoor, store_q, drive_in, goods) where s.seq = rnd.seq loop
      select id into v_store from public.stores where cooperative_id = v_coop and name = 'Obs Bygg ' || score.store;
      if v_store is null then raise exception 'Fant ikke Obs Bygg %', score.store; end if;
      insert into public.round_stores(round_id, cooperative_id, store_id, planned_visit) values (v_round, v_coop, v_store, rnd.d_from);
      insert into public.reports(cooperative_id, store_id, round_id, kind, created_by, created_at)
        values (v_coop, v_store, v_round, 'inspection', v_user, v_at) returning id into v_report;
      insert into public.report_versions(report_id, version_no, state, visit_date, summary, assessor_id, lock_version, created_at, updated_at, published_at, published_by)
        values (v_report, 1, 'published', rnd.d_from, v_note, v_user, 2, v_at, v_at, v_at, v_user) returning id into v_version;
      insert into public.area_assessments(version_id, area_key, score_quarters) values
        (v_version, 'outdoor', score.outdoor), (v_version, 'store', score.store_q),
        (v_version, 'drive_in', score.drive_in), (v_version, 'goods_receiving', score.goods);
      v_sum := score.outdoor + score.store_q + score.drive_in + score.goods;
      -- Same snapshot shape as publish_report, with the assessor shown as the import.
      insert into public.publication_snapshots(version_id, schema_version, content, total_quarters_sum, created_at)
        select v_version, 3, jsonb_build_object('schema_version', 3, 'calculation', 'equal_weight_quarters_v1',
          'report_id', v_report, 'version_id', v_version, 'version_no', 1, 'kind', 'inspection',
          'cooperative_name', 'Coop Sørøst', 'store_name', 'Obs Bygg ' || score.store, 'round_title', rnd.title,
          'visit_date', rnd.d_from, 'assessor_name', 'Historisk import', 'summary', v_note,
          'total', v_sum::numeric / 16,
          'areas', (select jsonb_agg(jsonb_build_object('key', a.area_key, 'score_quarters', a.score_quarters,
            'comment', '', 'needs_follow_up', false, 'images', '[]'::jsonb) order by a.area_key)
            from public.area_assessments a where a.version_id = v_version)), v_sum, v_at;
      update public.reports set current_version_id = v_version where id = v_report;
      insert into public.exports(version_id, requested_by, kind) values (v_version, v_user, 'report_pdf');
    end loop;
  end loop;
end $$;

-- Check: per-store totals should match the Excel overview (e.g. Tønsberg 9,00 / 9,19 / 9,63).
select ro.title, st.name, round(ps.total_quarters_sum::numeric / 16, 4) as total
from public.rounds ro
join public.reports re on re.round_id = ro.id
join public.stores st on st.id = re.store_id
join public.publication_snapshots ps on ps.version_id = re.current_version_id
where ro.title like 'Konseptsjekk % 2026'
order by ro.sequence_no, st.name;
