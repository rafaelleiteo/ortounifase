import { supabase } from './supabase';

export interface Turma {
  id: string;
  nome: 'ESP1' | 'ESP2' | 'SERVIÇO' | string;
}

export interface AgendaAluno {
  id: string;
  nome: string;
  turma_id: string;
  ativo: boolean;
  membros?: string[] | null;
}

export interface AgendaFixaItem {
  id: string;
  paciente: string;
  aluno_id?: string | null;
  aluno?: string | null;
  horario: string; // "HH:MM:SS" or "HH:MM"
  dia_semana: 'QUINTA' | 'SEXTA' | 'SABADO' | string;
  turma_id: string;
  tipo_registro?: 'paciente' | 'bloqueio';
  tipo_bloqueio?: TipoBloqueio;
  created_at?: string;
  updated_at?: string;
  agenda_alunos?: {
    id: string;
    nome: string;
  } | null;
}

export interface AgendaMensalItem {
  id: string;
  paciente: string;
  aluno_id?: string | null;
  aluno?: string | null;
  horario: string;
  dia_semana: 'QUINTA' | 'SEXTA' | 'SABADO' | string;
  turma_id: string;
  mes_referencia: string; // "YYYY-MM-01"
  tipo_registro?: 'paciente' | 'bloqueio';
  tipo_bloqueio?: TipoBloqueio;
  created_at?: string;
  agenda_alunos?: {
    id: string;
    nome: string;
  } | null;
}

export interface InconsistenciaItem {
  id: string;
  tipo: 'AUSENTE' | 'ALUNO_TROCADO' | 'PACIENTE_NOVO' | 'HORARIO_ALTERADO';
  paciente: string;
  aluno_fixa?: string | null;
  aluno_mensal?: string | null;
  horario: string;
  dia_semana: 'QUINTA' | 'SEXTA' | 'SABADO' | string;
  turma_id: string;
  mes_referencia: string;
  status: 'PENDENTE' | 'REVISADO' | 'OK' | 'EDITAR';
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ImportPayloadRegistro {
  paciente: string;
  aluno: string;
  horario: string;
  dia_semana: string;
}

export interface ImportPayload {
  turma: string;
  mes_referencia: string;
  registros: ImportPayloadRegistro[];
}

export type TurnoAgenda = 'TODOS' | 'MANHA' | 'TARDE';

export interface OpcaoTurno {
  id: TurnoAgenda;
  label: string;
  descricao: string;
  horarioInicio: string;
  horarioFim: string;
}

export const OPCOES_TURNO: OpcaoTurno[] = [
  {
    id: 'TODOS',
    label: 'Todos os Horários',
    descricao: '08h - 15h45',
    horarioInicio: '08:00',
    horarioFim: '15:45'
  },
  {
    id: 'MANHA',
    label: 'Manhã',
    descricao: '08h - 11h30',
    horarioInicio: '08:00',
    horarioFim: '11:30'
  },
  {
    id: 'TARDE',
    label: 'Tarde',
    descricao: '13h30 - 15h45',
    horarioInicio: '13:30',
    horarioFim: '15:45'
  }
];

export const HORARIOS_MANHA = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'
];

export const HORARIOS_TARDE = [
  '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45'
];

export const HORARIO_DIVISOR_TURNO = '13:30';

export const HORARIOS_TODOS = [...HORARIOS_MANHA, ...HORARIOS_TARDE];

/**
 * Identifica se a turma é a turma SERVIÇO (ignorando acentuação e caixa alta/baixa).
 */
export function isTurmaServico(turmaNome?: string | null): boolean {
  if (!turmaNome) return false;
  return normalizarTextoComparacao(turmaNome).includes('servico');
}

/**
 * Horários da manhã exclusivos da turma SERVIÇO com intervalos a cada 15 minutos (08:00 às 11:30).
 */
export const HORARIOS_MANHA_SERVICO = [
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30'
];

export const HORARIOS_TARDE_SERVICO = [...HORARIOS_TARDE];

export const HORARIOS_TODOS_SERVICO = [
  ...HORARIOS_MANHA_SERVICO,
  ...HORARIOS_TARDE_SERVICO
];

export function getHorariosPorTurno(turno: TurnoAgenda, turmaNome?: string): string[] {
  const servico = isTurmaServico(turmaNome);
  const manha = servico ? HORARIOS_MANHA_SERVICO : HORARIOS_MANHA;
  const tarde = servico ? HORARIOS_TARDE_SERVICO : HORARIOS_TARDE;

  switch (turno) {
    case 'MANHA':
      return [...manha];
    case 'TARDE':
      return [...tarde];
    case 'TODOS':
    default:
      return [...manha, ...tarde];
  }
}

export function getHorariosTurma(turmaNome?: string): string[] {
  return getHorariosPorTurno('TODOS', turmaNome);
}

export function getTurnoDeHorario(horario?: string | null): 'MANHA' | 'TARDE' {
  if (!horario) return 'MANHA';
  const hNorm = normalizarHorario(horario);
  if (hNorm < '12:00:00') {
    return 'MANHA';
  }
  return 'TARDE';
}

export const DIAS_SEMANA = ['QUINTA', 'SEXTA', 'SABADO'] as const;
export type DiaSemana = typeof DIAS_SEMANA[number];

export function normalizarHorario(h: string): string {
  if (!h) return '';
  const parts = h.trim().split(':');
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}:00`;
  }
  return h;
}

export function formatarHorarioExibicao(h: string): string {
  if (!h) return '';
  const parts = h.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return h;
}

export const NOME_ATENDIMENTO_EXTRA = 'Atendimento Extra';

export function isAtendimentoExtra(nome?: string | null): boolean {
  if (!nome) return false;
  return nome.trim().toLowerCase().replace(/\s+/g, ' ') === 'atendimento extra';
}

/**
 * Tipos de Bloqueio de Horário (Fechar Horário):
 * - SEQUENCIA: Continuação do paciente anterior (cor AZUL, igual ao paciente agendado normalmente)
 * - LIVRE: Horário intencionalmente vago / disponível confirmado pelo coordenador (cor AMARELA)
 * - OUTRO: Observação livre (ex: feriado, manutenção, etc.) (cor CINZA por padrão)
 */
export type TipoBloqueio = 'SEQUENCIA' | 'LIVRE' | 'OUTRO';

export const COR_BLOQUEIO_SEQUENCIA = 'bg-brand-50/50 border-brand-200 text-brand-900';
export const COR_BLOQUEIO_LIVRE = 'bg-amber-50/70 border-amber-300 text-amber-900';
// Constante nomeada para fácil customização da cor do tipo OUTRO:
export const COR_BLOQUEIO_OUTRO = 'bg-slate-100/80 border-slate-300 text-slate-800';

/**
 * Identifica o tipo de bloqueio a partir do campo tipo_bloqueio ou do padrão de texto do paciente
 * para garantir compatibilidade retroativa total com dados já existentes.
 */
export function getTipoBloqueio(item: { paciente?: string; tipo_bloqueio?: TipoBloqueio | null }): TipoBloqueio {
  if (item.tipo_bloqueio) return item.tipo_bloqueio;
  const p = (item.paciente || '').trim();
  if (p.startsWith('[SEQUENCIA]')) return 'SEQUENCIA';
  if (p.startsWith('[LIVRE]') || p.toLowerCase() === 'horário livre' || p.toLowerCase() === 'livre') return 'LIVRE';
  if (p.startsWith('[OUTRO]')) return 'OUTRO';
  if (p.toLowerCase().startsWith('continuação')) return 'SEQUENCIA';
  // Bloqueios legados sem tag definida são tratados como "OUTRO" por padrão
  return 'OUTRO';
}

/**
 * Remove qualquer tag de prefixo [SEQUENCIA], [LIVRE], [OUTRO] para exibição limpa no card
 */
export function getDescricaoBloqueio(paciente: string): string {
  if (!paciente) return '';
  const limpo = paciente.replace(/^\[(SEQUENCIA|LIVRE|OUTRO)\]\s*/i, '').trim();
  if (!limpo && paciente.includes('[LIVRE]')) return 'Horário Livre';
  return limpo || paciente;
}

/**
 * Traduz o tipo de inconsistência técnica em uma frase de negócio clara para a recepção.
 * Ex: "Reagendado de 14:00 para 13:30", "Aluno trocado: Marcus → Livia", "Paciente novo incluído", "Atendimento removido / Não agendado no mês"
 */
export function formatarAlteracaoParaRecepcao(inc: {
  tipo: string;
  observacao?: string | null;
  aluno_fixa?: string | null;
  aluno_mensal?: string | null;
  horario?: string;
}): string {
  const tNorm = (inc.tipo || '').toUpperCase().trim();
  if (tNorm === 'HORARIO_ALTERADO') {
    if (inc.observacao && (inc.observacao.includes('➔') || inc.observacao.includes('->') || inc.observacao.includes('→'))) {
      const limpo = inc.observacao.replace(/\s*(➔|->|→)\s*/g, ' para ');
      return `Reagendado de ${limpo}`;
    }
    return `Reagendado para ${formatarHorarioExibicao(inc.horario || '')}`;
  }
  if (tNorm === 'ALUNO_TROCADO') {
    const f = inc.aluno_fixa || 'ATENDIMENTO EXTRA';
    const m = inc.aluno_mensal || 'ATENDIMENTO EXTRA';
    return `Aluno trocado: ${f} → ${m}`;
  }
  if (tNorm === 'PACIENTE_NOVO') {
    return 'Paciente novo incluído';
  }
  if (tNorm === 'AUSENTE') {
    return 'Atendimento removido / Não agendado no mês';
  }
  return inc.observacao || inc.tipo || 'Alteração realizada';
}

/**
 * Verifica se um registro da agenda (fixa ou mensal) ou inconsistência é um bloqueio de horário.
 */
export function isItemBloqueio(item?: { paciente?: string; tipo_registro?: string; tipo_bloqueio?: TipoBloqueio | null } | null): boolean {
  if (!item) return false;
  if (item.tipo_registro === 'bloqueio') return true;
  if (item.tipo_bloqueio) return true;
  const p = (item.paciente || '').trim();
  if (p.startsWith('[SEQUENCIA]') || p.startsWith('[LIVRE]') || p.startsWith('[OUTRO]')) return true;
  const pLower = p.toLowerCase();
  if (pLower === 'horário livre' || pLower === 'livre' || pLower.startsWith('bloqueio')) return true;
  return false;
}

/**
 * Sugere automaticamente a próxima sequência lógica de atendimento ao fechar/bloquear um horário.
 * Baseia-se nos atendimentos já cadastrados para aquele aluno naquele dia (tanto na Fixa quanto na Mensal).
 */
export function sugerirSequenciaFecharHorario(
  agenda: Array<{ horario: string; paciente: string; aluno_id?: string | null; dia_semana: string }>,
  alunoId: string,
  diaSemana: string,
  horario: string
): string {
  const hNorm = normalizarHorario(horario);

  const atendimentosDoAluno = agenda
    .filter(
      (item) =>
        item.aluno_id === alunoId &&
        (item.dia_semana || '').toUpperCase().trim() === diaSemana.toUpperCase().trim() &&
        item.paciente &&
        item.paciente.trim().length > 0
    )
    .sort((a, b) => normalizarHorario(a.horario).localeCompare(normalizarHorario(b.horario)));

  // 1. Procura o atendimento imediatamente anterior
  const anteriores = atendimentosDoAluno.filter(
    (item) => normalizarHorario(item.horario) < hNorm
  );

  if (anteriores.length > 0) {
    const ultimo = anteriores[anteriores.length - 1];
    const pacienteNome = getDescricaoBloqueio(ultimo.paciente.trim());

    // Se o anterior for continuação numerada: "Continuação 2 - Nome" -> "Continuação 3 - Nome"
    const matchNum = pacienteNome.match(/^continuação\s+(\d+)\s*[-:]?\s*(.*)$/i);
    if (matchNum) {
      const proximoNum = parseInt(matchNum[1], 10) + 1;
      const nomeBase = matchNum[2].trim() || 'Atendimento';
      return `Continuação ${proximoNum} - ${nomeBase}`;
    }

    // Se o anterior for continuação simples: "Continuação - Nome" -> "Continuação 2 - Nome"
    const matchSimples = pacienteNome.match(/^continuação\s*[-:]?\s*(.*)$/i);
    if (matchSimples) {
      const nomeBase = matchSimples[1].trim() || 'Atendimento';
      return `Continuação 2 - ${nomeBase}`;
    }

    // Atendimento inicial do paciente -> primeira continuação
    return `Continuação - ${pacienteNome}`;
  }

  // 2. Se não houver atendimento anterior, mas houver atendimento posterior naquele dia
  const posteriores = atendimentosDoAluno.filter(
    (item) => normalizarHorario(item.horario) > hNorm
  );
  if (posteriores.length > 0) {
    const proximo = posteriores[0];
    const pacienteNome = getDescricaoBloqueio(proximo.paciente.trim()).replace(/^continuação(\s+\d+)?\s*[-:]?\s*/i, '').trim();
    return `Continuação - ${pacienteNome}`;
  }

  return 'Bloqueio de Horário';
}

/**
 * Duplas oficiais confirmadas para a turma ESP2.
 * Ordem estrita das colunas:
 * 1. Gabriel e João
 * 2. Leticia e Duda
 * 3. Camila e Marcela
 * 4. Carla e Mauro
 * 5. Atendimento Extra
 */
export const DUPLAS_ESP2_OFICIAIS = [
  'Gabriel e João',
  'Leticia e Duda',
  'Camila e Marcela',
  'Carla e Mauro'
] as const;

export const MEMBROS_DUPLAS_ESP2: Record<string, string[]> = {
  'Gabriel e João': ['Gabriel', 'João'],
  'Leticia e Duda': ['Leticia', 'Duda'],
  'Camila e Marcela': ['Camila', 'Marcela'],
  'Carla e Mauro': ['Carla', 'Mauro']
};

/**
 * Retorna a lista de membros individuais de uma dupla ou aluno.
 */
export function getMembrosDupla(aluno: { nome: string; membros?: string[] | null }): string[] {
  if (aluno.membros && aluno.membros.length > 0) {
    return aluno.membros;
  }
  const matchOficial = DUPLAS_ESP2_OFICIAIS.find(
    (d) => d.toLowerCase() === aluno.nome.trim().toLowerCase()
  );
  if (matchOficial && MEMBROS_DUPLAS_ESP2[matchOficial]) {
    return MEMBROS_DUPLAS_ESP2[matchOficial];
  }
  return aluno.nome
    .split(/\s*(?:\be\b|\/|\+|,|&)\s*/i)
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Regra Unificada de Resolução de Colunas da Grade (Agenda Fixa e Agenda Mensal):
 * - ESP2: As 4 duplas na ordem estrita + Atendimento Extra por último (sempre visível, mesmo vazia).
 * - ESP1 e Serviço: Alunos ativos ordenados alfabeticamente + Atendimento Extra por último (sempre visível).
 */
export function obterColunasTurma(
  turmaNome: string,
  alunos: AgendaAluno[],
  itensAtendimento?: Array<{ aluno_id?: string | null }>
): (AgendaAluno & { isVirtual?: boolean })[] {
  const isEsp2 = (turmaNome || '').toUpperCase().includes('ESP2');

  if (isEsp2) {
    const colunasDuplas: (AgendaAluno & { isVirtual?: boolean })[] = [];

    for (const nomeDupla of DUPLAS_ESP2_OFICIAIS) {
      const match = alunos.find(
        (a) => a.nome.trim().toLowerCase() === nomeDupla.toLowerCase()
      );
      if (match) {
        colunasDuplas.push({
          ...match,
          membros: match.membros || MEMBROS_DUPLAS_ESP2[nomeDupla]
        });
      } else {
        colunasDuplas.push({
          id: `ESP2_${nomeDupla.replace(/\s+/g, '_')}`,
          nome: nomeDupla,
          turma_id: turmaNome,
          ativo: true,
          membros: MEMBROS_DUPLAS_ESP2[nomeDupla]
        });
      }
    }

    colunasDuplas.push({
      id: 'EXTRA_VIRTUAL',
      nome: NOME_ATENDIMENTO_EXTRA,
      turma_id: turmaNome,
      ativo: true,
      isVirtual: true
    });

    return colunasDuplas;
  }

  // Demais turmas (ESP1, SERVIÇO, etc.)
  const visiveis = alunos.filter((a) => {
    if (isAtendimentoExtra(a.nome)) return false; // Atendimento Extra físico é ignorado em favor da coluna virtual
    if (a.ativo === false) {
      return itensAtendimento ? itensAtendimento.some((item) => item.aluno_id === a.id) : false;
    }
    return true;
  });

  visiveis.sort((a, b) => a.nome.localeCompare(b.nome));

  const colunas: (AgendaAluno & { isVirtual?: boolean })[] = [...visiveis];

  // Coluna "Atendimento Extra" SEMPRE por último
  colunas.push({
    id: 'EXTRA_VIRTUAL',
    nome: NOME_ATENDIMENTO_EXTRA,
    turma_id: turmaNome,
    ativo: true,
    isVirtual: true
  });

  return colunas;
}

/**
 * Normaliza string para comparação: minúsculas, sem acentos, espaços extras removidos.
 */
export function normalizarTextoComparacao(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Resolve o aluno ou dupla responsável a partir do nome importado.
 * 
 * Regra ESP2:
 * Cada dupla é composta por 2 membros:
 * 1. Gabriel e João
 * 2. Leticia e Duda
 * 3. Camila e Marcela
 * 4. Carla e Mauro
 * 
 * O campo `aluno` pode vir com:
 * - O nome de um dos membros ("Camila", "Marcela", "Gabriel", "João", "Leticia", "Duda", "Carla", "Mauro")
 * - A dupla completa ("Camila e Marcela", "Camila / Marcela", "Camila + Marcela", etc.)
 * - Variações de caixa, espaço e acento.
 * 
 * Se casar com algum membro ou dupla da ESP2, resolve para o registro oficial daquela dupla.
 * O que não casar cai em Atendimento Extra (aluno_id: null, aluno: 'ATENDIMENTO EXTRA').
 * NUNCA cria aluno novo!
 */
export function resolverAlunoImportacao(
  nomeImportado: string,
  turmaNome: string,
  alunosExistentes: AgendaAluno[]
): { id: string | null; nome: string } {
  if (!nomeImportado || isAtendimentoExtra(nomeImportado)) {
    return { id: null, nome: 'ATENDIMENTO EXTRA' };
  }

  const isEsp2 = (turmaNome || '').toUpperCase().includes('ESP2');
  const nomeNorm = normalizarTextoComparacao(nomeImportado);

  if (isEsp2) {
    const mapDuplas = [
      { nomeOficial: 'Gabriel e João', membros: ['gabriel', 'joao'] },
      { nomeOficial: 'Leticia e Duda', membros: ['leticia', 'duda'] },
      { nomeOficial: 'Camila e Marcela', membros: ['camila', 'marcela'] },
      { nomeOficial: 'Carla e Mauro', membros: ['carla', 'mauro'] }
    ];

    const duplasCasadas: { id: string | null; nome: string }[] = [];

    for (const d of mapDuplas) {
      const matchDuplaNorm = normalizarTextoComparacao(d.nomeOficial);
      let casou = false;

      if (
        nomeNorm === matchDuplaNorm ||
        nomeNorm === normalizarTextoComparacao(`${d.membros[0]} / ${d.membros[1]}`) ||
        nomeNorm === normalizarTextoComparacao(`${d.membros[0]} + ${d.membros[1]}`) ||
        nomeNorm === normalizarTextoComparacao(`${d.membros[0]} & ${d.membros[1]}`) ||
        nomeNorm === normalizarTextoComparacao(`${d.membros[0]}, ${d.membros[1]}`)
      ) {
        casou = true;
      } else if (nomeNorm.includes(d.membros[0]) && nomeNorm.includes(d.membros[1])) {
        casou = true;
      } else {
        for (const membro of d.membros) {
          const regex = new RegExp(`(^|\\s|[^a-z])${membro}($|\\s|[^a-z])`, 'i');
          if (regex.test(nomeNorm)) {
            casou = true;
            break;
          }
        }
      }

      if (casou) {
        const alunoCadastrado = alunosExistentes.find(
          (a) => a.ativo !== false && normalizarTextoComparacao(a.nome) === matchDuplaNorm
        );
        duplasCasadas.push({
          id: alunoCadastrado ? alunoCadastrado.id : null,
          nome: d.nomeOficial
        });
      }
    }

    if (duplasCasadas.length > 1) {
      throw new Error(
        `Ambiguidade no aluno "${nomeImportado}": combina com múltiplas duplas da ESP2 (${duplasCasadas.map(d => d.nome).join(', ')}).`
      );
    }

    if (duplasCasadas.length === 1) {
      return duplasCasadas[0];
    }

    return { id: null, nome: 'ATENDIMENTO EXTRA' };
  }

  // Demais turmas (ESP1, SERVIÇO, etc.)
  // Consideramos alunos cadastrados não-extras ativos prioritariamente
  const candidatos = alunosExistentes.filter((a) => !isAtendimentoExtra(a.nome) && a.ativo !== false);

  // 1. Match exato normalizado (nome completo ignorando maiúsculas/minúsculas e acentos)
  const matchesExato = candidatos.filter(
    (a) => normalizarTextoComparacao(a.nome) === nomeNorm
  );

  if (matchesExato.length > 1) {
    throw new Error(
      `Ambiguidade no aluno "${nomeImportado}": corresponde a múltiplos alunos cadastrados (${matchesExato.map(a => a.nome).join(', ')}).`
    );
  }

  if (matchesExato.length === 1) {
    return { id: matchesExato[0].id, nome: matchesExato[0].nome };
  }

  // 2. Match por primeiro nome ou prefixo
  const matchesParcial = candidatos.filter((a) => {
    const aNorm = normalizarTextoComparacao(a.nome);
    const primeiroNome = aNorm.split(' ')[0];
    return nomeNorm === primeiroNome || aNorm.startsWith(nomeNorm + ' ') || nomeNorm.startsWith(aNorm + ' ');
  });

  if (matchesParcial.length > 1) {
    throw new Error(
      `Ambiguidade no aluno "${nomeImportado}": combina com múltiplos alunos cadastrados (${matchesParcial.map(a => a.nome).join(', ')}).`
    );
  }

  if (matchesParcial.length === 1) {
    return { id: matchesParcial[0].id, nome: matchesParcial[0].nome };
  }

  // Se nenhum ativo casou, verifica se casa com algum inativo
  const inativos = alunosExistentes.filter((a) => !isAtendimentoExtra(a.nome) && a.ativo === false);
  const matchesInativos = inativos.filter(
    (a) => normalizarTextoComparacao(a.nome) === nomeNorm
  );

  if (matchesInativos.length > 1) {
    throw new Error(
      `Ambiguidade no aluno "${nomeImportado}": corresponde a múltiplos alunos cadastrados inativos (${matchesInativos.map(a => a.nome).join(', ')}).`
    );
  }

  if (matchesInativos.length === 1) {
    return { id: matchesInativos[0].id, nome: matchesInativos[0].nome };
  }

  return { id: null, nome: 'ATENDIMENTO EXTRA' };
}

/**
 * Formata mês de referência (YYYY-MM ou YYYY-MM-DD) para exibição amigável em português (Ex: "Outubro/2026", "Novembro/2026").
 */
export function formatarMesAno(mesReferencia: string): string {
  if (!mesReferencia) return '';
  const partes = mesReferencia.substring(0, 7).split('-');
  if (partes.length !== 2) return mesReferencia;
  const ano = partes[0];
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(partes[1], 10) - 1;
  if (idx >= 0 && idx < 12) {
    return `${meses[idx]}/${ano}`;
  }
  return mesReferencia;
}

