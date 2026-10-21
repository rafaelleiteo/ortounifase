import React from 'react';
import { formatarMesAno } from '@/lib/agendaTypes';

export interface AgendaPrintHeaderProps {
  turmaNome: string;
  diaSemana: string;
  tipo: 'fixa' | 'mensal';
  mesReferencia?: string;
}

const formatarDiaSemana = (dia: string): string => {
  const d = (dia || '').toUpperCase().trim();
  if (d === 'QUINTA') return 'Quinta-feira';
  if (d === 'SEXTA') return 'Sexta-feira';
  if (d === 'SABADO' || d === 'SÁBADO') return 'Sábado';
  return dia;
};

const formatarDataHoraAtual = (): string => {
  const agora = new Date();
  const data = agora.toLocaleDateString('pt-BR');
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
};

export const AgendaPrintHeader: React.FC<AgendaPrintHeaderProps> = ({
  turmaNome,
  diaSemana,
  tipo,
  mesReferencia
}) => {
  const [dataHoraImpressao, setDataHoraImpressao] = React.useState<string>(formatarDataHoraAtual);

  React.useEffect(() => {
    const handleBeforePrint = () => {
      setDataHoraImpressao(formatarDataHoraAtual());
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, []);

  return (
    <div className="agenda-print-header hidden print:flex items-center justify-between pb-1.5 mb-2 border-b-2 border-slate-300 text-slate-800">
      <div className="flex items-center gap-2.5">
        <span className="font-black text-sm uppercase tracking-wide text-slate-900">
          {turmaNome} — {tipo === 'fixa' ? 'Agenda Fixa' : 'Agenda Mensal'}
        </span>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 rounded border border-slate-300 text-slate-700">
          {formatarDiaSemana(diaSemana)}
        </span>
        {tipo === 'mensal' && mesReferencia && (
          <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-900 rounded border border-blue-200">
            {formatarMesAno(mesReferencia)}
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold tracking-tight">
        Impresso em {dataHoraImpressao}
      </div>
    </div>
  );
};
