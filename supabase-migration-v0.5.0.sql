-- Migrasi v0.5.0: pisahkan tipe "diagram" menjadi "flowchart" dan "usecase"
-- Jalankan di Supabase SQL Editor.

alter table public.saved_items drop constraint if exists saved_items_type_check;

update public.saved_items
set type = case
  when content ~* '(^|\n)\s*(actor|usecase)\s' then 'usecase'
  else 'flowchart'
end
where type = 'diagram';

alter table public.saved_items
  add constraint saved_items_type_check
  check (type in ('flowchart', 'usecase', 'api-spec', 'json'));
