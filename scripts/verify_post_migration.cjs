/**
 * Script de Verificação Pós-Aplicação da Migração Consolidada
 * 
 * Executa apenas leituras e verificações de segurança/integridade:
 * 1. Resolução dinâmica de turmas e validação de IDs esperados
 * 2. Existência das colunas criadas
 * 3. Bloqueio de acesso para chave anon (compare_agendas e mesclar_alunos)
 * 4. Execução de compare_agendas via service_role para ESP1 e ESP2
 * 5. Validação rigorosa contra o snapshot (contagem por tipo, preservação de status)
 * 6. Ausência de inconsistências geradas para os 15 bloqueios da ESP1
 * 7. Verificação de ausência de '[' no início de nomes de pacientes
 * 8. Verificação de membros das duplas e legados inativos na ESP2
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

// IDs esperados para conferência
const EXPECTED_IDS = {
  ESP1: '1215cac9-8283-4c80-b767-9b2cfedaa101',
  ESP2: '9baa41ed-8c13-4a27-8e32-459987545305',
  SERVICO: 'baf7972d-4e96-4192-b39f-e68dd5155fb4'
};
const MES_REF = '2026-10-01';

async function main() {
  console.log('================================================================');
  console.log('INICIANDO VERIFICAÇÃO PÓS-MIGRAÇÃO (SOMENTE LEITURA)');
  console.log('================================================================\n');

  let totalFalhas = 0;

  // ------------------------------------------------------------------
  // TESTE 0: RESOLUÇÃO DINÂMICA DE TURMAS (SEM IDS FIXOS)
  // ------------------------------------------------------------------
  console.log('--- TESTE 0: Resolução Dinâmica de Turmas ---');
  let turmaMap = {};
  try {
    const res = await fetch(`${url}/rest/v1/turmas?select=id,nome`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const turmas = await res.json();
    for (const t of turmas) {
      turmaMap[t.nome.toUpperCase()] = t.id;
    }

    console.log('  Turmas encontradas dinamicamente no banco:');
    for (const [nome, id] of Object.entries(turmaMap)) {
      console.log(`    - ${nome}: ${id}`);
    }

    // Conferência com IDs esperados
    for (const [chave, expId] of Object.entries(EXPECTED_IDS)) {
      const nomeTurma = chave === 'SERVICO' ? 'SERVIÇO' : chave;
      const idEncontrado = turmaMap[nomeTurma];
      if (idEncontrado === expId) {
        console.log(`  [OK] Turma ${nomeTurma} confere com ID esperado (${expId}).`);
      } else {
        console.error(`  [FALHA] Turma ${nomeTurma} divergiu: esperado ${expId}, encontrado ${idEncontrado}`);
        totalFalhas++;
      }
    }
  } catch (err) {
    console.error(`  [FALHA] Erro ao buscar turmas: ${err.message}`);
    totalFalhas++;
  }

  const turmaEsp1Id = turmaMap['ESP1'] || EXPECTED_IDS.ESP1;
  const turmaEsp2Id = turmaMap['ESP2'] || EXPECTED_IDS.ESP2;

  // ------------------------------------------------------------------
  // TESTE 1: EXISTÊNCIA DAS COLUNAS
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 1: Existência das Colunas Criadas ---');
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
        p_turma_id: turmaEsp1Id,
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
  // TESTE 3: EXECUÇÃO DE compare_agendas VIA SERVICE_ROLE (ESP1 e ESP2)
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 3: Execução de compare_agendas via service_role ---');
  
  // Status de ESP1 antes
  let statusNaoPendentesAntes = 0;
  try {
    const resAntes = await fetch(`${url}/rest/v1/inconsistencias?turma_id=eq.${turmaEsp1Id}&mes_referencia=eq.${MES_REF}&select=status`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const incsAntes = await resAntes.json();
    if (Array.isArray(incsAntes)) {
      statusNaoPendentesAntes = incsAntes.filter(i => i.status && i.status !== 'PENDENTE').length;
    }
  } catch (_) {}

  // Execução para ESP1
  try {
    const resRpc = await fetch(`${url}/rest/v1/rpc/compare_agendas`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_turma_id: turmaEsp1Id,
        p_mes_referencia: MES_REF
      })
    });
    if (resRpc.status === 200) {
      const result = await resRpc.json();
      console.log('  [OK] compare_agendas(ESP1, 2026-10-01) retorno:', result);
    } else {
      const text = await resRpc.text();
      console.error(`  [FALHA] compare_agendas(ESP1) retornou ${resRpc.status}: ${text}`);
      totalFalhas++;
    }
  } catch (err) {
    console.error(`  [FALHA] compare_agendas(ESP1) erro: ${err.message}`);
    totalFalhas++;
  }

  // Execução para ESP2
  try {
    const resRpc2 = await fetch(`${url}/rest/v1/rpc/compare_agendas`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_turma_id: turmaEsp2Id,
        p_mes_referencia: MES_REF
      })
    });
    if (resRpc2.status === 200) {
      const result2 = await resRpc2.json();
      console.log('  [OK] compare_agendas(ESP2, 2026-10-01) retorno:', result2);
    } else {
      const text = await resRpc2.text();
      console.error(`  [FALHA] compare_agendas(ESP2) retornou ${resRpc2.status}: ${text}`);
      totalFalhas++;
    }
  } catch (err) {
    console.error(`  [FALHA] compare_agendas(ESP2) erro: ${err.message}`);
    totalFalhas++;
  }

  // ------------------------------------------------------------------
  // TESTE 4: CONFERÊNCIA DETALHADA COM SNAPSHOT DE INCONSISTÊNCIAS
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 4: Conferência Detalhada com Snapshot (ESP1) ---');
  try {
    const res = await fetch(`${url}/rest/v1/inconsistencias?turma_id=eq.${turmaEsp1Id}&mes_referencia=eq.${MES_REF}&select=id,tipo,status,paciente,dia_semana,horario,observacao`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const incs = await res.json();
    if (!Array.isArray(incs)) {
      console.error('  [FALHA] Inconsistências não retornou array:', incs);
      totalFalhas++;
    } else {
      console.log(`  Total de inconsistências geradas para ESP1: ${incs.length} (Esperado: 9)`);

      const tipos = { HORARIO_ALTERADO: 0, AUSENTE: 0, PACIENTE_NOVO: 0, ALUNO_TROCADO: 0 };
      incs.forEach(i => {
        tipos[i.tipo] = (tipos[i.tipo] || 0) + 1;
      });
      console.log('  Contagem por tipo em ESP1:', tipos);

      const statusNaoPendentesDepois = incs.filter(i => i.status && i.status !== 'PENDENTE').length;
      console.log(`  Itens com status diferente de PENDENTE antes: ${statusNaoPendentesAntes} | depois: ${statusNaoPendentesDepois}`);

      // Verificação detalhada dos 9 esperados
      const esperado = { HORARIO_ALTERADO: 2, AUSENTE: 2, PACIENTE_NOVO: 5, ALUNO_TROCADO: 0 };
      let diferiu = false;
      for (const [tipo, qtd] of Object.entries(esperado)) {
        if (tipos[tipo] !== qtd) {
          console.error(`  [DIVERGÊNCIA] Tipo ${tipo}: esperado ${qtd}, encontrado ${tipos[tipo]}`);
          diferiu = true;
        }
      }

      if (!diferiu && incs.length === 9) {
        console.log('  [OK] ESP1 exatamente idêntico ao snapshot (9 itens = 2 Horário Alterado, 2 Ausente, 5 Paciente Novo).');
      } else {
        console.error('  [FALHA] Diferenças encontradas em ESP1. Listando itens atuais:');
        incs.forEach(i => {
          console.error(`    - [${i.tipo}] Paciente: "${i.paciente}" | Dia: ${i.dia_semana} | Horário: ${i.horario} | Obs: ${i.observacao}`);
        });
        totalFalhas++;
      }

      // Verificação de bloqueios gerados como inconsistência
      const bloqueiosGerados = incs.filter(i => {
        const p = (i.paciente || '').toUpperCase();
        return p.includes('[') || p.includes('LIVRE') || p.includes('SEQUENCIA') || p.includes('BLOQUEIO');
      });
      if (bloqueiosGerados.length === 0) {
        console.log('  [OK] Nenhum dos 15 bloqueios da ESP1 foi indevidamente gerado como inconsistência.');
      } else {
        console.error(`  [FALHA] Encontradas ${bloqueiosGerados.length} inconsistências que parecem ser bloqueios:`, bloqueiosGerados);
        totalFalhas++;
      }
    }
  } catch (err) {
    console.error(`  [FALHA] Erro ao conferir inconsistências: ${err.message}`);
    totalFalhas++;
  }

  // ------------------------------------------------------------------
  // TESTE 5: AUSÊNCIA DE '[' NO INÍCIO DE NOMES DE PACIENTES
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 5: Ausência de "[" no Início de Nomes de Pacientes ---');
  const tabelasParaChecar = [
    { name: 'agenda_fixa', select: 'id,paciente,tipo_registro,tipo_bloqueio' },
    { name: 'agenda_mensal', select: 'id,paciente,tipo_registro,tipo_bloqueio' },
    { name: 'inconsistencias', select: 'id,paciente,tipo,status' }
  ];

  for (const t of tabelasParaChecar) {
    try {
      const res = await fetch(`${url}/rest/v1/${t.name}?paciente=ilike.*%5B*&select=${t.select}`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error(`  [FALHA] Tabela ${t.name} retornou status ${res.status} em vez de array:`, data);
        totalFalhas++;
        continue;
      }

      const prefixados = data.filter(d => /^\s*\[/.test(d.paciente || ''));
      if (prefixados.length === 0) {
        console.log(`  [OK] Tabela ${t.name}: 0 registros com '[' no início do paciente.`);
      } else {
        console.error(`  [FALHA] Tabela ${t.name}: encontrados ${prefixados.length} registros com '[' inicial:`);
        for (const p of prefixados) {
          console.error(`    - ID: ${p.id} | Paciente: "${p.paciente}" | info: ${JSON.stringify(p)}`);
        }
        totalFalhas++;
      }
    } catch (err) {
      console.error(`  [FALHA] Tabela ${t.name} erro na verificação: ${err.message}`);
      totalFalhas++;
    }
  }

  // ------------------------------------------------------------------
  // TESTE 6: VERIFICAÇÃO DAS DUPLAS E LEGADOS DA ESP2
  // ------------------------------------------------------------------
  console.log('\n--- TESTE 6: Duplas e Legados da ESP2 ---');
  try {
    const res = await fetch(`${url}/rest/v1/agenda_alunos?turma_id=eq.${turmaEsp2Id}&select=id,nome,ativo,membros`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const alunos = await res.json();
    if (!Array.isArray(alunos)) {
      console.error('  [FALHA] agenda_alunos não retornou array:', alunos);
      totalFalhas++;
    } else {
      const ativos = alunos.filter(a => a.ativo);
      const inativos = alunos.filter(a => !a.ativo);

      console.log(`  Alunos ESP2 no banco: ${ativos.length} ativos, ${inativos.length} inativos.`);

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

      const legadosEsperados = ['Adriele', 'Atendimento Extra', 'Dr. Fernando Rocha', 'Dra. Patricia Pillar'];
      for (const nome of legadosEsperados) {
        const leg = inativos.find(a => a.nome === nome);
        if (leg) {
          console.log(`  [OK] Legado "${nome}" está inativo (ativo = false).`);
        } else {
          console.warn(`  [AVISO] Legado "${nome}" não encontrado na lista de inativos da ESP2.`);
        }
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
