-- Three more Pin designs: spotlight, split, frame.
alter table public.creatives drop constraint if exists creatives_template_check;
alter table public.creatives add constraint creatives_template_check
  check (template in ('editorial','minimal','bold','spotlight','split','frame'));
