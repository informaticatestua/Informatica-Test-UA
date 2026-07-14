-- Elimina por completo la funcionalidad de contribuciones (sin uso: 0 contribuciones en producción).

drop function if exists accept_contribution(uuid);
drop function if exists reject_contribution(uuid, text);

drop table if exists contribution_options cascade;
drop table if exists contributions cascade;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
    check (type = any (array['report_accepted'::text, 'report_rejected'::text, 'announcement'::text]));
