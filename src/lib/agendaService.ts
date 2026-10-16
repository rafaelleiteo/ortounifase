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

  // Mapa com chave normalizada (trim + lowercase + múltiplos espaços reduzidos a 1)
  const alunoMap = new Map<string, { id: string; nome: string }>();
  (alunosExistentes || []).forEach((a) => {
    const key = (a.nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (key) {
      alunoMap.set(key, { id: a.id, nome: a.nome });
    }
  });

  // NÃO CRIAR NOVOS ALUNOS!
  // Os alunos de cada turma são cadastrados manualmente pelo coordenador em agenda_alunos e são fixos —
  // a importação mensal NUNCA deve criar um novo registro em agenda_alunos.

  // 3. Montar os registros para upsert em agenda_mensal
  // UNIQUE (turma_id, mes_referencia, paciente, horario, dia_semana)
  const rowsToUpsert = payload.registros.map((reg) => {
    const rawAluno = (reg.aluno || '').trim();
    const searchKey = rawAluno.toLowerCase().replace(/\s+/g, ' ');

    let alunoId: string | null = null;
    let alunoTexto: string = 'ATENDIMENTO EXTRA';

    // Se o valor não for "ATENDIMENTO EXTRA" e coincidir com um aluno existente na turma:
    if (searchKey && !isAtendimentoExtra(rawAluno)) {
      const match = alunoMap.get(searchKey);
      if (match) {
        alunoId = match.id;
        alunoTexto = match.nome; // Salva o nome oficial encontrado
      }
    }

    const diaSemanaNormalizado = (reg.dia_semana || 'QUINTA').trim().toUpperCase();

    return {
      turma_id: turma.id,
      mes_referencia: payload.mes_referencia,
      paciente: (reg.paciente || '').trim(),
      aluno_id: alunoId,
      aluno: alunoTexto,
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

  const totalVinculados = rowsToUpsert.filter((r) => r.aluno_id !== null).length;
  const totalExtras = rowsToUpsert.filter((r) => r.aluno_id === null).length;

  return {
    success: true,
    turmaId: turma.id,
    mesReferencia: payload.mes_referencia,
    totalImportados: rowsToUpsert.length,
    totalVinculados,
    totalExtras,
    compareResult,
  };
}
