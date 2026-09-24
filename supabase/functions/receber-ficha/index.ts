import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

function normalizarNome(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/\s+/g, " ") // Espaços múltiplos para único
    .trim();
}

// Algoritmo de Similaridade Trigram (0.0 a 1.0)
function calcularSimilaridade(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const getTrigrams = (str: string) => {
    const s = `  ${str} `;
    const tri = new Set<string>();
    for (let i = 0; i < s.length - 2; i++) {
      tri.add(s.substring(i, i + 3));
    }
    return tri;
  };

  const t1 = getTrigrams(s1);
  const t2 = getTrigrams(s2);
  let inter = 0;
  for (const item of t1) {
    if (t2.has(item)) inter++;
  }
  const union = t1.size + t2.size - inter;
  return union === 0 ? 0 : inter / union;
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validação do Token no Header X-Webhook-Token
    const webhookToken = req.headers.get("X-Webhook-Token") || req.headers.get("x-webhook-token");
    const expectedToken = Deno.env.get("WEBHOOK_FICHA_TOKEN");

    if (!expectedToken || webhookToken !== expectedToken) {
      console.warn("🔒 Tentativa de acesso não autorizada: Token inválido ou ausente.");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Token secreto inválido ou ausente no header X-Webhook-Token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Leitura do Corpo da Requisição
    const body = await req.json();
    const { form_response_id, nome_informado, nascimento_informado, telefone, respostas } = body;

    if (!form_response_id) {
      return new Response(
        JSON.stringify({ error: "Campo obrigatório ausente: form_response_id." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Conexão Admin no Supabase via Service Role Key (Bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Idempotência: Verifica se o form_response_id já foi registrado
    const { data: fichaExistente } = await supabaseAdmin
      .from("fichas")
      .select("id, status, paciente_id")
      .eq("form_response_id", form_response_id)
      .maybeSingle();

    if (fichaExistente) {
      console.log(`ℹ️ Idempotência acionada. Ficha ${form_response_id} já cadastrada (${fichaExistente.id}).`);
      return new Response(
        JSON.stringify({
          message: "Ficha já processada previamente (Idempotência mantida).",
          ficha_id: fichaExistente.id,
          status: fichaExistente.status,
          paciente_id: fichaExistente.paciente_id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. REGRA CRÍTICA: Se nome_informado ou nascimento_informado vierem NULL/Ausentes
    // SALVA COMO PENDENTE E CRIA CONFLITO NA FILA (NUNCA VINCULA AUTOMATICAMENTE)
    if (!nome_informado || !nascimento_informado) {
      console.warn(`⚠️ Identificação incompleta para ficha ${form_response_id}: nome_informado=${nome_informado}, nascimento_informado=${nascimento_informado}. Encaminhando para fila de validação.`);

      const { data: fichaIncompleta, error: errIncompleta } = await supabaseAdmin
        .from("fichas")
        .insert({
          paciente_id: null,
          form_response_id,
          respostas: respostas || {},
          nome_informado: nome_informado || "Não Informado",
          nascimento_informado: nascimento_informado || "2000-01-01",
          status: "pendente"
        })
        .select()
        .single();

      if (errIncompleta) throw errIncompleta;

      // Busca todos os pacientes ativos como potenciais candidatos para o coordenador avaliar
      const { data: candidatosExistentes } = await supabaseAdmin
        .from("pacientes")
        .select("id, nome, data_nascimento")
        .eq("status", "ativo")
        .limit(5);

      const candidatosList = (candidatosExistentes || []).map((p) => ({
        paciente_id: p.id,
        nome: p.nome,
        data_nascimento: p.data_nascimento,
        motivo: "Dados de identificação ausentes na ficha nova (Nome ou Data de nascimento não informados/inválidos)."
      }));

      const { error: errConflitoIncompleto } = await supabaseAdmin
        .from("fila_conflitos")
        .insert({
          ficha_id: fichaIncompleta.id,
          pacientes_candidatos: candidatosList,
          status: "pendente"
        });

      if (errConflitoIncompleto) throw errConflitoIncompleto;

      return new Response(
        JSON.stringify({
          success: true,
          status: "pendente",
          ficha_id: fichaIncompleta.id,
          motivo: "Dados de identificação ausentes na ficha. Encaminhado para a fila de validação."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nomeNorm = normalizarNome(nome_informado);

    // 6. Busca Exata: Paciente com NOME_NORMALIZADO e DATA_NASCIMENTO idênticos
    const { data: exatos } = await supabaseAdmin
      .from("pacientes")
      .select("id, nome, data_nascimento")
      .eq("nome_normalizado", nomeNorm)
      .eq("data_nascimento", nascimento_informado)
      .eq("status", "ativo");

    if (exatos && exatos.length > 0) {
      const pacienteId = exatos[0].id;
      
      const { data: novaFicha, error: errFicha } = await supabaseAdmin
        .from("fichas")
        .insert({
          paciente_id: pacienteId,
          form_response_id,
          respostas: respostas || {},
          nome_informado,
          nascimento_informado,
          status: "vinculada"
        })
        .select()
        .single();

      if (errFicha) throw errFicha;

      console.log(`✅ Ficha vinculada automaticamente ao paciente existente ID: ${pacienteId}`);
      return new Response(
        JSON.stringify({
          success: true,
          status: "vinculada",
          paciente_id: pacienteId,
          ficha_id: novaFicha.id,
          motivo: "Vínculo exato por nome e data de nascimento."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Busca de Candidatos Potenciais (Similaridade de Nome ou Mesma Data de Nascimento)
    const { data: todosPacientes } = await supabaseAdmin
      .from("pacientes")
      .select("id, nome, nome_normalizado, data_nascimento, telefone")
      .eq("status", "ativo");

    const candidatos: Array<{ paciente_id: string; nome: string; data_nascimento: string; motivo: string; score: number }> = [];

    if (todosPacientes) {
      for (const p of todosPacientes) {
        const sim = calcularSimilaridade(nomeNorm, p.nome_normalizado);
        const mesmaData = p.data_nascimento === nascimento_informado;

        let motivo = "";
        if (mesmaData && sim > 0.3) {
          motivo = `Mesma data de nascimento (${p.data_nascimento}) e nome similar (${Math.round(sim * 100)}% de correspondência)`;
        } else if (p.nome_normalizado === nomeNorm && !mesmaData) {
          motivo = `Nome idêntico (${p.nome}), mas data de nascimento diferente (Informada: ${nascimento_informado} vs Cadastrada: ${p.data_nascimento})`;
        } else if (sim >= 0.45) {
          motivo = `Nome com alta similaridade (${Math.round(sim * 100)}% de correspondência com ${p.nome})`;
        }

        if (motivo) {
          candidatos.push({
            paciente_id: p.id,
            nome: p.nome,
            data_nascimento: p.data_nascimento,
            motivo,
            score: sim
          });
        }
      }
    }

    candidatos.sort((a, b) => b.score - a.score);

    // 8. Se existirem Candidatos -> Cria Ficha PENDENTE e Fila de Conflitos
    if (candidatos.length > 0) {
      const { data: fichaPendente, error: errPendente } = await supabaseAdmin
        .from("fichas")
        .insert({
          paciente_id: null,
          form_response_id,
          respostas: respostas || {},
          nome_informado,
          nascimento_informado,
          status: "pendente"
        })
        .select()
        .single();

      if (errPendente) throw errPendente;

      const { error: errConflito } = await supabaseAdmin
        .from("fila_conflitos")
        .insert({
          ficha_id: fichaPendente.id,
          pacientes_candidatos: candidatos,
          status: "pendente"
        });

      if (errConflito) throw errConflito;

      console.log(`⚠️ Conflito gerado para a ficha ${fichaPendente.id}. Encontrados ${candidatos.length} candidatos.`);
      return new Response(
        JSON.stringify({
          success: true,
          status: "pendente",
          ficha_id: fichaPendente.id,
          candidatos_encontrados: candidatos.length,
          motivo: "Conflito de ambiguidade detectado. Ficha encaminhada para validação da coordenação."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Se NÃO houver candidatos -> Cria Paciente NOVO e Vincula Ficha
    const { data: novoPaciente, error: errNovoPac } = await supabaseAdmin
      .from("pacientes")
      .insert({
        nome: nome_informado,
        nome_normalizado: nomeNorm,
        data_nascimento: nascimento_informado,
        telefone: telefone || null,
        status: "ativo"
      })
      .select()
      .single();

    if (errNovoPac) throw errNovoPac;

    const { data: fichaNovoPac, error: errFichaNovo } = await supabaseAdmin
      .from("fichas")
      .insert({
        paciente_id: novoPaciente.id,
        form_response_id,
        respostas: respostas || {},
        nome_informado,
        nascimento_informado,
        status: "vinculada"
      })
      .select()
      .single();

    if (errFichaNovo) throw errFichaNovo;

    console.log(`✨ Novo paciente criado com sucesso ID: ${novoPaciente.id} e ficha vinculada ID: ${fichaNovoPac.id}`);
    return new Response(
      JSON.stringify({
        success: true,
        status: "vinculada",
        paciente_id: novoPaciente.id,
        ficha_id: fichaNovoPac.id,
        motivo: "Nenhuma ambiguidade encontrada. Novo paciente criado e vinculado automaticamente."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ Erro ao processar Edge Function receber-ficha:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno ao processar a ficha." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
