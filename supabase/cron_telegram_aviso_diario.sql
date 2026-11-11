-- ==============================================================================
-- AGENDAMENTO DIARIO: AVISO DE PEDIDOS VIA TELEGRAM
-- Arquivo: supabase/cron_telegram_aviso_diario.sql
--
-- ATENCAO:
-- Este arquivo NAO deve ser executado automaticamente pelo git.
-- Ele deve ser executado no Supabase SQL Editor apos ativar as extensoes
-- pg_cron e pg_net no dashboard do projeto.
--
-- Substitua os seguintes placeholders antes de executar:
-- [SEU_PROJETO_SUPABASE] por seu ref de projeto (ex: bzlsajjakaysvyqipwqh)
-- [SEU_TELEGRAM_WEBHOOK_SECRET] pelo secret configurado no bot
-- [SUA_SERVICE_ROLE_KEY] pela chave service_role do projeto
-- ==============================================================================

-- 1. Verifica se as extensoes pg_cron e pg_net estao ativas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove agendamento anterior se ja existir (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aviso_diario_telegram') THEN
    PERFORM cron.unschedule('aviso_diario_telegram');
  END IF;
END $$;

-- 3. Cria agendamento diario as 08:00 no fuso de Brasilia (America/Sao_Paulo)
-- 08:00 BRT corresponde a 11:00 UTC (padrao do pg_cron em servidores Supabase)
SELECT cron.schedule(
  'aviso_diario_telegram',
  '0 11 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://[SEU_PROJETO_SUPABASE].supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Telegram-Bot-Api-Secret-Token', '[SEU_TELEGRAM_WEBHOOK_SECRET]',
      'Authorization', 'Bearer [SUA_SERVICE_ROLE_KEY]'
    ),
    body := jsonb_build_object(
      'action', 'aviso_diario'
    )
  );
  $cron$
);

-- Consultas uteis de monitoramento para rodar no SQL Editor:
-- SELECT * FROM cron.job WHERE jobname = 'aviso_diario_telegram';
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'aviso_diario_telegram') ORDER BY start_time DESC LIMIT 10;
-- SELECT * FROM net._http_response ORDER BY id DESC LIMIT 10;
