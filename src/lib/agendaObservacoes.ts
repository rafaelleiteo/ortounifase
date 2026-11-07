import {
  normalizarTextoComparacao,
  normalizarHorario,
  isItemBloqueio,
  AgendaFixaItem,
  AgendaMensalItem
} from './agendaTypes';

export const LIMITE_CARACTERES_OBSERVACAO = 120;

/**
 * Normaliza e sanitiza o texto da observacao:
 * - Realiza trim de espacos em branco.
 * - Converte texto vazio ou apenas espacos para null.
 * - Limita ao tamanho maximo permitido na interface (120 caracteres).
 */
export function normalizarObservacao(obs?: string | null): string | null {
  if (obs === undefined || obs === null) return null;
  const limpo = obs.trim();
  if (limpo.length === 0) return null;
  if (limpo.length > LIMITE_CARACTERES_OBSERVACAO) {
    return limpo.substring(0, LIMITE_CARACTERES_OBSERVACAO).trim();
  }
  return limpo;
}

export interface ObservacaoFixaSemCartao {
  paciente: string;
  dia_semana: string;
  horario: string;
  observacao: string;
}

export interface ResultadoVinculoFixaMensal {
  mapaObservacoesPorMensalId: Map<string, string>;
  observacoesFixasSemCartao: ObservacaoFixaSemCartao[];
}

/**
 * Vincula observacoes da Agenda Fixa para os cartoes correspondentes da Agenda Mensal.
 *
 * Chave de vinculo:
 * - Mesmo dia da semana (case-insensitive)
 * - Nome normalizado do paciente (via normalizarTextoComparacao)
 * O horario NAO e utilizado na chave para que pacientes remanejados de horario continuem
 * exibindo sua observacao fixa perene.
 *
 * Se mais de uma linha da fixa casar para o mesmo paciente e dia, as observacoes
 * unicas sao concatenadas com " | ".
 */
export function vincularObservacoesFixas(params: {
  agendaFixa: AgendaFixaItem[];
  agendaMensal: AgendaMensalItem[];
  diaSelecionado?: string;
}): ResultadoVinculoFixaMensal {
  const { agendaFixa = [], agendaMensal = [], diaSelecionado } = params;

  // 1. Mapeia observacoes fixas validas por chave (nomeNormalizado__diaSemana)
  // Agrupa observacoes em array para permitir combinacao com " | "
  const mapaFixaPorChave = new Map<string, { textos: string[]; itens: AgendaFixaItem[] }>();

  for (const itemFixa of agendaFixa) {
    if (isItemBloqueio(itemFixa)) continue;
    const obsNorm = normalizarObservacao(itemFixa.observacao);
    if (!obsNorm) continue;

    const chave = `${normalizarTextoComparacao(itemFixa.paciente)}__${(itemFixa.dia_semana || '').toUpperCase().trim()}`;
    const existente = mapaFixaPorChave.get(chave);
    if (existente) {
      if (!existente.textos.includes(obsNorm)) {
        existente.textos.push(obsNorm);
      }
      existente.itens.push(itemFixa);
    } else {
      mapaFixaPorChave.set(chave, {
        textos: [obsNorm],
        itens: [itemFixa]
      });
    }
  }

  // 2. Cruza com os itens da Agenda Mensal
  const mapaObservacoesPorMensalId = new Map<string, string>();
  const chavesCasadas = new Set<string>();

  for (const itemMensal of agendaMensal) {
    if (isItemBloqueio(itemMensal)) continue;
    const chave = `${normalizarTextoComparacao(itemMensal.paciente)}__${(itemMensal.dia_semana || '').toUpperCase().trim()}`;

    const matchFixa = mapaFixaPorChave.get(chave);
    if (matchFixa && matchFixa.textos.length > 0) {
      mapaObservacoesPorMensalId.set(itemMensal.id, matchFixa.textos.join(' | '));
      chavesCasadas.add(chave);
    }
  }

  // 3. Identifica observacoes fixas sem cartao correspondente no mes
  const observacoesFixasSemCartao: ObservacaoFixaSemCartao[] = [];

  for (const [chave, dados] of mapaFixaPorChave.entries()) {
    if (!chavesCasadas.has(chave)) {
      for (const item of dados.itens) {
        // Se houver filtro de dia selecionado diferente de TODOS, filtra adequadamente
        if (
          diaSelecionado &&
          diaSelecionado !== 'TODOS' &&
          (item.dia_semana || '').toUpperCase().trim() !== diaSelecionado.toUpperCase().trim()
        ) {
          continue;
        }

        observacoesFixasSemCartao.push({
          paciente: item.paciente,
          dia_semana: item.dia_semana,
          horario: item.horario,
          observacao: normalizarObservacao(item.observacao) || ''
        });
      }
    }
  }

  return {
    mapaObservacoesPorMensalId,
    observacoesFixasSemCartao
  };
}

export interface ObservacaoAntiga {
  paciente: string;
  dia_semana: string;
  horario: string;
  observacao: string;
}

export interface LinhaNovaMensal {
  id?: string;
  paciente: string;
  dia_semana: string;
  horario: string;
}

export interface ItemReaplicacao {
  id: string;
  paciente: string;
  dia_semana: string;
  horario: string;
  observacao: string;
}

export interface ItemNaoReaplicado {
  paciente: string;
  dia_semana: string;
  horario: string;
  observacao: string;
  motivo?: string;
}

export interface PlanoReaplicacao {
  reaplicar: ItemReaplicacao[];
  naoReaplicadas: ItemNaoReaplicado[];
}

/**
 * Reconcilia observacoes do mes anterior/existente com as linhas recem-inseridas no upsert.
 * Chave principal: nome normalizado + dia_semana.
 * Desempate: horario exato quando houver mais de uma linha candidata para o mesmo paciente no mesmo dia.
 */
export function planejarReaplicacaoObservacoes(
  observacoesAntigas: ObservacaoAntiga[],
  linhasNovas: LinhaNovaMensal[]
): PlanoReaplicacao {
  const reaplicar: ItemReaplicacao[] = [];
  const naoReaplicadas: ItemNaoReaplicado[] = [];

  // Conjunto de indices de linhas novas ja associadas para evitar sobrescrita
  const indicesUsados = new Set<number>();

  for (const antiga of observacoesAntigas) {
    const obsValida = normalizarObservacao(antiga.observacao);
    if (!obsValida) continue;

    const nomeAntigoNorm = normalizarTextoComparacao(antiga.paciente);
    const diaAntigoNorm = (antiga.dia_semana || '').toUpperCase().trim();
    const hAntigoNorm = normalizarHorario(antiga.horario);

    // Encontra todas as linhas candidatas na mesma turma, dia e nome normalizado
    const candidatos: { index: number; linha: LinhaNovaMensal }[] = [];

    linhasNovas.forEach((linha, idx) => {
      if (indicesUsados.has(idx)) return;
      const nomeNovoNorm = normalizarTextoComparacao(linha.paciente);
      const diaNovoNorm = (linha.dia_semana || '').toUpperCase().trim();

      if (nomeNovoNorm === nomeAntigoNorm && diaNovoNorm === diaAntigoNorm) {
        candidatos.push({ index: idx, linha });
      }
    });

    if (candidatos.length === 0) {
      naoReaplicadas.push({
        paciente: antiga.paciente,
        dia_semana: antiga.dia_semana,
        horario: antiga.horario,
        observacao: obsValida,
        motivo: 'Paciente nao encontrado no novo arquivo importado para este dia'
      });
      continue;
    }

    // Se houver mais de um candidato, usa o horario como criterio de desempate
    let escolhido = candidatos[0];
    if (candidatos.length > 1) {
      const matchHorario = candidatos.find(
        (c) => normalizarHorario(c.linha.horario) === hAntigoNorm
      );
      if (matchHorario) {
        escolhido = matchHorario;
      }
    }

    indicesUsados.add(escolhido.index);

    if (escolhido.linha.id) {
      reaplicar.push({
        id: escolhido.linha.id,
        paciente: escolhido.linha.paciente,
        dia_semana: escolhido.linha.dia_semana,
        horario: escolhido.linha.horario,
        observacao: obsValida
      });
    } else {
      naoReaplicadas.push({
        paciente: antiga.paciente,
        dia_semana: antiga.dia_semana,
        horario: antiga.horario,
        observacao: obsValida,
        motivo: 'ID do registro novo nao disponivel para atualizacao'
      });
    }
  }

  return { reaplicar, naoReaplicadas };
}
