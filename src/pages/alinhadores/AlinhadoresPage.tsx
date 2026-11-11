import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  PackageCheck,
  Users,
  CalendarDays,
  Settings,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Turma, AlinhadorConfig, TEMPLATE_MENSAGEM_PADRAO } from '@/lib/alinhadoresTypes';
import { listarTurmas, obterConfig, salvarConfig } from '@/lib/alinhadoresService';
import { AlinhadoresPedidosTab } from '@/components/alinhadores/AlinhadoresPedidosTab';
import { AlinhadoresPacientesTab } from '@/components/alinhadores/AlinhadoresPacientesTab';
import { AlinhadoresCalendarioTab } from '@/components/alinhadores/AlinhadoresCalendarioTab';
import { AlinhadoresConfiguracaoTab } from '@/components/alinhadores/AlinhadoresConfiguracaoTab';

type AbaAlinhadores =
  | 'pedidos'
  | 'pacientes_alinhadores'
  | 'pacientes_ortopedicos'
  | 'calendario'
  | 'configuracoes';

export const AlinhadoresPage: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<AbaAlinhadores>('pedidos');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string>('');
  const [config, setConfig] = useState<AlinhadorConfig>({
    id: true,
    antecedencia_dias: 20,
    quantidade_por_pedido: 2,
    template_mensagem: TEMPLATE_MENSAGEM_PADRAO
  });
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregarDadosIniciais = async () => {
      try {
        setCarregando(true);
        setErro(null);

        const [listaTurmas, configCarregada] = await Promise.all([
          listarTurmas(),
          obterConfig()
        ]);

        setTurmas(listaTurmas);
        setConfig(configCarregada);

        if (listaTurmas.length > 0) {
          setTurmaSelecionadaId(listaTurmas[0].id);
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados iniciais de alinhadores e ortopedicos:', err);
        setErro(err.message || 'Erro ao carregar dados do modulo.');
      } finally {
        setCarregando(false);
      }
    };

    carregarDadosIniciais();
  }, []);

  const handleSalvarConfig = async (novosDados: Partial<AlinhadorConfig>) => {
    const atualizada = await salvarConfig(novosDados);
    setConfig(atualizada);
  };

  return (
    <DashboardLayout
      pageTitle="Modulo de Alinhadores e Ortopedicos"
      pageSubtitle="Controle de solicitacoes, aparelhos ortopedicos, datas de clinica e acompanhamento de pacientes"
    >
      <div className="space-y-6">
        {/* Barra de Selecao de Abas Internas */}
        <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex items-center gap-1 flex-wrap">
          {/* Aba 1: Pedidos */}
          <button
            type="button"
            onClick={() => setAbaAtiva('pedidos')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'pedidos'
                ? 'bg-brand-50 text-brand-700 shadow-xs border border-brand-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Pedidos</span>
          </button>

          {/* Aba 2: Pacientes Alinhadores */}
          <button
            type="button"
            onClick={() => setAbaAtiva('pacientes_alinhadores')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'pacientes_alinhadores'
                ? 'bg-brand-50 text-brand-700 shadow-xs border border-brand-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Pacientes Alinhadores</span>
          </button>

          {/* Aba 3: Pacientes Ortopedicos */}
          <button
            type="button"
            onClick={() => setAbaAtiva('pacientes_ortopedicos')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'pacientes_ortopedicos'
                ? 'bg-purple-50 text-purple-700 shadow-xs border border-purple-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4 text-purple-600" />
            <span>Pacientes Ortopedicos</span>
          </button>

          {/* Aba 4: Calendario */}
          <button
            type="button"
            onClick={() => setAbaAtiva('calendario')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'calendario'
                ? 'bg-brand-50 text-brand-700 shadow-xs border border-brand-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Calendario Clinico</span>
          </button>

          {/* Aba 5: Configuracoes */}
          <button
            type="button"
            onClick={() => setAbaAtiva('configuracoes')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'configuracoes'
                ? 'bg-brand-50 text-brand-700 shadow-xs border border-brand-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configuracoes</span>
          </button>
        </div>

        {/* Estado de Carregamento Global */}
        {carregando ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="font-semibold text-slate-700">Carregando modulo de alinhadores e ortopedicos...</p>
          </div>
        ) : erro ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-xs text-rose-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-900">Falha ao inicializar o modulo</h4>
              <p className="mt-1">{erro}</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Secao A: PEDIDOS (Principal) */}
            {abaAtiva === 'pedidos' && (
              <AlinhadoresPedidosTab
                config={config}
                turmas={turmas}
                turmaSelecionadaId={turmaSelecionadaId}
                onSelecionarTurma={setTurmaSelecionadaId}
                onIrParaCalendario={() => setAbaAtiva('calendario')}
              />
            )}

            {/* Secao B1: PACIENTES ALINHADORES */}
            {abaAtiva === 'pacientes_alinhadores' && (
              <AlinhadoresPacientesTab
                turmas={turmas}
                turmaSelecionadaId={turmaSelecionadaId}
                onSelecionarTurma={setTurmaSelecionadaId}
                onIrParaCalendario={() => setAbaAtiva('calendario')}
                tipo="alinhador"
              />
            )}

            {/* Secao B2: PACIENTES ORTOPEDICOS */}
            {abaAtiva === 'pacientes_ortopedicos' && (
              <AlinhadoresPacientesTab
                turmas={turmas}
                turmaSelecionadaId={turmaSelecionadaId}
                onSelecionarTurma={setTurmaSelecionadaId}
                onIrParaCalendario={() => setAbaAtiva('calendario')}
                tipo="ortopedico"
              />
            )}

            {/* Secao C: CALENDARIO */}
            {abaAtiva === 'calendario' && (
              <AlinhadoresCalendarioTab
                turmas={turmas}
                turmaSelecionadaId={turmaSelecionadaId}
                onSelecionarTurma={setTurmaSelecionadaId}
              />
            )}

            {/* Secao D: CONFIGURACOES */}
            {abaAtiva === 'configuracoes' && (
              <AlinhadoresConfiguracaoTab
                config={config}
                onSalvarConfig={handleSalvarConfig}
              />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlinhadoresPage;
