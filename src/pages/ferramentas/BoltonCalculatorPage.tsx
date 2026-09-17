import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Calculator,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Activity,
  ArrowRight
} from 'lucide-react';

interface ToothInputState {
  // Maxilar (Superior)
  sup_11: string; sup_21: string; // Central
  sup_12: string; sup_22: string; // Lateral
  sup_13: string; sup_23: string; // Canino
  sup_14: string; sup_24: string; // 1º Pré-molar
  sup_15: string; sup_25: string; // 2º Pré-molar
  sup_16: string; sup_26: string; // 1º Molar

  // Mandibular (Inferior)
  inf_41: string; inf_31: string; // Central
  inf_42: string; inf_32: string; // Lateral
  inf_43: string; inf_33: string; // Canino
  inf_44: string; inf_34: string; // 1º Pré-molar
  inf_45: string; inf_35: string; // 2º Pré-molar
  inf_46: string; inf_36: string; // 1º Molar
}

const initialToothState: ToothInputState = {
  sup_11: '', sup_21: '', sup_12: '', sup_22: '', sup_13: '', sup_23: '',
  sup_14: '', sup_24: '', sup_15: '', sup_25: '', sup_16: '', sup_26: '',

  inf_41: '', inf_31: '', inf_42: '', inf_32: '', inf_43: '', inf_33: '',
  inf_44: '', inf_34: '', inf_45: '', inf_35: '', inf_46: '', inf_36: ''
};

// Valores de exemplo clínico típico
const exampleToothState: ToothInputState = {
  sup_11: '8.5', sup_21: '8.5', sup_12: '6.8', sup_22: '6.8', sup_13: '7.8', sup_23: '7.8',
  sup_14: '7.2', sup_24: '7.2', sup_15: '6.8', sup_25: '6.8', sup_16: '10.2', sup_26: '10.2',

  inf_41: '5.4', inf_31: '5.4', inf_42: '5.9', inf_32: '5.9', inf_43: '7.0', inf_33: '7.0',
  inf_44: '7.0', inf_34: '7.0', inf_45: '7.1', inf_35: '7.1', inf_46: '11.0', inf_36: '11.0'
};

export const BoltonCalculatorPage: React.FC = () => {
  const [teeth, setTeeth] = useState<ToothInputState>(initialToothState);
  const [calculated, setCalculated] = useState<boolean>(false);

  const handleInputChange = (field: keyof ToothInputState, value: string) => {
    // Permite números e ponto decimal
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTeeth((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleClear = () => {
    setTeeth(initialToothState);
    setCalculated(false);
  };

  const handleFillExample = () => {
    setTeeth(exampleToothState);
    setCalculated(true);
  };

  // Conversão segura para float
  const parseVal = (v: string): number => parseFloat(v) || 0;

  // Soma dos 6 dentes anteriores superiores (13 a 23)
  const somaSupAnterior =
    parseVal(teeth.sup_13) + parseVal(teeth.sup_12) + parseVal(teeth.sup_11) +
    parseVal(teeth.sup_21) + parseVal(teeth.sup_22) + parseVal(teeth.sup_23);

  // Soma dos 6 dentes anteriores inferiores (43 a 33)
  const somaInfAnterior =
    parseVal(teeth.inf_43) + parseVal(teeth.inf_42) + parseVal(teeth.inf_41) +
    parseVal(teeth.inf_31) + parseVal(teeth.inf_32) + parseVal(teeth.inf_33);

  // Soma dos 6 dentes posteriores superiores (16..14 e 24..26)
  const somaSupPosterior =
    parseVal(teeth.sup_16) + parseVal(teeth.sup_15) + parseVal(teeth.sup_14) +
    parseVal(teeth.sup_24) + parseVal(teeth.sup_25) + parseVal(teeth.sup_26);

  // Soma dos 6 dentes posteriores inferiores (46..44 e 34..36)
  const somaInfPosterior =
    parseVal(teeth.inf_46) + parseVal(teeth.inf_45) + parseVal(teeth.inf_44) +
    parseVal(teeth.inf_34) + parseVal(teeth.inf_35) + parseVal(teeth.inf_36);

  // Soma total (12 dentes) por arcada
  const somaSupTotal = somaSupAnterior + somaSupPosterior;
  const somaInfTotal = somaInfAnterior + somaInfPosterior;

  // Verificação de preenchimentos válidos
  const isAnteriorValid = somaSupAnterior > 0 && somaInfAnterior > 0;
  const isTotalValid = isAnteriorValid && somaSupPosterior > 0 && somaInfPosterior > 0;

  // Cálculos do Índice Anterior
  const ratioAnterior = isAnteriorValid ? (somaInfAnterior / somaSupAnterior) * 100 : 0;
  const idealInfAnterior = somaSupAnterior * 0.772;
  const discrepanciaAnterior = isAnteriorValid ? somaInfAnterior - idealInfAnterior : 0;

  // Cálculos do Índice Total
  const ratioTotal = isTotalValid ? (somaInfTotal / somaSupTotal) * 100 : 0;
  const idealInfTotal = somaSupTotal * 0.913;
  const discrepanciaTotal = isTotalValid ? somaInfTotal - idealInfTotal : 0;

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    setCalculated(true);
  };

  const formatDiscrepancia = (val: number) => {
    const absVal = Math.abs(val).toFixed(2);
    if (Math.abs(val) < 0.05) {
      return { text: 'Sem discrepância significativa (Proporção ideal)', type: 'ideal' };
    }
    if (val > 0) {
      return { text: `Excesso Mandibular (Inferior) de ${absVal} mm`, type: 'mandibular' };
    }
    return { text: `Excesso Maxilar (Superior) de ${absVal} mm`, type: 'maxilar' };
  };

  return (
    <DashboardLayout
      pageTitle="Calculadora de Análise de Bolton"
      pageSubtitle="Diagnóstico clínico de discrepância de tamanho dentário entre a maxila e a mandíbula"
    >
      <div className="space-y-6">
        {/* Banner Informativo / Guia */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Análise de Proporção Interarcadas (Bolton)
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Insira o diâmetro mesiodistal dos dentes permanentes em milímetros (mm). A calculadora compara a soma dos 6 dentes anteriores (índice ideal: <strong className="text-slate-700">77,2%</strong>) e dos 12 dentes de cada arcada (índice ideal: <strong className="text-slate-700">91,3%</strong>).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleFillExample}
              className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>Valores de Exemplo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Aviso de Privacidade / Client-side Pura */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex items-center gap-3 text-amber-900 text-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <p>
            <strong className="font-semibold">Ferramenta 100% Local:</strong> Os cálculos são processados estritamente no seu navegador. Nenhum dado de paciente é salvo ou transmitido ao servidor.
          </p>
        </div>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ARCADA SUPERIOR (MAXILAR) */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-brand-50/60 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-brand-500"></span>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Arcada Superior (Maxilar)
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                  Soma: {somaSupTotal.toFixed(1)} mm
                </span>
              </div>

              <div className="p-5 space-y-5">
                {/* Dentes Anteriores Superiores */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Segmento Anterior (Canino a Canino)</span>
                    <span className="font-mono text-slate-600">Subtotal: {somaSupAnterior.toFixed(1)} mm</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Central */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">Incisivo Central</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (11)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_11}
                            onChange={(e) => handleInputChange('sup_11', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (21)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_21}
                            onChange={(e) => handleInputChange('sup_21', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lateral */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">Incisivo Lateral</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (12)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_12}
                            onChange={(e) => handleInputChange('sup_12', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (22)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_22}
                            onChange={(e) => handleInputChange('sup_22', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Canino */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">Canino</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (13)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_13}
                            onChange={(e) => handleInputChange('sup_13', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (23)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_23}
                            onChange={(e) => handleInputChange('sup_23', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dentes Posteriores Superiores */}
                <div className="pt-3 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Segmento Posterior (Premolares e 1º Molar)</span>
                    <span className="font-mono text-slate-600">Subtotal: {somaSupPosterior.toFixed(1)} mm</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1º Pré-molar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">1º Pré-molar</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (14)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_14}
                            onChange={(e) => handleInputChange('sup_14', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (24)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_24}
                            onChange={(e) => handleInputChange('sup_24', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2º Pré-molar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">2º Pré-molar</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (15)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_15}
                            onChange={(e) => handleInputChange('sup_15', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (25)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_25}
                            onChange={(e) => handleInputChange('sup_25', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 1º Molar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">1º Molar</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (16)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_16}
                            onChange={(e) => handleInputChange('sup_16', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (26)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.sup_26}
                            onChange={(e) => handleInputChange('sup_26', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ARCADA INFERIOR (MANDIBULAR) */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-purple-50/60 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Arcada Inferior (Mandibular)
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                  Soma: {somaInfTotal.toFixed(1)} mm
                </span>
              </div>

              <div className="p-5 space-y-5">
                {/* Dentes Anteriores Inferiores */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Segmento Anterior (Canino a Canino)</span>
                    <span className="font-mono text-slate-600">Subtotal: {somaInfAnterior.toFixed(1)} mm</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Central */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">Incisivo Central</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (41)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_41}
                            onChange={(e) => handleInputChange('inf_41', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (31)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_31}
                            onChange={(e) => handleInputChange('inf_31', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lateral */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">Incisivo Lateral</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (42)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_42}
                            onChange={(e) => handleInputChange('inf_42', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (32)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_32}
                            onChange={(e) => handleInputChange('inf_32', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Canino */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">Canino</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (43)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_43}
                            onChange={(e) => handleInputChange('inf_43', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (33)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_33}
                            onChange={(e) => handleInputChange('inf_33', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dentes Posteriores Inferiores */}
                <div className="pt-3 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Segmento Posterior (Premolares e 1º Molar)</span>
                    <span className="font-mono text-slate-600">Subtotal: {somaInfPosterior.toFixed(1)} mm</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1º Pré-molar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">1º Pré-molar</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (44)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_44}
                            onChange={(e) => handleInputChange('inf_44', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (34)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_34}
                            onChange={(e) => handleInputChange('inf_34', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2º Pré-molar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">2º Pré-molar</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (45)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_45}
                            onChange={(e) => handleInputChange('inf_45', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (35)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_35}
                            onChange={(e) => handleInputChange('inf_35', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 1º Molar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block text-center">1º Molar</span>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500">
                        <div>
                          <span>Direito (46)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_46}
                            onChange={(e) => handleInputChange('inf_46', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                        <div>
                          <span>Esquerdo (36)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="mm"
                            value={teeth.inf_36}
                            onChange={(e) => handleInputChange('inf_36', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão Principal de Processar */}
          <div className="flex items-center justify-center pt-2">
            <button
              type="submit"
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Calculator className="w-5 h-5" />
              <span>Calcular Análise de Bolton</span>
            </button>
          </div>
        </form>

        {/* PAINEL DE RESULTADOS DA ANÁLISE */}
        {calculated && (
          <div id="painel-resultados" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Resultado do Diagnóstico de Bolton</h3>
                  <p className="text-xs text-slate-500">Resumo estatístico dos índices anterior e total</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Processado com Sucesso
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CARD 1: ÍNDICE ANTERIOR */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Índice Anterior (6 dentes)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Ideal: 77,2%</span>
                </div>

                {isAnteriorValid ? (
                  <>
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-3xl font-extrabold text-slate-900 font-mono">
                          {ratioAnterior.toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500 ml-2 font-medium">calculado</span>
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-slate-500 block">Soma Mandibular: <strong>{somaInfAnterior.toFixed(1)} mm</strong></span>
                        <span className="text-slate-500 block">Soma Maxilar: <strong>{somaSupAnterior.toFixed(1)} mm</strong></span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80">
                      {(() => {
                        const info = formatDiscrepancia(discrepanciaAnterior);
                        return (
                          <div className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
                            info.type === 'ideal'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : info.type === 'mandibular'
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">{info.text}</p>
                              <p className="text-[11px] font-normal opacity-90 mt-0.5">
                                Mandíbula ideal necessária para esta maxila: <strong>{idealInfAnterior.toFixed(1)} mm</strong>
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-slate-100 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Preencha os 6 dentes anteriores superiores e inferiores para calcular.</span>
                  </div>
                )}
              </div>

              {/* CARD 2: ÍNDICE TOTAL (OVERALL) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    2. Índice Total (12 dentes)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Ideal: 91,3%</span>
                </div>

                {isTotalValid ? (
                  <>
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-3xl font-extrabold text-slate-900 font-mono">
                          {ratioTotal.toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500 ml-2 font-medium">calculado</span>
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-slate-500 block">Soma Mandibular: <strong>{somaInfTotal.toFixed(1)} mm</strong></span>
                        <span className="text-slate-500 block">Soma Maxilar: <strong>{somaSupTotal.toFixed(1)} mm</strong></span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80">
                      {(() => {
                        const info = formatDiscrepancia(discrepanciaTotal);
                        return (
                          <div className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
                            info.type === 'ideal'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : info.type === 'mandibular'
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">{info.text}</p>
                              <p className="text-[11px] font-normal opacity-90 mt-0.5">
                                Mandíbula ideal necessária para esta maxila: <strong>{idealInfTotal.toFixed(1)} mm</strong>
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Índice Total Incompleto</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        O Índice Total requer a medição dos 12 dentes em cada arcada (incluindo premolares e 1ºs molares). Preencha todos os campos para visualizar a análise completa.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BoltonCalculatorPage;
