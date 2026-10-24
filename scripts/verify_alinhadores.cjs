/**
 * Script de Verificação Pós-Aplicação da Migração de Alinhadores
 * Arquivo: scripts/verify_alinhadores.cjs
 * 
 * Executa estritamente LEITURAS (somente leitura, sem escrita):
 * 1. Existência e leitura das 4 tabelas via chave service_role (com aviso de que service_role ignora RLS)
 * 2. Leitura da linha de configuração alinhadores_config e comparação com TEMPLATE_MENSAGEM_PADRAO
 * 3. Validação de colunas de todas as 4 tabelas
 * 4. Validação de bloqueio com chave anon (404 é tratado estritamente como FALHA)
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

// Template padrão definido no código (src/lib/alinhadoresTypes.ts)
const TEMPLATE_MENSAGEM_PADRAO =
  'Olá, passando para informar que solicitamos alinhadores para os pacientes abaixo:\n\n{lista}\n\nAgradecemos a confirmação do recebimento do pedido.';

async function main() {
  console.log('================================================================');
  console.log('VERIFICAÇÃO PÓS-MIGRAÇÃO: MÓDULO ALINHADORES (SOMENTE LEITURA)');
  console.log('================================================================\n');

  let totalFalhas = 0;

  // ------------------------------------------------------------------
  // TESTE 1: EXISTÊNCIA DAS TABELAS VIA SERVICE_ROLE
  // ------------------------------------------------------------------
  console.log('--- TESTE 1: Existência das Tabelas e Leitura via service_role ---');
  console.log('  [AVISO] A chave service_role possui privilégios administrativos e ignora o RLS.');
  console.log('  Este teste comprova a existência física e schema, mas NÃO comprova a proteção por RLS.\n');

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
        console.log(`  [OK] Tabela "${t}" existe e responde via service_role (status 200).`);
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
  // TESTE 2: LEITURA DA LINHA ÚNICA DE alinhadores_config
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 2: Leitura da Linha de alinhadores_config e Comparação de Template ---');
  try {
    const res = await fetch(`${url}/rest/v1/alinhadores_config?select=*&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (res.status === 200) {
      const rows = await res.json();
      if (rows && rows.length > 0) {
        const cfg = rows[0];
        console.log('  [OK] Linha de configuração lida do banco com sucesso:');
        console.log(`    - id: ${cfg.id}`);
        console.log(`    - antecedencia_dias: ${cfg.antecedencia_dias}`);
        console.log(`    - quantidade_por_pedido: ${cfg.quantidade_por_pedido}`);
        console.log(`    - updated_at: ${cfg.updated_at}`);
        console.log(`    - template_mensagem (completo):\n"""\n${cfg.template_mensagem}\n"""`);

        // Comparação com o template do código
        const saoIguais = cfg.template_mensagem === TEMPLATE_MENSAGEM_PADRAO;
        if (saoIguais) {
          console.log('  [OK] O template lido do banco é EXATAMENTE IGUAL ao TEMPLATE_MENSAGEM_PADRAO do código TypeScript.');
        } else {
          console.log('  [AVISO] O template lido difere do TEMPLATE_MENSAGEM_PADRAO do código TypeScript.');
          console.log(`    Template do código:\n"""\n${TEMPLATE_MENSAGEM_PADRAO}\n"""`);
        }
      } else {
        console.error('  [FALHA] Tabela alinhadores_config retornou 0 linhas. A linha padrão não foi inserida!');
        totalFalhas++;
      }
    } else {
      const text = await res.text();
      console.error(`  [FALHA] Erro ao consultar alinhadores_config (status ${res.status}): ${text}`);
      totalFalhas++;
    }
  } catch (err) {
    console.error(`  [FALHA] Erro ao ler alinhadores_config: ${err.message}`);
    totalFalhas++;
  }

  // ------------------------------------------------------------------
  // TESTE 3: EXISTÊNCIA DE TODAS AS COLUNAS ESPERADAS
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 3: Existência das Colunas do Schema ---');
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
  // TESTE 4: BLOQUEIO DE ACESSO PARA CHAVE ANON (RLS + REVOKE)
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 4: Bloqueio de Acesso para Usuário Anônimo (anon) ---');
  console.log('  Regra: status 401/403 ou 200 com array vazio [] comprovam bloqueio.');
  console.log('  Regra estrita: status 404 NUNCA é aceito como bloqueio (indica tabela inexistente).\n');

  for (const t of tabelas) {
    try {
      const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=5`, {
        headers: {
          'apikey': anon,
          'Authorization': `Bearer ${anon}`
        }
      });

      if (res.status === 404) {
        console.error(`  [FALHA] Tabela "${t}" retornou status 404 (Not Found). 404 indica tabela inexistente ou ausente no cache do PostgREST, NÃO bloqueio seguro!`);
        totalFalhas++;
      } else if (res.status === 401 || res.status === 403) {
        console.log(`  [OK] Tabela "${t}" bloqueada com segurança para anon (status ${res.status} ${res.statusText}).`);
      } else if (res.status === 200) {
        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
          console.log(`  [OK] Tabela "${t}" com RLS ativo retornou array vazio [] para anon (0 registros vazados).`);
        } else {
          console.error(`  [FALHA DE SEGURANÇA] Tabela "${t}" retornou dados para anon!`, data);
          totalFalhas++;
        }
      } else {
        console.error(`  [FALHA] Tabela "${t}" retornou status inesperado para anon: ${res.status}`);
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] Erro de rede ao testar chave anon para "${t}": ${err.message}`);
      totalFalhas++;
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
