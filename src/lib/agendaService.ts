import { supabase } from './supabase';
import {
  ImportPayload,
  normalizarHorario,
  isAtendimentoExtra,
  NOME_ATENDIMENTO_EXTRA
} from './agendaTypes';

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
    const key = (a.nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
    alunoMap.set(key, a.id);
  });

  // 3. Garantir que todos os alunos citados nos registros existam na turma
  // Quando o aluno for "ATENDIMENTO EXTRA", reutiliza ou cria uma única vez o registro fixo "Atendimento Extra"
  const novosAlunosNomes = new Set<string>();
  for (const reg of payload.registros) {
    const raw = (reg.aluno || '').trim();
    if (!raw) continue;

    if (isAtendimentoExtra(raw)) {
      if (!alunoMap.has('atendimento extra')) {
        novosAlunosNomes.add(NOME_ATENDIMENTO_EXTRA);
      }
    } else {
      const searchKey = raw.toLowerCase().replace(/\s+/g, ' ');
      if (!alunoMap.has(searchKey)) {
        novosAlunosNomes.add(raw);
      }
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
      const key = (a.nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
      alunoMap.set(key, a.id);
    });
  }

  // 4. Montar os registros para upsert em agenda_mensal
  // UNIQUE (turma_id, mes_referencia, paciente, horario, dia_semana)
  const rowsToUpsert = payload.registros.map((reg) => {
    const raw = (reg.aluno || '').trim();
    const searchKey = isAtendimentoExtra(raw)
      ? 'atendimento extra'
      : raw.toLowerCase().replace(/\s+/g, ' ');

    const alunoId = alunoMap.get(searchKey);

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

  // 4.1 Limpar registros existentes desta turma e mês antes de reinserir,
  // para que a reimportação sempre reflita exatamente o payload atual,
  // sem deixar registros "fantasma" de importações anteriores.
  const { error: deleteError } = await supabase
    .from('agenda_mensal')
    .delete()
    .eq('turma_id', turma.id)
    .eq('mes_referencia', payload.mes_referencia);

  if (deleteError) throw deleteError;

  // 4.2 Inserir / Upsert em agenda_mensal
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
    mesReferencia: payload.mes_referencia,
    totalImportados: rowsToUpsert.length,
    compareResult,
  };
}
