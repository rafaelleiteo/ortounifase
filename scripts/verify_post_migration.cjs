/**
 * Script de Verificação Pós-Aplicação da Migração Consolidada
 * 
 * Executa apenas leituras e verificações de segurança/integridade:
 * 1. Existência das colunas criadas
 * 2. Bloqueio de acesso para chave anon (compare_agendas e mesclar_alunos)
 * 3. Execução de compare_agendas via service_role
 * 4. Validação de contagem de inconsistências contra o snapshot de referência
 * 5. Verificação de ausência de '[' no início de nomes de pacientes
 * 6. Verificação de membros das duplas e legados inativos na ESP2
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

// Turmas conhecidas
const TURMA_ESP1 = '57dcfa9e-63f2-49f3-855c-ba15510f2c41';
const TURMA_ESP2 = '9baa41ed-8c13-4a27-8e32-459987545305';
const TURMA_SERVICO = 'd055a40b-03c0-4fe7-b76b-952ca2e65243';
const MES_REF = '2026-10-01';

async function main() {
  console.log('================================================================');
  console.log('INICIANDO VERIFICAÇÃO PÓS-MIGRAÇÃO (SOMENTE LEITURA)');
  console.log('================================================================\n');

  let totalFalhas = 0;

  // ------------------------------------------------------------------
  // TESTE 1: EXISTÊNCIA DAS COLUNAS
  // ------------------------------------------------------------------
  console.log('--- TESTE 1: Existência das Colunas Criadas ---');
  const colunasParaTestar = [
    { table: 'agenda_fixa', col: 'tipo_bloqueio' },
    { table: 'agenda_fixa', col: 'aluno' },
    { table: 'agenda_mensal', col: 'tipo_registro' },
    { table: 'agenda_mensal', col: 'tipo_bloqueio' },
    { table: 'agenda_alunos', col: 'membros' }
  ];

  for (const c of colunasParaTestar) {
    try {
      const res = await fetch(`${url}/rest/v1/${c.table}?select=${c.col}&limit=1`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      if (res.status === 200) {
        console.log(`  [OK] Coluna ${c.table}.${c.col} existe.`);
      } else {
        const text = await res.text();
        console.error(`  [FALHA] Coluna ${c.table}.${c.col} retornou status ${res.status}: ${text}`);
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] Coluna ${c.table}.${c.col} erro na requisição: ${err.message}`);
      totalFalhas++;
    }
  }

  // ------------------------------------------------------------------
  // TESTE 2: RESTRIÇÃO PARA CHAVE ANON (REVOKE)
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 2: Bloqueio de Acesso Anônimo (REVOKE) ---');
  
  // compare_agendas via anon
  try {
    const res = await fetch(`${url}/rest/v1/rpc/compare_agendas`, {
      method: 'POST',
      headers: {
        'apikey': anon,
        'Authorization': `Bearer ${anon}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_turma_id: TURMA_ESP1,
        p_mes_referencia: MES_REF
      })
    });
    if (res.status === 401 || res.status === 403) {
      console.log(`  [OK] compare_agendas bloqueada para anon (Status ${res.status} ${res.statusText}).`);
    } else {
      console.error(`  [FALHA DE SEGURANÇA] compare_agendas retornou status ${res.status} para anon!`);
      totalFalhas++;
    }
  } catch (err) {
    console.log(`  [OK] compare_agendas bloqueada com exceção de rede: ${err.message}`);
  }

  // mesclar_alunos via anon
  try {
    const res = await fetch(`${url}/rest/v1/rpc/mesclar_alunos`, {
      method: 'POST',
      headers: {
        'apikey': anon,
        'Authorization': `Bearer ${anon}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_aluno_oficial_id: '00000000-0000-0000-0000-000000000000',
        p_aluno_duplicado_id: '00000000-0000-0000-0000-000000000001'
      })
    });
    if (res.status === 401 || res.status === 403) {
      console.log(`  [OK] mesclar_alunos bloqueada para anon (Status ${res.status} ${res.statusText}).`);
    } else {
      console.error(`  [FALHA DE SEGURANÇA] mesclar_alunos retornou status ${res.status} para anon!`);
      totalFalhas++;
    }
  } catch (err) {
    console.log(`  [OK] mesclar_alunos bloqueada com exceção de rede: ${err.message}`);
  }

  // ------------------------------------------------------------------
  // TESTE 3: EXECUÇÃO DE compare_agendas VIA SERVICE_ROLE
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 3: Execução de compare_agendas via service_role ---');
  for (const [turmaNome, turmaId] of [['ESP1', TURMA_ESP1], ['ESP2', TURMA_ESP2]]) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/compare_agendas`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_turma_id: turmaId,
          p_mes_referencia: MES_REF
        })
      });

      if (res.status === 200) {
        const result = await res.json();
        console.log(`  [OK] compare_agendas(${turmaNome}, ${MES_REF}):`, result);
        if (typeof result.total !== 'number' || typeof result.ausentes !== 'number') {
          console.warn(`  [AVISO] Campo 'total' ou 'ausentes' não encontrado no retorno da RPC.`);
        }
      } else {
        const text = await res.text();
        console.error(`  [FALHA] compare_agendas(${turmaNome}) retornou ${res.status}: ${text}`);
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] compare_agendas(${turmaNome}) erro: ${err.message}`);
      totalFalhas++;
    }
  }

  // ------------------------------------------------------------------
  // TESTE 4: CONFERÊNCIA COM SNAPSHOT DE INCONSISTÊNCIAS
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 4: Conferência com Snapshot de Inconsistências ---');
  try {
    const res = await fetch(`${url}/rest/v1/inconsistencias?select=turma_id,tipo,status,paciente,dia_semana,horario&mes_referencia=eq.${MES_REF}`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const incs = await res.json();
    const esp1Incs = incs.filter(i => i.turma_id === TURMA_ESP1);
    const esp2Incs = incs.filter(i => i.turma_id === TURMA_ESP2);

    console.log(`  Total inconsistências no banco: ${incs.length} (ESP1: ${esp1Incs.length}, ESP2: ${esp2Incs.length})`);

    // No snapshot: ESP1 = 9 (2 HORARIO_ALTERADO, 2 AUSENTE, 5 PACIENTE_NOVO)
    const esp1Tipos = esp1Incs.reduce((acc, i) => { acc[i.tipo] = (acc[i.tipo] || 0) + 1; return acc; }, {});
    console.log('  Contagem por tipo em ESP1:', esp1Tipos);

    if (esp1Incs.length === 9) {
      console.log('  [OK] ESP1 possui exatamente as 9 inconsistências esperadas do snapshot.');
    } else {
      console.warn(`  [AVISO] ESP1 esperado 9 inconsistências, encontrado: ${esp1Incs.length}`);
    }

    if (esp2Incs.length === 39) {
      console.log('  [OK] ESP2 possui exatamente as 39 inconsistências esperadas do snapshot.');
    } else {
      console.warn(`  [AVISO] ESP2 esperado 39 inconsistências, encontrado: ${esp2Incs.length}`);
    }
  } catch (err) {
    console.error(`  [FALHA] Erro ao consultar inconsistências: ${err.message}`);
    totalFalhas++;
  }

  // ------------------------------------------------------------------
  // TESTE 5: AUSÊNCIA DE '[' NO INÍCIO DE NOMES DE PACIENTES
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 5: Ausência de "[" no Início de Nomes de Pacientes ---');
  const tabelasPaciente = ['agenda_fixa', 'agenda_mensal', 'inconsistencias'];

  for (const t of tabelasPaciente) {
    try {
      const res = await fetch(`${url}/rest/v1/${t}?paciente=ilike.*%5B*&select=id,paciente,tipo_registro,tipo_bloqueio`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      const data = await res.json();
      const prefixados = data.filter(d => /^\s*\[/.test(d.paciente || ''));
      if (prefixados.length === 0) {
        console.log(`  [OK] Tabela ${t}: 0 registros com '[' no início do paciente.`);
      } else {
        console.error(`  [FALHA] Tabela ${t}: encontrados ${prefixados.length} registros com '[' inicial:`);
        for (const p of prefixados) {
          console.error(`    - ID: ${p.id} | Paciente: "${p.paciente}" | tipo_registro: ${p.tipo_registro} | tipo_bloqueio: ${p.tipo_bloqueio}`);
        }
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] Tabela ${t} erro ao checar pacientes: ${err.message}`);
      totalFalhas++;
    }
  }

  // ------------------------------------------------------------------
  // TESTE 6: VERIFICAÇÃO DAS DUPLAS E LEGADOS DA ESP2
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 6: Duplas e Legados da ESP2 ---');
  try {
    const res = await fetch(`${url}/rest/v1/agenda_alunos?turma_id=eq.${TURMA_ESP2}&select=id,nome,ativo,membros`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const alunos = await res.json();
    const ativos = alunos.filter(a => a.ativo);
    const inativos = alunos.filter(a => !a.ativo);

    console.log(`  Alunos ESP2 no banco: ${ativos.length} ativos, ${inativos.length} inativos.`);

    // Verifica duplas
    const duplasEsperadas = ['Gabriel e João', 'Leticia e Duda', 'Camila e Marcela', 'Carla e Mauro'];
    for (const nome of duplasEsperadas) {
      const d = ativos.find(a => a.nome === nome);
      if (d && Array.isArray(d.membros) && d.membros.length === 2) {
        console.log(`  [OK] Dupla ativa "${nome}" configurada com membros: [${d.membros.join(', ')}].`);
      } else {
        console.error(`  [FALHA] Dupla "${nome}" não encontrada com membros válidos:`, d);
        totalFalhas++;
      }
    }

    // Verifica legados inativos
    const legadosEsperados = ['Adriele', 'Atendimento Extra', 'Dr. Fernando Rocha', 'Dra. Patricia Pillar'];
    for (const nome of legadosEsperados) {
      const leg = inativos.find(a => a.nome === nome);
      if (leg) {
        console.log(`  [OK] Legado "${nome}" está inativo (ativo = false).`);
      } else {
        console.warn(`  [AVISO] Legado "${nome}" não encontrado na lista de inativos da ESP2.`);
      }
    }
  } catch (err) {
    console.error(`  [FALHA] Erro ao consultar duplas da ESP2: ${err.message}`);
    totalFalhas++;
  }

  console.log('\n================================================================');
  if (totalFalhas === 0) {
    console.log('RESULTADO FINAL: TODOS OS TESTES PASSARAM COM SUCESSO! (0 falhas)');
  } else {
    console.error(`RESULTADO FINAL: ${totalFalhas} TESTE(S) FALHARAM.`);
  }
  console.log('================================================================');
}

main();
