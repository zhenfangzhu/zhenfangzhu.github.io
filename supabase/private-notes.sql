create table if not exists public.private_notes (
    id uuid primary key default gen_random_uuid(),
    ciphertext text not null,
    iv text not null,
    salt text not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    constraint private_notes_ciphertext_length check (
        char_length(ciphertext) between 16 and 50000
    ),
    constraint private_notes_iv_length check (
        char_length(iv) between 12 and 64
    ),
    constraint private_notes_salt_length check (
        char_length(salt) between 16 and 64
    )
);

alter table public.private_notes enable row level security;

revoke all on table public.private_notes from public, anon, authenticated;

create or replace function public.create_private_note(
    p_ciphertext text,
    p_iv text,
    p_salt text,
    p_ttl_days integer default 7
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
begin
    if p_ttl_days not in (1, 7, 30) then
        raise exception 'Invalid expiry';
    end if;

    if char_length(p_ciphertext) not between 16 and 50000
        or char_length(p_iv) not between 12 and 64
        or char_length(p_salt) not between 16 and 64 then
        raise exception 'Invalid encrypted payload';
    end if;

    delete from public.private_notes
    where expires_at <= now();

    insert into public.private_notes (
        ciphertext,
        iv,
        salt,
        expires_at
    )
    values (
        p_ciphertext,
        p_iv,
        p_salt,
        now() + make_interval(days => p_ttl_days)
    )
    returning id into v_id;

    return v_id;
end;
$$;

create or replace function public.read_private_note(p_note_id uuid)
returns table (
    ciphertext text,
    iv text,
    salt text,
    expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        private_notes.ciphertext,
        private_notes.iv,
        private_notes.salt,
        private_notes.expires_at
    from public.private_notes
    where private_notes.id = p_note_id
      and private_notes.expires_at > now()
    limit 1;
$$;

revoke all on function public.create_private_note(text, text, text, integer) from public;
revoke all on function public.read_private_note(uuid) from public;

grant execute on function public.create_private_note(text, text, text, integer)
to anon, authenticated;

grant execute on function public.read_private_note(uuid)
to anon, authenticated;
