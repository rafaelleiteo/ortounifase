import { supabase } from './supabase';
import {
  ImportPayload,
  normalizarHorario,
  isAtendimentoExtra,
  NOME_ATENDIMENTO_EXTRA,
  isItemBloqueio,
  resolverAlunoImportacao,
  normalizarTextoComparacao,
  AgendaAluno
} from './agendaTypes';

export async function importarAgendaMensal(payload: ImportPayload) {
  if (!payload.turma || !payload.mes_referencia || !Array.isArray(payload.registros)) {
    throw new Error('Payload inválido. Certifique-se de preencher turma, mes_referencia e registros.');
  }

  // 1. Obter a turma pelo nome ignorando acentos e maiúsculas/minúsculas
  const { data: turmas, error: turmasError } = await supabase
    .from('turmas')
    .select('id, nome');

  if (turmasError) throw turmasError;

  const inputTurmaNorm = normalizarTextoComparacao(payload.turma);
  const turmasMatch = (turmas || []).filter(
    (t) => normalizarTextoComparacao(t.nome) === inputTurmaNorm
  );

  if (turmasMatch.length === 0) {
    throw new Error(`Turma "${payload.turma}" não encontrada no sistema.`);
  }

  if (turmasMatch.length > 1) {
    throw new Error(
      `Ambiguidade na turma: "${payload.turma}" corresponde a múltiplas turmas cadastradas (${turmasMatch.map((t) => t.nome).join(', ')}).`
    );
  }

  const turma = turmasMatch[0];

  // 2. Buscar todos os alunos existentes da turma
  const { data: alunosExistentes, error: alunosError } = await supabase
    .from('agenda_alunos')
    .select('id, nome, ativo, turma_id')
    .eq('turma_id', turma.id);

  if (alunosError) throw alunosError;

  // NÃO CRIAR NOVOS ALUNOS!
  // Os alunos de cada turma são cadastrados manualmente pelo coordenador em agenda_alunos e são fixos —
  // a importação mensal NUNCA deve criar um novo registro em agenda_alunos.
  // Na ESP2, os alunos atendem em DUPLA: membros individuais, duplas completas ou variações de
  // caixa/espaço/acento resolvem para a respectiva dupla oficial. O que não casar cai em Atendimento Extra.

  // 3. Montar os registros para upsert em agenda_mensal
  // UNIQUE (turma_id, mes_referencia, paciente, horario, dia_semana)
  const rowsToUpsert = payload.registros.map((reg) => {
    const rawAluno = (reg.aluno || '').trim();
    const resolvido = resolverAlunoImportacao(
      rawAluno,
      turma.nome,
      (alunosExistentes as AgendaAluno[]) || []
    );

    const diaSemanaNormalizado = (reg.dia_semana || 'QUINTA').trim().toUpperCase();

    return {
      turma_id: turma.id,
      mes_referencia: payload.mes_referencia,
      paciente: (reg.paciente || '').trim(),
      aluno_id: resolvido.id,
      aluno: resolvido.nome,
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

  // 5. Chamar a função compare_agendas preservando status revisados
  const compareResult = await recalcularInconsistenciasComPreservacao(
    turma.id,
    payload.mes_referencia
  );

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

/**
 * Executa a conciliação automática de inconsistências garantindo a preservação
 * de status previamente revisados (REVISADO, OK, EDITAR) e notas manuais do coordenador.
 */
export async function recalcularInconsistenciasComPreservacao(
  turmaId: string,
  mesReferencia: string
) {
  // 1. Busca todas as inconsistências atuais que já foram revisadas ou possuem anotação do coordenador
  const { data: inconsistenciasAtuais } = await supabase
    .from('inconsistencias')
    .select('tipo, paciente, dia_semana, status, observacao')
    .eq('turma_id', turmaId)
    .eq('mes_referencia', mesReferencia);

  const revisadas = (inconsistenciasAtuais || []).filter(
    (i) => (i.status && i.status !== 'PENDENTE') || (i.observacao && i.observacao.trim())
  );

  // 2. Executa a conciliação automática via RPC compare_agendas
  const { data: compareResult, error: compareError } = await supabase.rpc('compare_agendas', {
    p_turma_id: turmaId,
    p_mes_referencia: mesReferencia
  });

  if (compareError) throw compareError;

  // 3. Se havia itens previamente revisados, restaura status e observações nos novos registros correspondentes
  if (revisadas.length > 0) {
    const { data: novasInconsistencias } = await supabase
      .from('inconsistencias')
      .select('id, tipo, paciente, dia_semana')
      .eq('turma_id', turmaId)
      .eq('mes_referencia', mesReferencia);

    if (novasInconsistencias && novasInconsistencias.length > 0) {
      for (const rev of revisadas) {
        const revNorm = rev.paciente.toLowerCase().trim();
        const match = novasInconsistencias.find(
          (nova) =>
            nova.tipo === rev.tipo &&
            (nova.dia_semana || '').toUpperCase().trim() === (rev.dia_semana || '').toUpperCase().trim() &&
            (nova.paciente.toLowerCase().trim() === revNorm ||
             nova.paciente.toLowerCase().includes(revNorm) ||
             revNorm.includes(nova.paciente.toLowerCase().trim()))
        );

        if (match) {
          await supabase
            .from('inconsistencias')
            .update({
              status: rev.status,
              ...(rev.observacao ? { observacao: rev.observacao } : {}),
              updated_at: new Date().toISOString()
            })
            .eq('id', match.id);
        }
      }
    }
  }

  // 4. Remove qualquer falso-positivo decorrente de bloqueios na agenda (ex: [SEQUENCIA], [LIVRE], [OUTRO], Horário Livre)
  try {
    const { data: incsParaLimpar } = await supabase
      .from('inconsistencias')
      .select('id, paciente')
      .eq('turma_id', turmaId)
      .eq('mes_referencia', mesReferencia);

    const idsBloqueios = (incsParaLimpar || [])
      .filter((i) => isItemBloqueio(i))
      .map((i) => i.id);

    if (idsBloqueios.length > 0) {
      await supabase
        .from('inconsistencias')
        .delete()
        .in('id', idsBloqueios);
    }
  } catch (errClean) {
    console.warn('Aviso ao limpar bloqueios de inconsistencias:', errClean);
  }

  return compareResult;
}
