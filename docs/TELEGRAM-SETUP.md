# Guia de Configuracao e Operacao do Bot de Telegram (Fase 1)

Este documento orienta a configuracao, deploy e operacao do bot de Telegram do OrtoUnifase para controle de Alinhadores e Ortopedicos.
O canal e restrito ao coordenador, com autenticacao rigorosa e sem intermediarios de IA.

## 1. Variaveis de Ambiente e Secrets no Supabase

As seguintes variaveis devem ser configuradas no painel do Supabase (Project Settings > Edge Functions > Secrets) ou via Supabase CLI:

* `TELEGRAM_BOT_TOKEN`: Token fornecido pelo @BotFather ao criar o bot no Telegram.
* `TELEGRAM_WEBHOOK_SECRET`: Chave aleatoria alfanumerica secreta (1-256 caracteres) criada por voce, usada para validar que as requisicoes vieram exclusivamente dos servidores do Telegram.
* `TELEGRAM_ALLOWED_CHAT_ID`: Chat ID numerico do coordenador. Deve iniciar vazio durante a configuracao inicial (descoberta de ID via `/meuid`) e ser preenchido logo em seguida.
* `SUPABASE_URL`: URL do projeto Supabase (ja preenchida automaticamente pelo Supabase runtime).
* `SUPABASE_SERVICE_ROLE_KEY`: Chave de servico do Supabase (para operacoes seguras no banco sem RLS publico).

IMPORTANTE: NUNCA compartilhe nem versione tokens ou chaves em repositorios.

## 2. Deploy da Edge Function

No terminal da sua maquina ou ambiente de CI, faca o deploy da Edge Function com o comando:

```bash
npx supabase functions deploy telegram-bot --no-verify-jwt
```

A flag `--no-verify-jwt` e obrigatoria porque os webhooks do Telegram nao enviam tokens JWT do Supabase; em vez disso, a autenticacao e feita com a validacao do header `X-Telegram-Bot-Api-Secret-Token`.

## 3. Registrar o Webhook no Telegram com Secret Token

Apos o deploy da Edge Function, configure o webhook no Telegram executando o comando curl abaixo (substitua os marcadores):

```bash
curl -F "url=https://[SEU_PROJETO_SUPABASE].supabase.co/functions/v1/telegram-bot" \
     -F "secret_token=[SEU_TELEGRAM_WEBHOOK_SECRET]" \
     "https://api.telegram.org/bot[SEU_BOT_TOKEN]/setWebhook"
```

Resposta esperada do Telegram:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## 4. Como Descobrir o seu Chat ID (Modo Descoberta)

1. Deixe a variavel `TELEGRAM_ALLOWED_CHAT_ID` vazia (ou remova-a temporariamente).
2. Abra a conversa com o seu bot no Telegram.
3. Envie o comando:
   `/meuid`
4. O bot respondera informando seu Chat ID numerico (exemplo: `123456789`).
5. Configure imediatamente a variavel no Supabase:
   ```bash
   npx supabase secrets set TELEGRAM_ALLOWED_CHAT_ID="123456789"
   ```
6. A partir deste momento, qualquer mensagem vinda de outro usuario ou grupo sera ignorada em silencio (retornando HTTP 200 OK sem nenhuma resposta nem gravacao de dados).

## 5. Testes Manuais Basicos (Smoke Testing)

Apos configurar seu Chat ID, realize a verificacao manual:

1. Digite `/start`: o bot deve responder com o menu principal interativo ("Novo paciente alinhador", "Novo paciente ortopedico", "Pedidos Pendentes").
2. Clique em "Novo paciente alinhador":
   * Digite o nome do paciente;
   * Se houver nome similar, escolha "Criar novo mesmo assim" ou "Cancelar";
   * Selecione a turma clicando no botao;
   * Na quantidade prevista, digite um numero (ex: `15`) ou clique em "Pular";
   * Na observacao, digite um texto ou clique em "Pular";
   * Revise o resumo e clique em "Confirmar cadastro".
3. Clique em "Pedidos Pendentes":
   * O bot listara pedidos que estejam com status atrasado ou vencendo (separados por Alinhadores e Aparelhos Ortopedicos).
4. Solicitacao rapida de pedido:
   * Ao receber a lista de pedidos ou aviso diario, clique no botao "Pedido feito: [Nome]";
   * Confirme com "Sim, confirmar";
   * O bot registrara a data da solicitacao no banco e confirmara a conclusao.

## 6. Como Pausar ou Remover o Webhook

Se precisar interromper temporariamente o recebimento de mensagens pelo bot, use:

```bash
curl "https://api.telegram.org/bot[SEU_BOT_TOKEN]/deleteWebhook"
```

## 7. Aviso Diario das 8h (Agendamento Alternativo via GitHub Actions)

Caso a extensao `pg_cron` nao esteja habilitada no seu plano do Supabase, o aviso diario das 8h pode ser acionado por um workflow do GitHub Actions agendado diariamente:

1. Cadastre os secrets no seu repositorio GitHub (Settings > Secrets and variables > Actions):
   * `SUPABASE_URL`
   * `TELEGRAM_WEBHOOK_SECRET`
   * `SUPABASE_SERVICE_ROLE_KEY`

2. Exemplo de workflow (`.github/workflows/telegram-aviso-diario.yml`):
```yaml
name: Aviso Diario Telegram

on:
  schedule:
    # 08:00 BRT corresponde a 11:00 UTC
    - cron: '0 11 * * *'
  workflow_dispatch:

jobs:
  disparar-aviso:
    runs-on: ubuntu-latest
    steps:
      - name: Chamar Edge Function do Bot
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/telegram-bot" \
            -H "Content-Type: application/json" \
            -H "X-Telegram-Bot-Api-Secret-Token: ${{ secrets.TELEGRAM_WEBHOOK_SECRET }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -d '{"action": "aviso_diario"}'
```
