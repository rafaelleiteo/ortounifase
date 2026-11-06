import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  FolderArchive,
  UploadCloud,
  Search,
  Download,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  FileCheck,
  File
} from 'lucide-react';
import {
  ArquivoAdmin,
  formatarTamanho,
  extrairExtensao,
  validarArquivo,
  ProgressoUploadItem
} from '@/lib/arquivosTypes';
import {
  listarArquivos,
  enviarArquivo,
  obterUrlDownload,
  editarArquivo,
  substituirArquivo,
  apagarArquivo
} from '@/lib/arquivosService';

export const ArquivosPage: React.FC = () => {
  const [arquivos, setArquivos] = useState<ArquivoAdmin[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState<string>('');

  // Sequência de requisições para evitar race conditions em respostas fora de ordem
  const requestSeqRef = useRef<number>(0);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [filaUpload, setFilaUpload] = useState<ProgressoUploadItem[]>([]);
  const [enviando, setEnviando] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [arquivoEditando, setArquivoEditando] = useState<ArquivoAdmin | null>(null);
  const [formNome, setFormNome] = useState<string>('');
  const [formDescricao, setFormDescricao] = useState<string>('');
  const [salvandoEdicao, setSalvandoEdicao] = useState<boolean>(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [arquivoSubstituindo, setArquivoSubstituindo] = useState<ArquivoAdmin | null>(null);
  const [novoArquivoSubstituicao, setNovoArquivoSubstituicao] = useState<File | null>(null);
  const [substituindo, setSubstituindo] = useState<boolean>(false);
  const [erroSubstituicao, setErroSubstituicao] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [arquivoApagando, setArquivoApagando] = useState<ArquivoAdmin | null>(null);
  const [apagando, setApagando] = useState<boolean>(false);
  const [erroApagando, setErroApagando] = useState<string | null>(null);

  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const carregarDados = async (termoBusca?: string) => {
    const currentSeq = ++requestSeqRef.current;
    try {
      setCarregando(true);
      setErro(null);
      const lista = await listarArquivos(termoBusca);
      if (currentSeq === requestSeqRef.current) {
        setArquivos(lista);
      }
    } catch (err: any) {
      if (currentSeq === requestSeqRef.current) {
        console.error('Erro ao listar arquivos:', err);
        setErro(err.message || 'Erro ao carregar arquivos.');
      }
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setCarregando(false);
      }
    }
  };

  // Busca com atraso de 300 ms (debounce) e cancelamento de timers pendentes
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados(busca);
    }, 300);

    return () => clearTimeout(timer);
  }, [busca]);

  const renderIconeArquivo = (nome: string) => {
    const ext = extrairExtensao(nome);
    if (['pdf'].includes(ext)) {
      return <FileText className="w-5 h-5 text-rose-600 shrink-0" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    if (['doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext)) {
      return <FileCheck className="w-5 h-5 text-brand-600 shrink-0" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FolderArchive className="w-5 h-5 text-amber-600 shrink-0" />;
    }
    if (['json', 'xml'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-purple-600 shrink-0" />;
    }
    return <File className="w-5 h-5 text-slate-500 shrink-0" />;
  };

  const processarArquivos = async (arquivosParaEnviar: File[]) => {
    if (!arquivosParaEnviar || arquivosParaEnviar.length === 0) return;

    const novaFila: ProgressoUploadItem[] = arquivosParaEnviar.map((f) => {
      const validacao = validarArquivo(f);
      return {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        nomeArquivo: f.name,
        tamanhoBytes: f.size,
        progresso: 0,
        status: validacao.valido ? 'pendente' : 'erro',
        erro: validacao.erro
      };
    });

    setFilaUpload((prev) => [...prev, ...novaFila]);
    setEnviando(true);

    for (let i = 0; i < arquivosParaEnviar.length; i++) {
      const file = arquivosParaEnviar[i];
      const itemFila = novaFila[i];

      if (itemFila.status === 'erro') continue;

      setFilaUpload((prev) =>
        prev.map((item) => (item.id === itemFila.id ? { ...item, status: 'enviando', progresso: 40 } : item))
      );

      try {
        await enviarArquivo({ file });
        setFilaUpload((prev) =>
          prev.map((item) => (item.id === itemFila.id ? { ...item, status: 'concluido', progresso: 100 } : item))
        );
      } catch (err: any) {
        setFilaUpload((prev) =>
          prev.map((item) =>
            item.id === itemFila.id ? { ...item, status: 'erro', erro: err.message || 'Falha no envio.' } : item
          )
        );
      }
    }

    setEnviando(false);
    await carregarDados(busca);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      processarArquivos(filesArray);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      processarArquivos(filesArray);
    }
  };

  const handleDownload = async (arquivo: ArquivoAdmin) => {
    try {
      setBaixandoId(arquivo.id);
      setErro(null);
      const urlAssinada = await obterUrlDownload(arquivo.caminho_storage, arquivo.nome_original);
      const link = document.createElement('a');
      link.href = urlAssinada;
      link.setAttribute('download', arquivo.nome_original);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setErro(`Não foi possível baixar o arquivo "${arquivo.nome}": ${err.message || 'Erro de download'}`);
    } finally {
      setBaixandoId(null);
    }
  };

  const handleAbrirEdicao = (arquivo: ArquivoAdmin) => {
    setArquivoEditando(arquivo);
    setFormNome(arquivo.nome);
    setFormDescricao(arquivo.descricao || '');
    setErroEdicao(null);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivoEditando) return;

    if (!formNome.trim()) {
      setErroEdicao('O nome do arquivo não pode ficar em branco.');
      return;
    }

    try {
      setSalvandoEdicao(true);
      setErroEdicao(null);
      await editarArquivo({
        id: arquivoEditando.id,
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null
      });
      setArquivoEditando(null);
      await carregarDados(busca);
    } catch (err: any) {
      setErroEdicao(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleAbrirSubstituicao = (arquivo: ArquivoAdmin) => {
    setArquivoSubstituindo(arquivo);
    setNovoArquivoSubstituicao(null);
    setErroSubstituicao(null);
  };

  const handleConfirmarSubstituicao = async () => {
    if (!arquivoSubstituindo || !novoArquivoSubstituicao) return;

    const validacao = validarArquivo(novoArquivoSubstituicao);
    if (!validacao.valido) {
      setErroSubstituicao(validacao.erro || 'Arquivo inválido.');
      return;
    }

    try {
      setSubstituindo(true);
      setErroSubstituicao(null);
      const res = await substituirArquivo(arquivoSubstituindo, novoArquivoSubstituicao);
      if (res.avisoRemocaoAntigo) {
        setAviso(res.avisoRemocaoAntigo);
      } else {
        setAviso(null);
      }
      setArquivoSubstituindo(null);
      setNovoArquivoSubstituicao(null);
      await carregarDados(busca);
    } catch (err: any) {
      setErroSubstituicao(err.message || 'Erro ao substituir arquivo.');
    } finally {
      setSubstituindo(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!arquivoApagando) return;

    try {
      setApagando(true);
      setErroApagando(null);
      await apagarArquivo(arquivoApagando);
      setArquivoApagando(null);
      await carregarDados(busca);
    } catch (err: any) {
      setErroApagando(err.message || 'Erro ao apagar arquivo.');
    } finally {
      setApagando(false);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Repositório de Arquivos"
      pageSubtitle="Repositório interno e seguro de documentos e anexos da coordenação"
    >
      <div className="space-y-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all bg-white shadow-xs ${
            isDragging
              ? 'border-brand-500 bg-brand-50/50 scale-[1.005]'
              : 'border-slate-300 hover:border-brand-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-brand-50 text-brand-700 rounded-full">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800">
                Arraste e solte arquivos aqui, ou{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-brand-600 hover:text-brand-700 underline font-semibold cursor-pointer"
                >
                  procure no seu computador
                </button>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Limite máximo de 50 MB por arquivo. Extensões executáveis são bloqueadas por segurança.
              </p>
            </div>
          </div>
        </div>

        {filaUpload.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>Uploads Recentes / Em Andamento</span>
                {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />}
              </h4>
              <button
                type="button"
                onClick={() => setFilaUpload([])}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Limpar lista
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filaUpload.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.status === 'concluido' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {item.status === 'erro' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    {item.status === 'enviando' && <Loader2 className="w-4 h-4 animate-spin text-brand-600 shrink-0" />}
                    {item.status === 'pendente' && <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />}

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">{item.nomeArquivo}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatarTamanho(item.tamanhoBytes)}
                        {item.erro && <span className="text-rose-600 font-medium ml-2">{item.erro}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'concluido'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'erro'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-brand-100 text-brand-800'
                      }`}
                    >
                      {item.status === 'concluido' && 'Concluído'}
                      {item.status === 'erro' && 'Falhou'}
                      {item.status === 'enviando' && 'Enviando...'}
                      {item.status === 'pendente' && 'Aguardando'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar arquivo por nome..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => carregarDados(busca)}
              disabled={carregando}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Enviar Arquivo</span>
            </button>
          </div>
        </div>

        {/* Banner de Aviso (ex: substituição com falha de remoção do antigo) */}
        {aviso && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-900">Aviso do Sistema</h4>
              <p className="text-xs text-amber-700 mt-0.5">{aviso}</p>
            </div>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="p-1 text-amber-500 hover:text-amber-800 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Alerta de Erro Geral */}
        {erro && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-rose-900">Erro no repositório</h4>
              <p className="text-xs text-rose-700 mt-0.5">{erro}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setErro(null);
                carregarDados(busca);
              }}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded text-xs font-semibold cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Tabela de Arquivos */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {carregando ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-xs font-medium">Carregando lista de arquivos...</p>
            </div>
          ) : arquivos.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FolderArchive className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Nenhum arquivo encontrado</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {busca
                  ? `Nenhum arquivo corresponde ao termo "${busca}".`
                  : 'Nenhum documento foi enviado ao repositório ainda.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Arquivo</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Tamanho</th>
                    <th className="py-3 px-4">Data de Envio</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                  {arquivos.map((arq) => {
                    const extUpper = extrairExtensao(arq.nome_original).toUpperCase() || 'ARQUIVO';
                    return (
                      <tr key={arq.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Arquivo / Nome */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            {renderIconeArquivo(arq.nome_original)}
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-xs leading-snug">{arq.nome}</p>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                                {arq.nome_original}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Tipo (Extensão em maiúsculas) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                            {extUpper}
                          </span>
                        </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {arq.descricao || <span className="text-slate-400 italic">Sem descrição</span>}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-600">
                        {formatarTamanho(arq.tamanho_bytes)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {new Date(arq.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownload(arq)}
                            disabled={baixandoId === arq.id}
                            title="Baixar arquivo (link assinado seguro)"
                            className="p-1.5 text-slate-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors cursor-pointer"
                          >
                            {baixandoId === arq.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAbrirEdicao(arq)}
                            title="Editar nome e descrição"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAbrirSubstituicao(arq)}
                            title="Substituir arquivo por nova versão"
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setArquivoApagando(arq);
                              setErroApagando(null);
                            }}
                            title="Excluir arquivo permanentemente"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>

        {arquivoEditando && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-brand-600" />
                  <span>Editar Arquivo</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setArquivoEditando(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSalvarEdicao} className="p-4 space-y-4">
                {erroEdicao && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                    {erroEdicao}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Exibido <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Nome amigável exibido na listagem para os usuários.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                  <textarea
                    rows={3}
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Adicione observações ou detalhes sobre este documento..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setArquivoEditando(null)}
                    disabled={salvandoEdicao}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoEdicao}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {salvandoEdicao && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {arquivoSubstituindo && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                  <span>Substituir Arquivo</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setArquivoSubstituindo(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-xs text-slate-600">
                  Você está substituindo o arquivo <strong className="text-slate-800">{arquivoSubstituindo.nome}</strong>. O novo conteúdo será enviado e o arquivo antigo será removido do servidor.
                </p>

                {erroSubstituicao && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                    {erroSubstituicao}
                  </div>
                )}

                <input
                  ref={replaceInputRef}
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setNovoArquivoSubstituicao(e.target.files[0]);
                      setErroSubstituicao(null);
                    }
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => replaceInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-lg p-5 text-center cursor-pointer bg-slate-50 hover:bg-amber-50/30 transition-colors"
                >
                  <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  {novoArquivoSubstituicao ? (
                    <div>
                      <p className="text-xs font-bold text-slate-800">{novoArquivoSubstituicao.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{formatarTamanho(novoArquivoSubstituicao.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Clique para selecionar o novo arquivo</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Máximo de 50 MB</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setArquivoSubstituindo(null)}
                    disabled={substituindo}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarSubstituicao}
                    disabled={substituindo || !novoArquivoSubstituicao}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {substituindo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirmar Substituição</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {arquivoApagando && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-full">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Excluir Arquivo</h3>
                  <p className="text-[11px] text-slate-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-600">
                  Tem certeza de que deseja apagar o arquivo <strong className="text-slate-800">{arquivoApagando.nome}</strong>? Ele será excluído permanentemente do servidor e do banco de dados.
                </p>

                {erroApagando && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                    {erroApagando}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setArquivoApagando(null)}
                    disabled={apagando}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarExclusao}
                    disabled={apagando}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {apagando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Sim, Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ArquivosPage;
