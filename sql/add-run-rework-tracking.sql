-- Retrabalho por dev: a execução passa a saber de qual TAREFA ela é, qual é o DEV responsável e COMO A RODADA TERMINOU.
--
-- Uma tarefa pode ter várias execuções (uma por rodada de teste). Ao concluir cada uma, o QA diz se foi aprovada ou
-- reprovada e devolvida ao dev. Cada reprovação é um retorno pro dev. Execuções que não são de uma tarefa (uma regressão
-- geral, por exemplo) ficam com review_outcome nulo e não entram na métrica.
--
-- É seguro rodar mais de uma vez (add column if not exists, drop constraint if exists). Não mexe nas linhas existentes:
-- as execuções antigas ficam sem tarefa, sem dev e sem avaliação.

alter table test_runs add column if not exists task_ref text;
alter table test_runs add column if not exists dev_contact_id uuid references contacts (id) on delete set null;
alter table test_runs add column if not exists review_outcome text;
alter table test_runs add column if not exists reviewed_at timestamptz;
alter table test_runs add column if not exists reviewed_by uuid;

alter table test_runs drop constraint if exists test_runs_review_outcome_check;
alter table test_runs
    add constraint test_runs_review_outcome_check
    check (review_outcome is null or review_outcome in ('approved', 'rejected'));

create index if not exists idx_test_runs_task_ref on test_runs (project_id, task_ref) where task_ref is not null;
create index if not exists idx_test_runs_dev_contact on test_runs (dev_contact_id) where dev_contact_id is not null;

comment on column test_runs.task_ref is 'A tarefa que esta execução testa (texto livre, em geral o card do Jira). Várias execuções podem ser da mesma tarefa.';
comment on column test_runs.dev_contact_id is 'O dev responsável pela tarefa (contato do tipo dev). A reprovação conta como um retorno pra ele.';
comment on column test_runs.review_outcome is 'Como a rodada terminou: approved ou rejected (devolvida ao dev). Nulo = não se aplica.';
comment on column test_runs.reviewed_at is 'Quando a rodada foi avaliada. O período do painel de retrabalho usa esta data.';
comment on column test_runs.reviewed_by is 'Quem avaliou a rodada.';
