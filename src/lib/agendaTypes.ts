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

export const HORARIOS_MANHA = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'
];

export const HORARIOS_TARDE = [
  '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45'
];

export const DIAS_SEMANA = ['QUINTA', 'SEXTA', 'SABADO'] as const;

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

