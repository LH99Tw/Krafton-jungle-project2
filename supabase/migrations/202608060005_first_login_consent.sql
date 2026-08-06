alter table public.users
  add column if not exists third_party_consent boolean,
  add column if not exists third_party_consent_decided_at timestamptz;

comment on column public.users.third_party_consent is 'Optional third-party data consent. NULL until the first-login decision is made.';
comment on column public.users.third_party_consent_decided_at is 'When the user completed the first-login consent prompt.';
