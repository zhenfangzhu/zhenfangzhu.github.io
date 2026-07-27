create table if not exists public.public_boards (
    id text primary key,
    content text not null default '',
    updated_at timestamptz not null default now(),
    constraint public_boards_id_format check (id ~ '^[a-z0-9-]{1,40}$'),
    constraint public_boards_content_length check (char_length(content) <= 20000)
);

create or replace function public.set_public_board_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_public_board_updated_at on public.public_boards;
create trigger set_public_board_updated_at
before update on public.public_boards
for each row
execute function public.set_public_board_updated_at();

alter table public.public_boards enable row level security;

drop policy if exists "Anyone can read the public board" on public.public_boards;
create policy "Anyone can read the public board"
on public.public_boards
for select
to anon, authenticated
using (id = 'public');

drop policy if exists "Anyone can update the public board" on public.public_boards;
create policy "Anyone can update the public board"
on public.public_boards
for update
to anon, authenticated
using (id = 'public')
with check (id = 'public' and char_length(content) <= 20000);

insert into public.public_boards (id, content)
values ('public', '欢迎来到公开白板。

这里的内容会自动保存，并同步给所有打开此页面的人。')
on conflict (id) do nothing;

alter publication supabase_realtime add table public.public_boards;
