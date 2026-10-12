-- Development-only test accounts (email + password) so authenticated flows can be
-- exercised before SMS is configured. They sign in through /#/login?dev=1, which only
-- exists in local development builds. Delete these rows before public launch:
--   delete from auth.users where email like '%@test.local';
--
-- Credentials (dev only):
--   tester1@test.local / Xafsh-test-1
--   tester2@test.local / Xafsh-test-2
--
-- The owner's real accounts (phone login) also got a dev email+password on 2026-10-12 so they can
-- be used from /#/login?dev=1 before SMS / Test OTPs are configured. Remove before public launch:
--   admin@x3afsh.local  / Admin-2026!    → +201120492320 (صاحب المنصة، لوحة التحكم)
--   client@x3afsh.local / Client-2026!   → +201017742635 (عميل تجريبي)

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'tester1@test.local', extensions.crypt('Xafsh-test-1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"أحمد (تجريبي)"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'tester2@test.local', extensions.crypt('Xafsh-test-2', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"سارة (تجريبي)"}', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'email',
   '{"sub":"00000000-0000-4000-8000-0000000000a1","email":"tester1@test.local","email_verified":true}', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a2', 'email',
   '{"sub":"00000000-0000-4000-8000-0000000000a2","email":"tester2@test.local","email_verified":true}', now(), now(), now())
on conflict do nothing;

-- GoTrue fails with "Database error querying schema" when these token columns are NULL
update auth.users set confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = '',
  email_change_token_current = '', phone_change = '', phone_change_token = '', reauthentication_token = ''
where email like '%@test.local';

update public.profiles set phone = '+201011111111', governorate_id = 1 where id = '00000000-0000-4000-8000-0000000000a1';
update public.profiles set phone = '+201022222222', governorate_id = 2 where id = '00000000-0000-4000-8000-0000000000a2';
