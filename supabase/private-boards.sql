create table if not exists public.private_boards (
    room_id text primary key,
    ciphertext text not null,
    iv text not null,
    salt text not null,
    updated_at timestamptz not null default now(),
    expires_at timestamptz not null,
    constraint private_boards_room_id_format check (
        room_id ~ '^[0-9a-f]{64}$'
    ),
    constraint private_boards_ciphertext_length check (
        char_length(ciphertext) between 16 and 50000
    ),
    constraint private_boards_iv_length check (
        char_length(iv) between 12 and 64
    ),
    constraint private_boards_salt_length check (
        char_length(salt) between 16 and 64
    )
);

alter table public.private_boards enable row level security;

revoke all on table public.private_boards from public, anon, authenticated;

create or replace function public.read_private_board(p_room_id text)
returns table (
    ciphertext text,
    iv text,
    salt text,
    updated_at timestamptz,
    expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        private_boards.ciphertext,
        private_boards.iv,
        private_boards.salt,
        private_boards.updated_at,
        private_boards.expires_at
    from public.private_boards
    where private_boards.room_id = p_room_id
      and p_room_id ~ '^[0-9a-f]{64}$'
      and private_boards.expires_at > now()
    limit 1;
$$;

create or replace function public.save_private_board(
    p_room_id text,
    p_ciphertext text,
    p_iv text,
    p_salt text,
    p_ttl_days integer default 30
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_expires_at timestamptz;
begin
    if p_room_id !~ '^[0-9a-f]{64}$' then
        raise exception 'Invalid room id';
    end if;

    if p_ttl_days not in (1, 7, 30) then
        raise exception 'Invalid expiry';
    end if;

    if char_length(p_ciphertext) not between 16 and 50000
        or char_length(p_iv) not between 12 and 64
        or char_length(p_salt) not between 16 and 64 then
        raise exception 'Invalid encrypted payload';
    end if;

    delete from public.private_boards
    where expires_at <= now();

    v_expires_at := now() + make_interval(days => p_ttl_days);

    insert into public.private_boards (
        room_id,
        ciphertext,
        iv,
        salt,
        updated_at,
        expires_at
    )
    values (
        p_room_id,
        p_ciphertext,
        p_iv,
        p_salt,
        now(),
        v_expires_at
    )
    on conflict (room_id) do update
    set
        ciphertext = excluded.ciphertext,
        iv = excluded.iv,
        salt = excluded.salt,
        updated_at = now(),
        expires_at = v_expires_at;

    return v_expires_at;
end;
$$;

revoke all on function public.read_private_board(text) from public;
revoke all on function public.save_private_board(text, text, text, text, integer) from public;

grant execute on function public.read_private_board(text)
to anon, authenticated;

grant execute on function public.save_private_board(text, text, text, text, integer)
to anon, authenticated;
