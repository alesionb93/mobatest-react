-- ============================================================
-- Retestes: histórico de tentativas por caso dentro de uma execução
-- ============================================================
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
--
-- Contexto: hoje, marcar um caso de novo dentro da mesma execução apaga o
-- resultado anterior (status/comentário/log) sem deixar rastro. Isso guarda
-- cada tentativa anterior antes dela ser sobrescrita, e conta quantas vezes
-- o caso foi retestado.

-- Contador de retestes, pra mostrar "Passou +1", "Passou +2" etc ao lado do
-- status atual, sem precisar consultar o histórico toda vez.
alter table test_run_cases add column if not exists retest_count integer not null default 0;

-- Cada linha aqui é uma tentativa que JÁ FOI SOBRESCRITA (a tentativa atual
-- continua vivendo só em test_run_cases, sem duplicar) — pra reconstruir a
-- sequência completa (ex: Bloqueado → Falhou → Passou), a tela junta as
-- linhas daqui com o estado atual de test_run_cases.
create table if not exists test_run_case_attempts (
  id uuid primary key default uuid_generate_v4(),
  test_run_case_id uuid not null references test_run_cases(id) on delete cascade,
  attempt_number integer not null,
  status text not null check (status in ('untested','passed','failed','blocked','skipped','pre_existing')),
  comment text,
  duration_seconds integer,
  executed_by uuid references auth.users(id),
  executed_at timestamptz,
  source text not null default 'manual' check (source in ('manual','automated')),
  created_at timestamptz not null default now()
);

create index if not exists idx_trca_run_case on test_run_case_attempts(test_run_case_id);

-- Mesmo padrão de segurança usado em test_run_cases: acesso liberado só pra
-- quem é membro do projeto ao qual essa execução pertence (via
-- test_run_case_id → test_run_cases → test_runs → project_members).
alter table test_run_case_attempts enable row level security;

create policy "run_case_attempts: all se membro" on test_run_case_attempts for all using (
  exists (
    select 1
    from test_run_cases rc
    join test_runs r on r.id = rc.test_run_id
    where rc.id = test_run_case_id and is_project_member(r.project_id)
  )
) with check (
  exists (
    select 1
    from test_run_cases rc
    join test_runs r on r.id = rc.test_run_id
    where rc.id = test_run_case_id and is_project_member(r.project_id)
  )
);
