-- ============================================================
-- Falhas automatizadas: registro separado de "defeito"
-- ============================================================
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
--
-- Contexto: hoje, quando um teste automatizado falha, o Mobatest abre
-- direto o formulário de criar defeito — mas nem toda falha automatizada
-- é um bug de verdade (pode ser teste mal escrito, flaky, app lento, etc).
-- Essa tabela guarda a falha "crua" (log + print + duração), pra alguém
-- revisar depois com calma e decidir: vira defeito, é flaky, ou só precisa
-- rodar de novo.

create table if not exists automated_failures (
  id uuid primary key default uuid_generate_v4(),
  test_run_case_id uuid not null references test_run_cases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  test_case_title text not null,
  occurred_at timestamptz not null default now(),
  duration_seconds integer,
  output text,
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'flaky', 'promoted', 'ignored')),
  defect_id uuid references defects(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_automated_failures_run_case on automated_failures(test_run_case_id);
create index if not exists idx_automated_failures_project on automated_failures(project_id);

-- Mesmo padrão de segurança usado em "defects" (mesma tabela, mesma coluna
-- project_id) — acesso liberado só pra quem é membro do projeto.
alter table automated_failures enable row level security;

create policy "automated_failures: all se membro" on automated_failures for all using (
  is_project_member(project_id)
) with check (
  is_project_member(project_id)
);
