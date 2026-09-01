-- ============================================================
-- Integração Maestro — caminho do script automatizado por caso
-- ============================================================
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- Se a coluna já existir (compartilhando o mesmo backend da versão
-- anterior), este comando não faz nada (idempotente).

alter table test_cases add column if not exists automation_script_path text;
