-- Nueva categoría para videos de asesores inmobiliarios (recorridos, reels de captación, anuncios).
alter table public.pf_projects drop constraint if exists pf_projects_category_check;
alter table public.pf_projects add constraint pf_projects_category_check
  check (category in ('social','commercial','corporate','music','youtube','motion','web','community','realestate'));
