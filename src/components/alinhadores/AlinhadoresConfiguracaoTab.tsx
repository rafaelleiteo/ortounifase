import React, { useState } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import {
  AlinhadorConfig,
  TEMPLATE_MENSAGEM_PADRAO,
  gerarMensagemEmpresa,
  PedidoParaMensagem
} from '@/lib/alinhadoresTypes';

interface AlinhadoresConfiguracaoTabProps {
  config: AlinhadorConfig;
  onSalvarConfig: (novaConfig: Partial<AlinhadorConfig>) => Promise<void>;
}

export const AlinhadoresConfiguracaoTab: React.FC<AlinhadoresConfiguracaoTabProps> = ({
  config,
  onSalvarConfig
}) => {
  const [antecedencia, setAntecedencia] = useState<number>(config.antecedencia_dias || 20);
  const [quantidadePorPedido, setQuantidadePorPedido] = useState<number>(
    config.quantidade_por_pedido || 2
  );
  const [template, setTemplate] = useState<string>(
    config.template_mensagem || TEMPLATE_MENSAGEM_PADRAO
  );
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Pacientes fictícios para pré-visualização ao vivo
  const pedidosExemplo: PedidoParaMensagem[] = [
    {
      paciente_nome: 'Ana Silva',
      data_retorno: '2026-11-15',
      alinhador_de: 1,
      alinhador_ate: 2
    },
    {
      paciente_nome: 'Bruno Castro',
      data_retorno: '2026-11-15',
      alinhador_de: 3,
      alinhador_ate: 4
    }
  ];

  const mensagemPrevia = gerarMensagemEmpresa(pedidosExemplo, template);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (antecedencia < 1 || antecedencia > 90) {
      setErro('A antecedência deve ser um valor entre 1 e 90 dias.');
      return;
    }

    if (quantidadePorPedido < 1) {
      setErro('A quantidade padrão por pedido deve ser pelo menos 1.');
      return;
    }

    if (!template.trim()) {
      setErro('O modelo de mensagem não pode ser vazio.');
      return;
    }

    try {
      setSalvando(true);
      await onSalvarConfig({
        antecedencia_dias: Number(antecedencia),
        quantidade_por_pedido: Number(quantidadePorPedido),
        template_mensagem: template.trim()
      });
      setSucesso('Configurações salvas com sucesso!');
      setTimeout(() => setSucesso(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPadrao = () => {
    setTemplate(TEMPLATE_MENSAGEM_PADRAO);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold text-slate-800">
              Configurações do Módulo de Alinhadores
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalize a antecedência para alertas de pedidos, quantidade sugerida de alinhadores e o modelo de mensagem enviado à empresa.
          </p>
        </div>
      </div>

      {/* Alertas de Sucesso e Erro */}
      {sucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      <form onSubmit={handleSalvar} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Prazos e Quantidades */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Prazos e Parâmetros</span>
            </h4>

            {/* Antecedência em Dias */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Antecedência do Pedido (em dias) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={antecedencia}
                  onChange={(e) => setAntecedencia(Number(e.target.value))}
                  className="w-24 text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
                <span className="text-xs text-slate-600 font-medium">dias antes da consulta de retorno</span>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                "Me avisar se não pedi até {antecedencia} dias antes do retorno"
              </p>
            </div>

            {/* Quantidade Padrão por Pedido */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Quantidade Padrão de Alinhadores por Pedido <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={quantidadePorPedido}
                  onChange={(e) => setQuantidadePorPedido(Number(e.target.value))}
                  className="w-24 text-sm font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
                <span className="text-xs text-slate-600 font-medium">alinhadores por lote sugerido</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Utilizado na ferramenta de sugestão de numeração na tabela de pedidos (ex: se o último foi o 2, sugere de 3 a {2 + Number(quantidadePorPedido)}).
              </p>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Aplicação em tempo real:</span>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Ao alterar a antecedência, os prazos limites e os status (atrasado, vencendo e pendente) são recalculados imediatamente em toda a aplicação.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Editor do Modelo de Mensagem */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-600" />
                <span>Modelo de Mensagem para a Empresa</span>
              </h4>
              <button
                type="button"
                onClick={handleRestaurarPadrao}
                className="text-[11px] font-semibold text-slate-500 hover:text-brand-600 flex items-center gap-1 cursor-pointer transition-colors"
                title="Restaurar o modelo padrão inicial"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar padrão</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                Texto do template:
              </label>
              <textarea
                rows={6}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full text-xs font-sans p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            {/* Dica dos Marcadores */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <HelpCircle className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Marcadores disponíveis para inclusão:</span>
              </div>
              <ul className="text-[11px] space-y-1 text-slate-600 pl-1">
                <li>
                  <code className="font-bold text-brand-700 bg-brand-50 px-1 py-0.5 rounded">
                    {'{lista}'}
                  </code>
                  {' - '}Lista detalhada com um paciente por linha (nome, alinhadores de/até e data de retorno).
                </li>
                <li>
                  <code className="font-bold text-brand-700 bg-brand-50 px-1 py-0.5 rounded">
                    {'{pacientes}'}
                  </code>
                  {' - '}Apenas os nomes dos pacientes no texto (ex: "Ana Silva e Bruno Castro").
                </li>
              </ul>
              <p className="text-[10px] text-slate-400 italic">
                * Se o modelo não contiver nenhum marcador, a lista detalhada será anexada automaticamente ao final.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Pré-Visualização em Tempo Real */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Pré-Visualização ao Vivo (Exemplo com 2 pacientes)</span>
            </h4>
            <span className="text-[10px] font-semibold text-slate-400">
              Atualização dinâmica enquanto você digita
            </span>
          </div>

          <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
            {mensagemPrevia}
          </pre>
        </div>

        {/* Botão Salvar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={salvando}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Salvar Configurações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
