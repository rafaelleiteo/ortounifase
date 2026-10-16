import React, { useState } from 'react';
import {
  UploadCloud,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { importarAgendaMensal } from '@/lib/agendaService';
import { ImportPayload } from '@/lib/agendaTypes';

interface ImportModalProps {
  turmaNome: string;
  defaultMesReferencia: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  turmaNome,
  defaultMesReferencia,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [jsonText, setJsonText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExemplo = () => {
    const exemplo: ImportPayload = {
      turma: turmaNome,
      mes_referencia: defaultMesReferencia,
      registros: [
        { paciente: "Ana Paula Silva", aluno: "Dr. Carlos Eduardo", horario: "08:00", dia_semana: "QUINTA" },
        { paciente: "Mariana Souza", aluno: "Dra. Juliana Mendes", horario: "08:30", dia_semana: "QUINTA" },
        { paciente: "Lucas Gabriel Costa", aluno: "Dr. Carlos Eduardo", horario: "13:30", dia_semana: "SEXTA" }
      ]
    };
    setJsonText(JSON.stringify(exemplo, null, 2));
    setError(null);
  };

  const handleImportar = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!jsonText.trim()) {
        throw new Error('Por favor, cole o JSON no campo abaixo antes de importar.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonText.trim());
      } catch (err: any) {
        throw new Error(`JSON inválido: ${err.message}`);
      }

      // Validação básica do formato
      if (!parsed.turma || !parsed.mes_referencia || !Array.isArray(parsed.registros)) {
        throw new Error('O JSON deve conter os campos obrigatórios: "turma", "mes_referencia" e "registros" (array).');
      }

      const res = await importarAgendaMensal(parsed);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao importar registros.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Importar Agenda Mensal ({turmaNome})
              </h3>
              <p className="text-xs text-slate-500">
                Insere os atendimentos do mês e executa a comparação automática contra a agenda fixa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Reimportação Segura:</span> O sistema realiza upsert nos registros e regera automaticamente todas as inconsistências do mês via tolerância fonética/similaridade (<code>pg_trgm</code> &gt; 0.4). Alunos não cadastrados na turma são classificados automaticamente como "ATENDIMENTO EXTRA".
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileJson className="w-4 h-4 text-slate-500" />
              JSON de Importação
            </label>
            <button
              type="button"
              onClick={handleExemplo}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Carregar Exemplo
            </button>
          </div>

          <textarea
            id="import-json-textarea"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={`{\n  "turma": "${turmaNome}",\n  "mes_referencia": "${defaultMesReferencia}",\n  "registros": [\n    { "paciente": "NOME PACIENTE", "aluno": "NOME ALUNO", "horario": "08:00", "dia_semana": "QUINTA" }\n  ]\n}`}
            rows={12}
            className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-inner"
          />

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-confirmar-importacao"
            onClick={handleImportar}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando e Comparando...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Importar e Comparar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
