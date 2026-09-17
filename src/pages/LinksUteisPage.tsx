import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ExternalLink,
  Link2,
  Loader2,
  AlertTriangle,
  FileText,
  Building2,
  Sparkles,
  ClipboardList,
  Globe,
  BookOpen,
  Calendar,
  UserCheck,
  SlidersHorizontal,
  ShieldCheck,
  LucideIcon
} from 'lucide-react';

export interface LinkUtil {
  id: string;
  titulo: string;
  url: string;
  icone?: string | null;
  descricao?: string | null;
  papeis_visiveis: string[];
  ordem: number;
}

const ICON_MAP: Record<string, LucideIcon> = {
  ExternalLink,
  FileText,
  ClipboardList,
  Building2,
  Globe,
  BookOpen,
  Link2,
  Calendar,
  UserCheck,
  SlidersHorizontal,
  ShieldCheck
};

export const LinksUteisPage: React.FC = () => {
  const { effectiveRole } = useAuth();
  const [links, setLinks] = useState<LinkUtil[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLinks = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from('links_uteis')
          .select('*')
          .order('ordem', { ascending: true });

        if (dbError) {
          setError(dbError.message);
        } else {
          setLinks(data || []);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar links úteis do banco de dados.');
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, []);

  // Filtra os links visíveis para o papel efetivo (Coordenador vê todos)
  const visibleLinks = links.filter((link) => {
    if (effectiveRole === 'coordenador' || effectiveRole === 'admin_master') return true;
    return link.papeis_visiveis && link.papeis_visiveis.includes(effectiveRole);
  });

  const getLinkIcon = (item: LinkUtil): LucideIcon => {
    if (item.icone && ICON_MAP[item.icone]) {
      return ICON_MAP[item.icone];
    }
    if (item.titulo.toLowerCase().includes('clinicorp')) return Building2;
    if (item.titulo.toLowerCase().includes('ficha')) return FileText;
    return Link2;
  };

  return (
    <DashboardLayout
      pageTitle="Links e Formulários Úteis"
      pageSubtitle="Acesso rápido a sistemas externos e fichas oficiais de atendimento OrtoUnifase"
    >
      <div className="space-y-6">
        {/* Banner Informativo */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shrink-0">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Atalhos Externos Oficiais
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Selecione abaixo o formulário ou sistema desejado. Os links abrem diretamente em uma nova aba do navegador para preenchimento oficial no Google Forms ou no Clinicorp.
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-medium">Carregando links úteis do Supabase...</p>
          </div>
        )}

        {/* Database Error Alert */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-5 shadow-xs flex items-start gap-3 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">Erro ao consultar a tabela 'links_uteis' no Supabase</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Grid de Cards de Links Úteis */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleLinks.map((item) => {
              const IconComponent = getLinkIcon(item);
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white border border-slate-200 hover:border-brand-300 rounded-xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {item.titulo}
                      </h4>
                      {item.descricao && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {item.descricao}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-2 font-mono truncate max-w-full">
                        {item.url}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-600 group-hover:text-brand-700">
                    <span>Acessar Link Externo</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-brand-500 flex items-center gap-1 font-normal">
                      <Sparkles className="w-2.5 h-2.5" />
                      Abre em nova aba
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LinksUteisPage;
