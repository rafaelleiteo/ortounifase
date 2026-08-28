import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Package,
  Search,
  Plus,
  ShoppingCart,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  X,
  FilePlus2,
  Lock,
  Tag
} from 'lucide-react';

export interface Material {
  id: string;
  descricao_completa: string;
  unidade: string;
  categoria?: string;
  marca?: string;
  quantidade_referencia?: number;
  criado_em?: string;
}

export interface CartItem {
  id: string;
  material_id: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  isManual: boolean;
}

export const MateriaisPage: React.FC = () => {
  const { user, hasPermission } = useAuth();

  const canView = hasPermission('materiais', false);
  const canEdit = hasPermission('materiais', true);

  // States
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Quantities for catalog items before adding to cart
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Cart state (Local React Session State)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Manual Item Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualDescricao, setManualDescricao] = useState<string>('');
  const [manualUnidade, setManualUnidade] = useState<string>('Unidade');
  const [manualQuantidade, setManualQuantidade] = useState<number>(1);

  // Edit Material Modal
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editDescricao, setEditDescricao] = useState<string>('');
  const [editUnidade, setEditUnidade] = useState<string>('');
  const [editCategoria, setEditCategoria] = useState<string>('');
  const [editMarca, setEditMarca] = useState<string>('');
  const [editQtdRef, setEditQtdRef] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Order Submission State
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<{ pedidoId: string; timestamp: string } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Fetch materials from Supabase
  const fetchMateriais = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('materiais')
        .select('*')
        .order('descricao_completa', { ascending: true });

      if (error) {
        console.error('Erro ao buscar materiais:', error);
      } else {
        setMateriais(data || []);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchMateriais();
    } else {
      setLoading(false);
    }
  }, [canView]);

  // Filtered materials
  const filteredMateriais = materiais.filter((m) =>
    m.descricao_completa.toLowerCase().includes(search.toLowerCase()) ||
    (m.categoria && m.categoria.toLowerCase().includes(search.toLowerCase())) ||
    (m.marca && m.marca.toLowerCase().includes(search.toLowerCase()))
  );

  // Cart Handlers
  const handleAddToCart = (material: Material) => {
    const qtd = itemQuantities[material.id] || 1;
    const existingIndex = cart.findIndex((item) => item.material_id === material.id);

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantidade += qtd;
      setCart(updatedCart);
    } else {
      const newItem: CartItem = {
        id: `cat-${material.id}-${Date.now()}`,
        material_id: material.id,
        descricao: material.descricao_completa,
        unidade: material.unidade,
        quantidade: qtd,
        isManual: false,
      };
      setCart([...cart, newItem]);
    }
    // Reset temporary quantity input
    setItemQuantities({ ...itemQuantities, [material.id]: 1 });
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDescricao.trim()) return;

    const newItem: CartItem = {
      id: `manual-${Date.now()}`,
      material_id: null,
      descricao: manualDescricao.trim(),
      unidade: manualUnidade.trim() || 'Unidade',
      quantidade: manualQuantidade > 0 ? manualQuantidade : 1,
      isManual: true,
    };

    setCart([...cart, newItem]);
    setManualDescricao('');
    setManualUnidade('Unidade');
    setManualQuantidade(1);
    setShowManualModal(false);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleUpdateCartQuantity = (id: string, newQtd: number) => {
    if (newQtd <= 0) {
      handleRemoveFromCart(id);
      return;
    }
    setCart(cart.map((item) => (item.id === id ? { ...item, quantidade: newQtd } : item)));
  };

  // Edit Material Handlers
  const handleOpenEdit = (material: Material) => {
    setEditingMaterial(material);
    setEditDescricao(material.descricao_completa);
    setEditUnidade(material.unidade);
    setEditCategoria(material.categoria || '');
    setEditMarca(material.marca || '');
    setEditQtdRef(material.quantidade_referencia ? String(material.quantidade_referencia) : '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('materiais')
        .update({
          descricao_completa: editDescricao.trim(),
          unidade: editUnidade.trim(),
          categoria: editCategoria.trim() || null,
          marca: editMarca.trim() || null,
          quantidade_referencia: editQtdRef ? parseFloat(editQtdRef) : null,
        })
        .eq('id', editingMaterial.id);

      if (error) {
        alert(`Erro ao salvar material: ${error.message}`);
      } else {
        setEditingMaterial(null);
        await fetchMateriais();
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Finalize Order Handler
  const handleFinalizeOrder = async () => {
    if (cart.length === 0 || !user) return;

    setSubmittingOrder(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      // 1. Inserir registro na tabela pedidos
      const { data: newPedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          usuario_id: user.id,
          status: 'rascunho',
          email_destino: 'rafael.leite@prof.unifase-rj.edu.br',
        })
        .select()
        .single();

      if (pedidoError || !newPedido) {
        throw new Error(`Erro ao criar pedido: ${pedidoError?.message}`);
      }

      // 2. Inserir itens do carrinho na tabela itens_pedido
      const itensToInsert = cart.map((item) => ({
        pedido_id: newPedido.id,
        material_id: item.material_id,
        descricao_manual: item.isManual ? item.descricao : null,
        quantidade: item.quantidade,
        unidade: item.unidade,
      }));

      const { error: itensError } = await supabase.from('itens_pedido').insert(itensToInsert);

      if (itensError) {
        throw new Error(`Erro ao salvar itens do pedido: ${itensError.message}`);
      }

      // 3. Chamar Edge Function enviar-pedido
      const { error: fnError } = await supabase.functions.invoke('enviar-pedido', {
        body: { pedido_id: newPedido.id },
      });

      if (fnError) {
        console.warn('Alerta no disparo da Edge Function:', fnError);
      }

      // 4. Confirmação e limpeza do carrinho local
      setOrderSuccess({
        pedidoId: newPedido.id,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
      setCart([]);
    } catch (err: any) {
      setOrderError(err.message || 'Ocorreu um erro ao processar seu pedido.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Access Denied Screen if user does not have view permission
  if (!canView) {
    return (
      <DashboardLayout pageTitle="Catálogo de Materiais" pageSubtitle="Módulo de Gestão de Almoxarifado">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-4 border border-amber-200">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Acesso Restrito</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sua conta atual não possui permissão de visualização para o módulo de <strong>Materiais</strong>.
            Entre em contato com o Coordenador para solicitar acesso.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      pageTitle="Catálogo de Materiais"
      pageSubtitle="Consulte insumos clínicos, solicite itens pré-cadastrados ou adicione demandas avulsas"
    >
      <div className="space-y-6">
        {/* Order Success Alert Banner */}
        {orderSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 animate-fadeIn">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-950">Pedido Enviado com Sucesso!</h4>
                <span className="text-[11px] font-mono text-emerald-700">{orderSuccess.timestamp}</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                O pedido <strong>#{orderSuccess.pedidoId.substring(0, 8)}</strong> foi registrado e notificado para o e-mail de destino (<code>rafael.leite@prof.unifase-rj.edu.br</code>).
              </p>
            </div>
            <button
              onClick={() => setOrderSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Order Error Alert Banner */}
        {orderError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-rose-900">Erro ao Processar Pedido</h4>
              <p className="text-xs text-rose-700 mt-0.5">{orderError}</p>
            </div>
            <button onClick={() => setOrderError(null)} className="text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Controls: Search & Add Manual Item */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição, categoria ou marca..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 shadow-xs"
            />
          </div>

          <button
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <FilePlus2 className="w-4 h-4 text-brand-600" />
            <span>Adicionar Item Manual</span>
          </button>
        </div>

        {/* Main Grid: Materials List + Cart Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Catalog List (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-800">Insumos Pré-Cadastrados</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {filteredMateriais.length} item(ns) encontrado(s)
                </span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                  <span className="text-xs">Carregando catálogo de materiais...</span>
                </div>
              ) : filteredMateriais.length === 0 ? (
                /* EMPTY STATE */
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <Package className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Nenhum Material Cadastrado</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    A tabela de materiais está vazia. Você pode utilizar o botão <strong>"Adicionar Item Manual"</strong> acima para incluir demandas avulsas diretamente no carrinho.
                  </p>
                </div>
              ) : (
                /* LIST OF MATERIALS */
                <div className="space-y-3">
                  {filteredMateriais.map((mat) => {
                    const currentQtd = itemQuantities[mat.id] || 1;
                    return (
                      <div
                        key={mat.id}
                        className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-800">{mat.descricao_completa}</h4>
                            {mat.categoria && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                                {mat.categoria}
                              </span>
                            )}
                            {mat.marca && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5 text-slate-500" />
                                {mat.marca}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mt-1">
                            <span>Unidade: {mat.unidade}</span>
                            {mat.quantidade_referencia && (
                              <span>Qtd. Ref: {mat.quantidade_referencia}</span>
                            )}
                          </div>
                        </div>

                        {/* Controls: Quantity + Add to Cart + Edit */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                setItemQuantities({
                                  ...itemQuantities,
                                  [mat.id]: Math.max(1, currentQtd - 1),
                                })
                              }
                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={currentQtd}
                              onChange={(e) =>
                                setItemQuantities({
                                  ...itemQuantities,
                                  [mat.id]: parseInt(e.target.value) || 1,
                                })
                              }
                              className="w-10 text-center text-xs font-bold text-slate-800 border-none focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setItemQuantities({
                                  ...itemQuantities,
                                  [mat.id]: currentQtd + 1,
                                })
                              }
                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => handleAddToCart(mat)}
                            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </button>

                          {/* Edit Button (Visible ONLY if user has pode_editar = true) */}
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(mat)}
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                              title="Editar Material no Banco"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Local Session Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-20">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-800">Seu Carrinho</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  {cart.length} item(ns)
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-medium">Seu carrinho está vazio.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Adicione materiais da lista ou crie itens manuais para solicitar.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items List */}
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-bold text-slate-800 truncate">{item.descricao}</h5>
                            {item.isManual && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Manual
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">Unidade: {item.unidade}</span>

                          {/* Quantity control inside cart */}
                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-[10px] font-semibold text-slate-600">Qtd:</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                handleUpdateCartQuantity(item.id, parseInt(e.target.value) || 1)
                              }
                              className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-center text-xs font-bold text-slate-800"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remover do carrinho"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Finalize Order Action */}
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <button
                      onClick={handleFinalizeOrder}
                      disabled={submittingOrder}
                      className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                    >
                      {submittingOrder ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processando Pedido...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Finalizar Pedido</span>
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-slate-400 text-center leading-tight">
                      O pedido será registrado e disparado automaticamente para o e-mail cadastrado via Edge Function.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Adicionar Item Manual */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-800">Adicionar Item Manual</h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição Livre do Material *
                </label>
                <input
                  type="text"
                  value={manualDescricao}
                  onChange={(e) => setManualDescricao(e.target.value)}
                  placeholder="Ex: Fio ortodôntico Niti .016 especial..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade *</label>
                  <input
                    type="number"
                    min="1"
                    value={manualQuantidade}
                    onChange={(e) => setManualQuantidade(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade *</label>
                  <input
                    type="text"
                    value={manualUnidade}
                    onChange={(e) => setManualUnidade(e.target.value)}
                    placeholder="Ex: Caixa, Pacote, Unidade"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  Incluir no Carrinho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Material no Banco (Requer pode_editar = true) */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-800">Editar Material no Banco</h3>
              </div>
              <button
                onClick={() => setEditingMaterial(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição Completa *
                </label>
                <input
                  type="text"
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade *</label>
                  <input
                    type="text"
                    value={editUnidade}
                    onChange={(e) => setEditUnidade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={editCategoria}
                    onChange={(e) => setEditCategoria(e.target.value)}
                    placeholder="Ex: Ortodontia, Consumo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={editMarca}
                    onChange={(e) => setEditMarca(e.target.value)}
                    placeholder="Ex: Morelli, 3M"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Qtd. Referência</label>
                  <input
                    type="number"
                    step="any"
                    value={editQtdRef}
                    onChange={(e) => setEditQtdRef(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMaterial(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
