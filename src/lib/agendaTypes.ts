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
}

export interface AgendaFixaItem {
  id: string;
  paciente: string;
  aluno_id: string;
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
  };
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

export function getHorariosPorTurno(turno: TurnoAgenda): string[] {
  switch (turno) {
    case 'MANHA':
      return [...HORARIOS_MANHA];
    case 'TARDE':
      return [...HORARIOS_TARDE];
    case 'TODOS':
    default:
      return [...HORARIOS_TODOS];
  }
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
    const f = inc.aluno_fixa || 'Anterior';
    const m = inc.aluno_mensal || 'Novo';
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

