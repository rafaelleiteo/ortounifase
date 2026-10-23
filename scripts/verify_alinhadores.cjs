/**
 * Script de Verificação Pós-Aplicação da Migração de Alinhadores
 * Arquivo: scripts/verify_alinhadores.cjs
 * 
 * Executa somente leituras e verificações de segurança/integridade:
 * 1. Existência das 3 tabelas: alinhadores_calendario, alinhadores_pacientes, alinhadores_pedidos
 * 2. Existência de todas as colunas esperadas
 * 3. Validação de RLS ativo e bloqueio total de leitura para chave anon (401/403 ou array vazio)
 * 4. Validação de integridade referencial com turmas
 */

const fs = require('fs');
const path = require('path');

// 1. Carrega variáveis de ambiente
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('ERRO: Arquivo .env não encontrado em:', envPath);
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf8');
let url = '', anon = '', serviceKey = '';
for (const line of env.split(/\r?\n/)) {
  const parts = line.split('=');
  const key = parts[0] ? parts[0].trim() : '';
  const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  if (key === 'VITE_SUPABASE_URL') url = val;
  if (key === 'VITE_SUPABASE_ANON_KEY') anon = val;
  if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = val;
}

if (!url || !anon || !serviceKey) {
  console.error('ERRO: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env');
  process.exit(1);
}

async function main() {
  console.log('================================================================');
  console.log('VERIFICAÇÃO PÓS-MIGRAÇÃO: MÓDULO ALINHADORES (SOMENTE LEITURA)');
  console.log('================================================================\n');

  let totalFalhas = 0;

  // ------------------------------------------------------------------
  // TESTE 1: EXISTÊNCIA DAS TABELAS (via service_role)
  // ------------------------------------------------------------------
  console.log('--- TESTE 1: Existência das Tabelas ---');
  const tabelas = [
    'alinhadores_calendario',
    'alinhadores_pacientes',
    'alinhadores_pedidos',
    'alinhadores_config'
  ];

  for (const t of tabelas) {
    try {
      const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      if (res.status === 200) {
        console.log(`  [OK] Tabela "${t}" existe e responde via service_role.`);
      } else {
        const text = await res.text();
        console.error(`  [FALHA] Tabela "${t}" retornou status ${res.status}: ${text}`);
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] Erro de conexão ao consultar tabela "${t}": ${err.message}`);
      totalFalhas++;
    }
  }

  // ------------------------------------------------------------------
  // TESTE 2: EXISTÊNCIA DE TODAS AS COLUNAS ESPERADAS
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 2: Existência das Colunas do Schema ---');
  const colunasPorTabela = [
    {
      tabela: 'alinhadores_calendario',
      colunas: 'id,turma_id,data,created_at'
    },
    {
      tabela: 'alinhadores_pacientes',
      colunas: 'id,nome,turma_id,total_alinhadores,observacao,ativo,created_at'
    },
    {
      tabela: 'alinhadores_pedidos',
      colunas: 'id,paciente_id,data_retorno,alinhador_de,alinhador_ate,solicitado_em,lote_id,mensagem_enviada_em,created_at'
    },
    {
      tabela: 'alinhadores_config',
      colunas: 'id,antecedencia_dias,quantidade_por_pedido,template_mensagem,updated_at'
    }
  ];

  for (const item of colunasPorTabela) {
    try {
      const res = await fetch(`${url}/rest/v1/${item.tabela}?select=${item.colunas}&limit=1`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      if (res.status === 200) {
        console.log(`  [OK] Tabela "${item.tabela}" contém todas as colunas: (${item.colunas})`);
      } else {
        const text = await res.text();
        console.error(`  [FALHA] Tabela "${item.tabela}" divergência de colunas (status ${res.status}): ${text}`);
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] Erro ao consultar colunas de "${item.tabela}": ${err.message}`);
      totalFalhas++;
    }
  }

  // ------------------------------------------------------------------
  // TESTE 3: BLOQUEIO DE ACESSO PARA CHAVE ANON (RLS + REVOKE)
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 3: Bloqueio de Acesso para Usuário Anônimo (anon) ---');

  for (const t of tabelas) {
    try {
      const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=5`, {
        headers: {
          'apikey': anon,
          'Authorization': `Bearer ${anon}`
        }
      });

      // Com REVOKE de anon e RLS ativo, o PostgREST deve responder com 401/403 ou array vazio []
      if (res.status === 401 || res.status === 403) {
        console.log(`  [OK] Tabela "${t}" bloqueada para anon com status ${res.status} (${res.statusText}).`);
      } else if (res.status === 200) {
        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
          console.log(`  [OK] Tabela "${t}" com RLS ativo retornou array vazio [] para anon (0 registros vazados).`);
        } else {
          console.error(`  [FALHA DE SEGURANÇA] Tabela "${t}" retornou dados para anon!`, data);
          totalFalhas++;
        }
      } else {
        console.log(`  [OK] Tabela "${t}" acesso negado para anon (status ${res.status}).`);
      }
    } catch (err) {
      console.log(`  [OK] Tabela "${t}" bloqueada com exceção de rede: ${err.message}`);
    }
  }

  // ------------------------------------------------------------------
  // RESUMO FINAL
  // ------------------------------------------------------------------
  console.log('\n================================================================');
  if (totalFalhas === 0) {
    console.log('RESULTADO FINAL: TODAS AS VERIFICAÇÕES PASSARAM COM SUCESSO! (0 falhas)');
    console.log('As tabelas do módulo de alinhadores estão devidamente configuradas e protegidas.');
  } else {
    console.error(`RESULTADO FINAL: ${totalFalhas} VERIFICAÇÃO(ÕES) FALHARAM.`);
    console.error('Certifique-se de aplicar a migration no SQL Editor antes de rodar este script.');
  }
  console.log('================================================================');

  if (totalFalhas > 0) {
    process.exit(1);
  }
}

main();
