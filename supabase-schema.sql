-- ContaAI Supabase Schema
-- Run this in the Supabase SQL editor of a new project

create table documents (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  context        text default 'business' check (context in ('business','personal')),
  datum          date,
  typ            text check (typ in ('AUS','EIN','BEH','BEL','expense','income','transfer')) default 'EIN',
  vendor         text,
  betrag         numeric(12,2),
  mwst           numeric(5,2),
  netto          numeric(12,2),
  irpf           numeric(5,2) default 0,
  kategorie      text,
  projekt        text,
  status         text default 'offen' check (status in ('offen','bezahlt','gebucht')),
  quartal        text,
  year           int,
  filename       text,
  storage_path   text,
  storage_url    text,
  notizen        text,
  extraction_raw jsonb,
  drive_file_id  text
);

create index on documents(context);
create unique index on documents(drive_file_id) where drive_file_id is not null;
create index on documents(year, quartal);
create index on documents(typ);
create index on documents(status);

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role       text check (role in ('user','assistant')) not null,
  content    text not null,
  metadata   jsonb
);

-- Disable RLS for MVP (single-user demo)
-- Enable and add policies when adding authentication
alter table documents disable row level security;
alter table chat_messages disable row level security;

-- Storage bucket: run in Supabase dashboard or via CLI
-- Create bucket named "invoices" with public access enabled
