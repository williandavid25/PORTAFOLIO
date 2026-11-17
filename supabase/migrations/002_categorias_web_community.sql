-- Nuevas categorías para trabajos de desarrollo web y community manager.
alter table public.pf_projects drop constraint if exists pf_projects_category_check;
alter table public.pf_projects drop constraint if exists projects_category_check;
alter table public.pf_projects add constraint pf_projects_category_check
  check (category in ('social','commercial','corporate','music','youtube','motion','web','community'));
