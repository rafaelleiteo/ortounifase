import { supabase } from './supabase';
import {
  ImportPayload,
  normalizarHorario,
  isAtendimentoExtra,
  NOME_ATENDIMENTO_EXTRA,
  isItemBloqueio,
  resolverAlunoImportacao,
  normalizarTextoComparacao,
  AgendaAluno,
  mesmoDia,
  normalizarDiaImportacao,
  DiaSemanaCanonica
} from './agendaTypes';
import {
  planejarReaplicacaoObservacoes,
  ObservacaoAntiga,
  ItemNaoReaplicado,
  normalizarObservacao
} from './agendaObservacoes';
import { DadosDepoisPromocao } from './agendaPromocao';

export async function importarAgendaMensal(payload: ImportPayload) {
  if (!payload.turma || !payload.mes_referencia || !Array.isArray(payload.registros)) {
    throw new Error('Payload inválido. Certifique-se de preencher turma, mes_referencia e registros.');
  }

  // Pre-validacao de todas as linhas do lote antes de qualquer operacao no banco
  const errosDia: string[] = [];
  const diasNormalizados: DiaSemanaCanonica[] = [];

  payload.registros.forEach((reg, index) => {
    const res = normalizarDiaImportacao(reg.dia_semana);
    if (res.erro || !res.dia) {
      errosDia.push(`Linha ${index + 1} (paciente: "${reg.paciente || 'Sem paciente'}"): ${res.erro}`);
    } else {
      diasNormalizados.push(res.dia);
    }
  });

  if (errosDia.length > 0) {
    throw new Error(
      `Falha na validação dos dias da semana. Nenhuma alteração foi realizada no banco (0 registros excluídos ou inseridos).\n${errosDia.join('\n')}`
    );
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

  // 3. Montar os registros para upsert em agenda_mensal
  // UNIQUE (turma_id, mes_referencia, paciente, horario, dia_semana)
  const rowsToUpsert = payload.registros.map((reg, idx) => {
    const rawAluno = (reg.aluno || '').trim();
    const resolvido = resolverAlunoImportacao(
      rawAluno,
      turma.nome,
      (alunosExistentes as AgendaAluno[]) || []
    );

    const diaSemanaNormalizado = diasNormalizados[idx];

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

  // 4. PRESERVAÇÃO DE OBSERVAÇÕES MENSAIS
  // ANTES do delete: ler as linhas existentes com observação preenchida.
  // Se a leitura falhar, ABORTA a importação antes de apagar qualquer coisa para segurança dos dados.
  const { data: observacoesExistentes, error: errLeituraObs } = await supabase
    .from('agenda_mensal')
    .select('paciente, dia_semana, horario, observacao')
    .eq('turma_id', turma.id)
    .eq('mes_referencia', payload.mes_referencia)
    .not('observacao', 'is', null);

  if (errLeituraObs) {
    throw new Error(
      `Falha na leitura prévia de observações da agenda mensal. Operação abortada para segurança: ${errLeituraObs.message}`
    );
  }

  const obsParaPreservar: ObservacaoAntiga[] = (observacoesExistentes || [])
    .filter((o) => normalizarObservacao(o.observacao) !== null)
    .map((o) => ({
      paciente: o.paciente,
      dia_semana: o.dia_semana,
      horario: o.horario,
      observacao: o.observacao!
    }));

  // 4.1 Limpar registros existentes desta turma e mês antes de reinserir,
  // para que a reimportação sempre reflita exatamente o payload atual,
  // sem deixar registros "fantasma" de importações anteriores.
  const { error: deleteError } = await supabase
    .from('agenda_mensal')
    .delete()
    .eq('turma_id', turma.id)
    .eq('mes_referencia', payload.mes_referencia);

  if (deleteError) throw deleteError;

  // 4.2 Inserir / Upsert em agenda_mensal retornando os novos IDs para reconciliação
  const { data: upsertData, error: upsertError } = await supabase
    .from('agenda_mensal')
    .upsert(rowsToUpsert, {
      onConflict: 'turma_id,mes_referencia,paciente,horario,dia_semana',
    })
    .select('id, paciente, dia_semana, horario');

  if (upsertError) throw upsertError;

  // 4.3 Reaplicar observações salvas aos novos registros correspondentes
  const plano = planejarReaplicacaoObservacoes(
    obsParaPreservar,
    (upsertData || []).map((u) => ({
      id: u.id,
      paciente: u.paciente,
      dia_semana: u.dia_semana,
      horario: u.horario
    }))
  );

  const naoReaplicadasFinais: ItemNaoReaplicado[] = [...plano.naoReaplicadas];

  for (const item of plano.reaplicar) {
    try {
      const { error: errUpdateObs } = await supabase
        .from('agenda_mensal')
        .update({ observacao: item.observacao })
        .eq('id', item.id);

      if (errUpdateObs) {
        naoReaplicadasFinais.push({
          paciente: item.paciente,
          dia_semana: item.dia_semana,
          horario: item.horario,
          observacao: item.observacao,
          motivo: `Erro no banco ao salvar: ${errUpdateObs.message}`
        });
      }
    } catch (errCatch: any) {
      naoReaplicadasFinais.push({
        paciente: item.paciente,
        dia_semana: item.dia_semana,
        horario: item.horario,
        observacao: item.observacao,
        motivo: `Exceção ao atualizar: ${errCatch.message}`
      });
    }
  }

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
    naoReaplicadas: naoReaplicadasFinais
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
            mesmoDia(nova.dia_semana, rev.dia_semana) &&
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

export interface SolicitacaoPromocaoFixa {
  acao: 'CRIAR' | 'ATUALIZAR';
  fixaId?: string;
  depois: DadosDepoisPromocao;
}

export interface ResultadoPromocaoFixa {
  ok: number;
  atualizados: number;
  criados: number;
  erros: Array<{ paciente: string; erro: string }>;
}

/**
 * Promove ou atualiza registros na agenda fixa a partir dos dados consolidados da mensal.
 * Executa cada operacao individualmente, validando que exatamente 1 linha foi afetada.
 * Se mesReferencia for informado, recalcula as inconsistencias preservando revisoes manuais.
 */
export async function promoverParaFixa(
  turmaId: string,
  solicitacoes: SolicitacaoPromocaoFixa[],
  mesReferencia?: string
): Promise<ResultadoPromocaoFixa> {
  const resultado: ResultadoPromocaoFixa = {
    ok: 0,
    atualizados: 0,
    criados: 0,
    erros: []
  };

  for (const sol of solicitacoes) {
    try {
      if (sol.acao === 'CRIAR') {
        const payload = {
          turma_id: turmaId,
          aluno_id: sol.depois.aluno_id || null,
          aluno: sol.depois.aluno_id ? (sol.depois.aluno || null) : (sol.depois.aluno || 'ATENDIMENTO EXTRA'),
          paciente: sol.depois.paciente.trim(),
          horario: sol.depois.horario,
          dia_semana: sol.depois.dia_semana,
          tipo_registro: 'paciente',
          observacao: null
        };

        const { data, error } = await supabase
          .from('agenda_fixa')
          .insert(payload)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Nenhum registro inserido na agenda fixa');
        }

        resultado.ok += 1;
        resultado.criados += 1;
      } else if (sol.acao === 'ATUALIZAR') {
        if (!sol.fixaId) {
          throw new Error('ID do registro na agenda fixa nao fornecido para atualizacao');
        }

        const payload = {
          aluno_id: sol.depois.aluno_id || null,
          aluno: sol.depois.aluno_id ? (sol.depois.aluno || null) : (sol.depois.aluno || 'ATENDIMENTO EXTRA'),
          paciente: sol.depois.paciente.trim(),
          horario: sol.depois.horario,
          dia_semana: sol.depois.dia_semana,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('agenda_fixa')
          .update(payload)
          .eq('id', sol.fixaId)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error(`Registro ${sol.fixaId} nao encontrado para atualizacao na agenda fixa`);
        }

        resultado.ok += 1;
        resultado.atualizados += 1;
      }
    } catch (err: any) {
      resultado.erros.push({
        paciente: sol.depois.paciente,
        erro: err?.message || 'Falha ao processar promocao'
      });
    }
  }

  if (mesReferencia) {
    try {
      await recalcularInconsistenciasComPreservacao(turmaId, mesReferencia);
    } catch (err: any) {
      console.warn('Aviso ao recalcular inconsistencias apos promocao:', err);
    }
  }

  return resultado;
}
