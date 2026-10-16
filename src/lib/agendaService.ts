import { supabase } from './supabase';
import { ImportPayload, normalizarHorario } from './agendaTypes';

export async function importarAgendaMensal(payload: ImportPayload) {
  if (!payload.turma || !payload.mes_referencia || !Array.isArray(payload.registros)) {
    throw new Error('Payload inválido. Certifique-se de preencher turma, mes_referencia e registros.');
  }

  // 1. Obter a turma pelo nome
  const { data: turma, error: turmaError } = await supabase
    .from('turmas')
    .select('id, nome')
    .ilike('nome', payload.turma.trim())
    .single();

  if (turmaError || !turma) {
    throw new Error(`Turma "${payload.turma}" não encontrada no sistema.`);
  }

  // 2. Buscar todos os alunos existentes da turma
  const { data: alunosExistentes, error: alunosError } = await supabase
    .from('agenda_alunos')
    .select('id, nome')
    .eq('turma_id', turma.id);

  if (alunosError) throw alunosError;

  const alunoMap = new Map<string, string>();
  (alunosExistentes || []).forEach((a) => {
    alunoMap.set(a.nome.trim().toLowerCase(), a.id);
  });

  // 3. Garantir que todos os alunos citados nos registros existam na turma
  const novosAlunosNomes = new Set<string>();
  for (const reg of payload.registros) {
    const nomeLimpo = (reg.aluno || '').trim();
    if (nomeLimpo && !alunoMap.has(nomeLimpo.toLowerCase())) {
      novosAlunosNomes.add(nomeLimpo);
    }
  }

  if (novosAlunosNomes.size > 0) {
    const toInsert = Array.from(novosAlunosNomes).map((nome) => ({
      nome,
      turma_id: turma.id,
      ativo: true,
    }));

    const { data: criados, error: errCriarAlunos } = await supabase
      .from('agenda_alunos')
      .insert(toInsert)
      .select('id, nome');

    if (errCriarAlunos) throw errCriarAlunos;

    (criados || []).forEach((a) => {
      alunoMap.set(a.nome.trim().toLowerCase(), a.id);
    });
  }

  // 4. Montar os registros para upsert em agenda_mensal
  // UNIQUE (turma_id, mes_referencia, paciente, horario, dia_semana)
  const rowsToUpsert = payload.registros.map((reg) => {
    const nomeAlunoLimpo = (reg.aluno || '').trim().toLowerCase();
    const alunoId = alunoMap.get(nomeAlunoLimpo);

    if (!alunoId) {
      throw new Error(`Não foi possível vincular o aluno "${reg.aluno}".`);
    }

    const diaSemanaNormalizado = (reg.dia_semana || 'QUINTA').trim().toUpperCase();

    return {
      turma_id: turma.id,
      mes_referencia: payload.mes_referencia,
      paciente: (reg.paciente || '').trim(),
      aluno_id: alunoId,
      horario: normalizarHorario(reg.horario),
      dia_semana: diaSemanaNormalizado,
    };
  });

  // Upsert em agenda_mensal
  const { error: upsertError } = await supabase
    .from('agenda_mensal')
    .upsert(rowsToUpsert, {
      onConflict: 'turma_id,mes_referencia,paciente,horario,dia_semana',
    });

  if (upsertError) throw upsertError;

  // 5. Chamar a função compare_agendas no Postgres
  const { data: compareResult, error: compareError } = await supabase.rpc('compare_agendas', {
    p_turma_id: turma.id,
    p_mes_referencia: payload.mes_referencia,
  });

  if (compareError) throw compareError;

  return {
    success: true,
    turmaId: turma.id,
    totalImportados: rowsToUpsert.length,
    compareResult,
  };
}
