-- Elimina por completo la funcionalidad de foro (sin uso: 0 hilos, 0 posts en producción).

drop function if exists toggle_forum_vote(uuid, uuid);
drop function if exists toggle_forum_vote(uuid);
drop function if exists create_forum_thread(text, text, text);
drop function if exists handle_forum_post_change() cascade;
drop function if exists forum_post_lock_guard() cascade;
drop function if exists on_forum_post_inserted() cascade;

drop table if exists forum_votes cascade;
drop table if exists forum_posts cascade;
drop table if exists forum_threads cascade;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
    check (type = any (array['report_accepted'::text, 'report_rejected'::text, 'contribution_accepted'::text, 'contribution_rejected'::text, 'announcement'::text]));
