// Supabase Edge Function: enviar-pedido
// Servidor Deno / TypeScript para envio de e-mail via Resend API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Trata requisição OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pedido_id } = await req.json();

    if (!pedido_id) {
      return new Response(
        JSON.stringify({ error: "O parâmetro 'pedido_id' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "A chave RESEND_API_KEY não foi configurada nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente Supabase com Service Role Key para leitura completa
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Busca os dados do Pedido e do Usuário Solicitante
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .select("*, perfis(nome, papel)")
      .eq("id", pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return new Response(
        JSON.stringify({ error: `Pedido não encontrado (${pedido_id}): ${pedidoError?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Busca os itens do pedido com os detalhes do material
    const { data: itens, error: itensError } = await supabaseAdmin
      .from("itens_pedido")
      .select("*, materiais(descricao_completa, categoria, marca)")
      .eq("pedido_id", pedido_id);

    if (itensError) {
      return new Response(
        JSON.stringify({ error: `Erro ao buscar itens do pedido: ${itensError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Monta o corpo em HTML formatado para o e-mail
    // Fallback temporário para teste de envio via Resend: rafael@versa3d.com.br
    const emailDestino = pedido.email_destino || "rafael@versa3d.com.br";
    const solicitanteNome = pedido.perfis?.nome || "Solicitante OrtoUnifase";
    
    const tabelaItensHtml = (itens || []).map((item, index) => {
      const descricao = item.descricao_manual || item.materiais?.descricao_completa || "Item sem descrição";
      const categoria = item.materiais?.categoria ? ` (${item.materiais.categoria})` : "";
      const marca = item.materiais?.marca ? ` - Marca: ${item.materiais.marca}` : "";
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${index + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;"><strong>${descricao}</strong>${categoria}${marca}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${item.quantidade}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${item.unidade}</td>
        </tr>
      `;
    }).join("");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #0071fb; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">OrtoUnifase — Pedido de Materiais</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Código do Pedido: ${pedido.id}</p>
        </div>
        
        <div style="padding: 24px;">
          <p style="font-size: 14px; margin-bottom: 16px;">
            <strong>Solicitante:</strong> ${solicitanteNome}<br>
            <strong>Data da Solicitação:</strong> ${new Date(pedido.criado_em).toLocaleString("pt-BR")}
          </p>

          <h3 style="font-size: 15px; color: #0071fb; border-bottom: 2px solid #0071fb; padding-bottom: 6px; margin-top: 24px;">Lista de Itens Solicitados</h3>

          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <thead>
              <tr style="background-color: #f8fafc; text-align: left;">
                <th style="padding: 8px 10px; font-size: 12px; color: #64748b;">#</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #64748b;">Descrição do Material</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #64748b; text-align: center;">Qtd</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #64748b; text-align: center;">Unidade</th>
              </tr>
            </thead>
            <tbody>
              ${tabelaItensHtml}
            </tbody>
          </table>

          <div style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Mensagem enviada automaticamente pelo Sistema Interno de Gestão OrtoUnifase via Resend API.
          </div>
        </div>
      </div>
    `;

    // 4. Envio via API REST do Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "OrtoUnifase Pedidos <onboarding@resend.dev>",
        to: [emailDestino],
        subject: `[Pedido de Materiais] #${pedido.id.substring(0, 8)} - ${solicitanteNome}`,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao enviar e-mail via Resend", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Atualiza o pedido para status = 'enviado' e marca o horário de envio
    const enviadoEm = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("pedidos")
      .update({
        status: "enviado",
        enviado_em: enviadoEm,
      })
      .eq("id", pedido_id);

    if (updateError) {
      console.error("Erro ao atualizar status do pedido:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pedido enviado por e-mail e atualizado para o status 'enviado'.",
        resend_id: resendData.id,
        enviado_em: enviadoEm,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Erro interno no processamento da Edge Function", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
