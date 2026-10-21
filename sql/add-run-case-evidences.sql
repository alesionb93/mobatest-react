-- ============================================================
-- Evidências (foto/vídeo) anexadas a um caso DENTRO de uma execução
-- ============================================================
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
--
-- Contexto: hoje só dá pra anexar foto/vídeo a um DEFEITO. Esta tabela
-- permite anexar evidência direto no caso da execução, tanto antes de
-- marcar o resultado quanto depois (a linha de test_run_cases existe desde
-- que a execução é criada, então sempre há onde pendurar a evidência).
--
-- O arquivo em si vive no Storage (bucket "evidence", o mesmo dos anexos de
-- defeito); aqui fica só o registro. A tela comprime foto e vídeo ANTES de
-- subir — file_size é o tamanho já comprimido e original_size o de antes,
-- só pra mostrar quanto espaço foi economizado.

create table if not exists run_case_evidences (
  id uuid primary key default uuid_generate_v4(),
  test_run_case_id uuid not null references test_run_cases(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  original_size bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_run_case_evidences_run_case on run_case_evidences(test_run_case_id);

-- Mesmo padrão de segurança de test_run_case_attempts: acesso liberado só pra
-- quem é membro do projeto ao qual essa execução pertence
-- (test_run_case_id → test_run_cases → test_runs → is_project_member).
alter table run_case_evidences enable row level security;

drop policy if exists "run_case_evidences: all se membro" on run_case_evidences;
create policy "run_case_evidences: all se membro" on run_case_evidences for all using (
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

-- ------------------------------------------------------------
-- (Opcional) Manutenção: arquivos órfãos no Storage
-- ------------------------------------------------------------
-- A tela apaga o arquivo do Storage junto com o registro. Mas se algum dia
-- uma exclusão em cascata (ex: apagar uma suíte/projeto inteiro) levar os
-- registros embora sem passar pela tela, os arquivos ficam ocupando espaço.
-- Esta consulta LISTA (não apaga nada) o que está no Storage sem registro:
--
-- select o.name, o.created_at, (o.metadata->>'size')::bigint as bytes
-- from storage.objects o
-- where o.bucket_id = 'evidence'
--   and o.name like '%/run-case-evidences/%'
--   and not exists (select 1 from run_case_evidences e where e.storage_path = o.name)
-- order by bytes desc;
