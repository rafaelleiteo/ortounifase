// ==============================================================================
// SUPABASE EDGE FUNCTION: telegram-bot (Fase 1: Alinhadores e Ortopedicos)
// Arquivo: supabase/functions/telegram-bot/index.ts
//
// Seguranca:
// - Valida header X-Telegram-Bot-Api-Secret-Token contra TELEGRAM_WEBHOOK_SECRET
// - Autoriza apenas TELEGRAM_ALLOWED_CHAT_ID (ou modo de descoberta com /meuid)
// - Deduplica updates via telegram_updates_processados
// - Expira sessoes de conversa em 30 minutos
// - Sem exposicao de dados clinicos
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

// Funcoes utilitarias puras de validacao e formatacao
function validarSecretToken(headerToken: string | null, secretEsperado: string | null): boolean {
  if (!secretEsperado || secretEsperado.trim() === "") return false;
  if (!headerToken) return false;
  return headerToken.trim() === secretEsperado.trim();
}

function parseDataLocal(dataStr: string): Date {
  const parts = dataStr.substring(0, 10).split("-");
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
}

function formatarDataBR(data: string | Date): string {
  const d = typeof data === "string" ? parseDataLocal(data) : data;
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarDataISO(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${ano}-${mes}-${dia}`;
}

function normalizarTexto(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nomesParecidos(nome1: string, nome2: string): boolean {
  const n1 = normalizarTexto(nome1);
  const n2 = normalizarTexto(nome2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Distancia de edicao simples (Levenshtein)
  const a = n1;
  const b = n2;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length] <= 2;
}

function calcularStatusPedido(dataRetorno: string, solicitadoEm: string | null, antecedenciaDias: number, hoje: Date): string {
  if (solicitadoEm) return "solicitado";
  const retDate = parseDataLocal(dataRetorno);
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
  if (retDate.getTime() <= h.getTime()) return "expirado";

  const prazo = new Date(retDate.getFullYear(), retDate.getMonth(), retDate.getDate(), 0, 0, 0, 0);
  prazo.setDate(prazo.getDate() - antecedenciaDias);

  const diffMs = prazo.getTime() - h.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return "atrasado";
  if (diffDias <= 5) return "vencendo";
  return "pendente";
}

function agruparBlocos(datas: string[]): Array<{ base: string; datas: string[] }> {
  if (!datas || datas.length === 0) return [];
  const ordenadas = Array.from(new Set(datas)).sort();
  const blocos: Array<{ base: string; datas: string[] }> = [];

  for (const dStr of ordenadas) {
    const d = parseDataLocal(dStr);
    const ultimoBloco = blocos[blocos.length - 1];

    if (!ultimoBloco) {
      blocos.push({ base: dStr, datas: [dStr] });
      continue;
    }

    const ultimaDataStr = ultimoBloco.datas[ultimoBloco.datas.length - 1];
    const ultimaData = parseDataLocal(ultimaDataStr);

    const diffDias = Math.round((d.getTime() - ultimaData.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDias === 1) {
      ultimoBloco.datas.push(dStr);
    } else {
      blocos.push({ base: dStr, datas: [dStr] });
    }
  }
  return blocos;
}

function proximoBloco(blocos: Array<{ base: string; datas: string[] }>, hojeISO: string): { base: string; datas: string[] } | null {
  for (const b of blocos) {
    if (b.base > hojeISO) return b;
  }
  return null;
}

// Envio de mensagens e respostas ao Telegram
async function telegramEnviarMensagem(botToken: string, chatId: number | string, texto: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text: texto,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Erro ao enviar mensagem Telegram:", errText);
  }
}

async function telegramAnswerCallback(botToken: string, callbackQueryId: string, texto?: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  const body: any = { callback_query_id: callbackQueryId };
  if (texto) body.text = texto;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function menuPrincipalBotoes() {
  return {
    inline_keyboard: [
      [
        { text: "Novo paciente alinhador", callback_data: "menu:novo_alinhador" },
        { text: "Novo paciente ortopedico", callback_data: "menu:novo_ortopedico" }
      ],
      [
        { text: "Pedidos Pendentes", callback_data: "menu:pendentes" }
      ]
    ]
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  const headerSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");

  // Validacao obrigatoria de seguranca do webhook
  if (!validarSecretToken(headerSecret, webhookSecret)) {
    return new Response(JSON.stringify({ error: "Acesso nao autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const allowedChatId = (Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ?? "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_e) {
    return new Response("JSON invalido", { status: 400, headers: corsHeaders });
  }

  // DISPARO ESPECIAL: AVISO DIARIO (Chamado por pg_cron ou GitHub Action)
  if (payload.action === "aviso_diario") {
    if (!allowedChatId) {
      console.warn("Aviso diario ignorado: TELEGRAM_ALLOWED_CHAT_ID nao configurado");
      return new Response(JSON.stringify({ status: "chat_id_nao_configurado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoje = new Date();
    const hojeISO = formatarDataISO(hoje);

    // Verifica se ja enviou hoje
    const { data: logEnvio } = await supabase
      .from("telegram_log")
      .select("id, criado_em")
      .eq("acao", "aviso_diario")
      .gte("criado_em", `${hojeISO}T00:00:00Z`)
      .limit(1);

    if (logEnvio && logEnvio.length > 0) {
      return new Response(JSON.stringify({ status: "ja_enviado_hoje" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca configuracao de antecedencia
    const { data: config } = await supabase
      .from("alinhadores_config")
      .select("antecedencia_dias, antecedencia_ortopedico_dias")
      .limit(1)
      .single();

    const antAlin = config?.antecedencia_dias || 15;
    const antOrto = config?.antecedencia_ortopedico_dias || 20;

    // Busca pedidos pendentes com dados do paciente e turma
    const { data: pedidos } = await supabase
      .from("alinhadores_pedidos")
      .select(`
        id,
        paciente_id,
        data_retorno,
        solicitado_em,
        tipo,
        aparelho,
        paciente:alinhadores_pacientes (
          nome,
          tipo,
          aparelho_previsto,
          turma:turmas (nome)
        )
      `)
      .is("solicitado_em", null);

    const itensVencendoOuAtrasados: any[] = [];
    for (const p of pedidos || []) {
      const tipo = p.tipo || "alinhador";
      const ant = tipo === "ortopedico" ? antOrto : antAlin;
      const status = calcularStatusPedido(p.data_retorno, p.solicitado_em, ant, hoje);

      if (status === "atrasado" || status === "vencendo") {
        itensVencendoOuAtrasados.push({
          id: p.id,
          paciente_nome: p.paciente?.nome || "Paciente",
          turma_nome: p.paciente?.turma?.nome,
          tipo,
          aparelho: p.aparelho || p.paciente?.aparelho_previsto,
          status,
          prazo_formatado: formatarDataBR(p.data_retorno),
        });
      }
    }

    if (itensVencendoOuAtrasados.length === 0) {
      return new Response(JSON.stringify({ status: "sem_pendencias" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ordena atrasados primeiro, depois vencendo
    itensVencendoOuAtrasados.sort((a, b) => {
      if (a.status === "atrasado" && b.status !== "atrasado") return -1;
      if (a.status !== "atrasado" && b.status === "atrasado") return 1;
      return a.paciente_nome.localeCompare(b.paciente_nome, "pt-BR");
    });

    const selecionados = itensVencendoOuAtrasados.slice(0, 10);
    const excedente = itensVencendoOuAtrasados.length - selecionados.length;

    const atrasados = selecionados.filter((i) => i.status === "atrasado");
    const vencendo = selecionados.filter((i) => i.status === "vencendo");

    const linhas: string[] = ["Aviso Diario de Pedidos - OrtoUnifase\n"];

    if (atrasados.length > 0) {
      linhas.push("ATRASADOS:");
      for (const item of atrasados) {
        const tipoLabel = item.tipo === "ortopedico" ? "Ortopedico" : "Alinhador";
        const turma = item.turma_nome ? ` (${item.turma_nome})` : "";
        const detalhe = item.tipo === "ortopedico" && item.aparelho ? ` - ${item.aparelho}` : "";
        linhas.push(`• [${tipoLabel}] ${item.paciente_nome}${detalhe}${turma} - Prazo: ${item.prazo_formatado}`);
      }
      linhas.push("");
    }

    if (vencendo.length > 0) {
      linhas.push("VENCENDO:");
      for (const item of vencendo) {
        const tipoLabel = item.tipo === "ortopedico" ? "Ortopedico" : "Alinhador";
        const turma = item.turma_nome ? ` (${item.turma_nome})` : "";
        const detalhe = item.tipo === "ortopedico" && item.aparelho ? ` - ${item.aparelho}` : "";
        linhas.push(`• [${tipoLabel}] ${item.paciente_nome}${detalhe}${turma} - Prazo: ${item.prazo_formatado}`);
      }
    }

    if (excedente > 0) {
      linhas.push(`\n... e mais ${excedente}, veja na plataforma.`);
    }

    const botoes = selecionados.map((item) => {
      const primeiroNome = item.paciente_nome.trim().split(" ")[0] || item.paciente_nome;
      return [
        {
          text: `Pedido feito: ${primeiroNome}`,
          callback_data: `ped_feito:${item.id}`,
        },
      ];
    });

    await telegramEnviarMensagem(botToken, allowedChatId, linhas.join("\n").trim(), { inline_keyboard: botoes });

    await supabase.from("telegram_log").insert([
      {
        acao: "aviso_diario",
        resumo: `Aviso diario enviado com ${itensVencendoOuAtrasados.length} pendencias`,
        detalhes: { total: itensVencendoOuAtrasados.length, enviados: selecionados.length },
      },
    ]);

    return new Response(JSON.stringify({ status: "aviso_enviado", total: itensVencendoOuAtrasados.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PROCESSAMENTO DE UPDATES DO TELEGRAM
  const update = payload;
  const updateId = update.update_id;

  if (typeof updateId === "number") {
    // Deduplicacao por update_id
    const { error: dedupeError } = await supabase
      .from("telegram_updates_processados")
      .insert([{ update_id: updateId }]);

    if (dedupeError) {
      // Ja foi processado ou duplicado
      return new Response("OK (duplicado)", { status: 200, headers: corsHeaders });
    }
  }

  const message = update.message;
  const callbackQuery = update.callback_query;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;

  if (!chatId) {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  const msgText = message?.text || "";

  // AUTORIZACAO
  if (!allowedChatId) {
    // Modo de descoberta inicial
    if (msgText.trim().toLowerCase().startsWith("/meuid")) {
      await telegramEnviarMensagem(botToken, chatId, `Seu chat_id e: ${chatId}`);
    }
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  if (String(chatId).trim() !== allowedChatId) {
    // Chat nao autorizado: silencio absoluto
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  // Busca estado atual da conversa
  const { data: estadoRow } = await supabase
    .from("telegram_estado")
    .select("passo, dados, updated_at")
    .eq("chat_id", chatId)
    .single();

  let estado = estadoRow;

  // Verifica se o estado expirou (30 min)
  if (estado && estado.updated_at) {
    const diffMs = Date.now() - new Date(estado.updated_at).getTime();
    if (diffMs > 30 * 60 * 1000) {
      await supabase.from("telegram_estado").delete().eq("chat_id", chatId);
      estado = null;
      if (callbackQuery) {
        await telegramAnswerCallback(botToken, callbackQuery.id, "Este pedido expirou, comece de novo");
        await telegramEnviarMensagem(botToken, chatId, "A conversa anterior expirou por inatividade.\nEscolha uma opcao:", menuPrincipalBotoes());
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
    }
  }

  // TRATAMENTO DE CALLBACK QUERY (CLIQUES EM BOTOES INLINE)
  if (callbackQuery) {
    const data = callbackQuery.data || "";
    await telegramAnswerCallback(botToken, callbackQuery.id);

    if (data === "cancelar") {
      await supabase.from("telegram_estado").delete().eq("chat_id", chatId);
      await telegramEnviarMensagem(botToken, chatId, "Operacao cancelada.\nEscolha uma opcao:", menuPrincipalBotoes());
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "menu:novo_alinhador") {
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_nome", dados: { tipo: "alinhador" }, updated_at: new Date().toISOString() }
      ]);
      await telegramEnviarMensagem(
        botToken,
        chatId,
        "Cadastro de Novo Paciente de Alinhador.\n\nDigite o nome completo do paciente:",
        { inline_keyboard: [[{ text: "Cancelar", callback_data: "cancelar" }]] }
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "menu:novo_ortopedico") {
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_nome", dados: { tipo: "ortopedico" }, updated_at: new Date().toISOString() }
      ]);
      await telegramEnviarMensagem(
        botToken,
        chatId,
        "Cadastro de Novo Paciente de Ortopedia.\n\nDigite o nome completo do paciente:",
        { inline_keyboard: [[{ text: "Cancelar", callback_data: "cancelar" }]] }
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "menu:pendentes") {
      // Consulta e lista pedidos pendentes
      const { data: config } = await supabase.from("alinhadores_config").select("antecedencia_dias, antecedencia_ortopedico_dias").limit(1).single();
      const antAlin = config?.antecedencia_dias || 15;
      const antOrto = config?.antecedencia_ortopedico_dias || 20;
      const hoje = new Date();

      const { data: pedidos } = await supabase
        .from("alinhadores_pedidos")
        .select(`
          id, paciente_id, data_retorno, solicitado_em, tipo, aparelho,
          paciente:alinhadores_pacientes ( nome, tipo, aparelho_previsto, turma:turmas (nome) )
        `)
        .is("solicitado_em", null);

      const pendentes: any[] = [];
      for (const p of pedidos || []) {
        const tipo = p.tipo || "alinhador";
        const ant = tipo === "ortopedico" ? antOrto : antAlin;
        const status = calcularStatusPedido(p.data_retorno, p.solicitado_em, ant, hoje);
        if (status === "atrasado" || status === "vencendo") {
          pendentes.push({
            paciente_nome: p.paciente?.nome || "Paciente",
            turma_nome: p.paciente?.turma?.nome,
            tipo,
            aparelho: p.aparelho || p.paciente?.aparelho_previsto,
            status,
            prazo_formatado: formatarDataBR(p.data_retorno),
          });
        }
      }

      if (pendentes.length === 0) {
        await telegramEnviarMensagem(botToken, chatId, "Nenhum pedido de alinhador ou aparelho ortopedico esta pendente de solicitacao no momento.\n", menuPrincipalBotoes());
      } else {
        const alinhadores = pendentes.filter((p) => p.tipo === "alinhador");
        const ortopedicos = pendentes.filter((p) => p.tipo === "ortopedico");
        const linhas: string[] = ["Pedidos Pendentes de Solicitacao:\n"];

        if (alinhadores.length > 0) {
          linhas.push("ALINHADORES:");
          for (const p of alinhadores) {
            const stLabel = p.status === "atrasado" ? "[ATRASADO]" : "[VENCENDO]";
            const turma = p.turma_nome ? ` (${p.turma_nome})` : "";
            linhas.push(`• ${stLabel} ${p.paciente_nome}${turma} - Prazo: ${p.prazo_formatado}`);
          }
          linhas.push("");
        }

        if (ortopedicos.length > 0) {
          linhas.push("APARELHOS ORTOPEDICOS:");
          for (const p of ortopedicos) {
            const stLabel = p.status === "atrasado" ? "[ATRASADO]" : "[VENCENDO]";
            const turma = p.turma_nome ? ` (${p.turma_nome})` : "";
            const ap = p.aparelho ? `: ${p.aparelho}` : "";
            linhas.push(`• ${stLabel} ${p.paciente_nome}${ap}${turma} - Prazo: ${p.prazo_formatado}`);
          }
        }

        await telegramEnviarMensagem(botToken, chatId, linhas.join("\n").trim(), menuPrincipalBotoes());
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data.startsWith("conf_exist:")) {
      await supabase.from("telegram_estado").delete().eq("chat_id", chatId);
      await telegramEnviarMensagem(botToken, chatId, "Paciente ja existente selecionado. Cadastro cancelado.\n", menuPrincipalBotoes());
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "conf_novo") {
      // Avanca para escolha de turma
      const { data: turmas } = await supabase.from("turmas").select("id, nome").eq("ativo", true).order("nome");
      const botoesTurma = (turmas || []).map((t: any) => [
        { text: t.nome, callback_data: `turma:${t.id}:${t.nome}` }
      ]);
      botoesTurma.push([{ text: "Cancelar", callback_data: "cancelar" }]);

      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_turma", dados: { ...estado?.dados }, updated_at: new Date().toISOString() }
      ]);
      await telegramEnviarMensagem(botToken, chatId, `Nome confirmado: ${estado?.dados?.nome}\n\nEscolha a turma do paciente:`, { inline_keyboard: botoesTurma });
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data.startsWith("turma:")) {
      const parts = data.split(":");
      const turmaId = parts[1];
      const turmaNome = parts.slice(2).join(":") || turmaId;

      const dadosAtualizados = { ...estado?.dados, turma_id: turmaId, turma_nome: turmaNome };
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_previsto", dados: dadosAtualizados, updated_at: new Date().toISOString() }
      ]);

      const isOrto = dadosAtualizados.tipo === "ortopedico";
      const promptTexto = isOrto
        ? "Informe o aparelho ortopedico previsto (ex: Disjuntor de Hyrax, Mantenedor de Espaco) ou clique em Pular:"
        : "Informe o total de alinhadores previsto (de 1 a 99) ou clique em Pular:";

      await telegramEnviarMensagem(botToken, chatId, promptTexto, {
        inline_keyboard: [
          [{ text: "Pular", callback_data: "pular_previsto" }],
          [{ text: "Cancelar", callback_data: "cancelar" }]
        ]
      });
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "pular_previsto") {
      const dadosAtualizados = { ...estado?.dados, previsto: null };
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_obs", dados: dadosAtualizados, updated_at: new Date().toISOString() }
      ]);
      await telegramEnviarMensagem(
        botToken,
        chatId,
        "Deseja adicionar observacoes?\n(Ate 500 caracteres. ATENCAO: evite dados clinicos confidenciais)",
        {
          inline_keyboard: [
            [{ text: "Pular", callback_data: "pular_obs" }],
            [{ text: "Cancelar", callback_data: "cancelar" }]
          ]
        }
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "pular_obs") {
      const dadosAtualizados = { ...estado?.dados, observacao: null };
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_confirmacao", dados: dadosAtualizados, updated_at: new Date().toISOString() }
      ]);

      const tipoLabel = dadosAtualizados.tipo === "ortopedico" ? "Aparelho Ortopedico" : "Alinhador";
      const previstoLabel = dadosAtualizados.tipo === "ortopedico" ? "Aparelho Previsto" : "Total Previsto";
      const resumo =
        "Confira os dados do novo paciente:\n\n" +
        `• Tipo: ${tipoLabel}\n` +
        `• Paciente: ${dadosAtualizados.nome}\n` +
        `• Turma: ${dadosAtualizados.turma_nome}\n` +
        `• ${previstoLabel}: ${dadosAtualizados.previsto || "Nao informado"}\n` +
        `• Observacao: ${dadosAtualizados.observacao || "Nenhuma"}\n\n` +
        "Deseja confirmar o cadastro?";

      await telegramEnviarMensagem(botToken, chatId, resumo, {
        inline_keyboard: [
          [{ text: "Confirmar cadastro", callback_data: "conf_gravar" }],
          [{ text: "Cancelar", callback_data: "cancelar" }]
        ]
      });
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "conf_gravar") {
      const d = estado?.dados;
      if (!d || !d.nome || !d.turma_id) {
        await telegramEnviarMensagem(botToken, chatId, "Dados incompletos para cadastro. Comece de novo:", menuPrincipalBotoes());
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const isOrto = d.tipo === "ortopedico";
      const totalAlin = isOrto ? null : (d.previsto ? parseInt(String(d.previsto), 10) : null);
      const apPrev = isOrto ? (d.previsto ? String(d.previsto).trim() : null) : null;

      // 1. Cadastra paciente
      const { data: pacCriado, error: pacError } = await supabase
        .from("alinhadores_pacientes")
        .insert([
          {
            nome: d.nome.trim(),
            turma_id: d.turma_id,
            tipo: isOrto ? "ortopedico" : "alinhador",
            total_alinhadores: totalAlin,
            aparelho_previsto: apPrev,
            observacao: d.observacao ? d.observacao.trim() : null,
            ativo: true,
          }
        ])
        .select()
        .single();

      if (pacError || !pacCriado) {
        console.error("Erro ao criar paciente via Telegram:", pacError);
        await telegramEnviarMensagem(botToken, chatId, `Erro ao cadastrar paciente: ${pacError?.message}`, menuPrincipalBotoes());
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // 2. Busca datas do calendario da turma para gerar pedido do proximo bloco
      const { data: datasCal } = await supabase
        .from("alinhadores_calendario")
        .select("data")
        .eq("turma_id", d.turma_id)
        .order("data", { ascending: true });

      const datasLista = (datasCal || []).map((x: any) => x.data);
      const blocos = agruparBlocos(datasLista);
      const hojeISO = formatarDataISO(new Date());
      const prox = proximoBloco(blocos, hojeISO);

      let msgPedido = "Turma sem bloco futuro no calendario; pedido de retorno nao gerado.";
      if (prox) {
        const { error: pedError } = await supabase
          .from("alinhadores_pedidos")
          .upsert([
            {
              paciente_id: pacCriado.id,
              data_retorno: prox.base,
              tipo: isOrto ? "ortopedico" : "alinhador",
              aparelho: isOrto ? (apPrev || "Aparelho Ortopedico") : "",
              alinhador_de: null,
              alinhador_ate: null,
            }
          ], { onConflict: "paciente_id,data_retorno,tipo,aparelho", ignoreDuplicates: true });

        if (!pedError) {
          msgPedido = `Pedido de retorno gerado para ${formatarDataBR(prox.base)}.`;
        }
      }

      await supabase.from("telegram_estado").delete().eq("chat_id", chatId);

      await supabase.from("telegram_log").insert([
        {
          acao: "paciente_criado_telegram",
          resumo: `Paciente ${d.nome} cadastrado via Telegram`,
          detalhes: { paciente_id: pacCriado.id, tipo: d.tipo, turma: d.turma_nome },
        }
      ]);

      await telegramEnviarMensagem(
        botToken,
        chatId,
        `Paciente "${d.nome}" cadastrado com sucesso!\n${msgPedido}\n\nEscolha uma opcao:`,
        menuPrincipalBotoes()
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data.startsWith("ped_feito:")) {
      const pedidoId = data.split(":")[1];
      const { data: ped } = await supabase
        .from("alinhadores_pedidos")
        .select("id, data_retorno, tipo, aparelho, paciente:alinhadores_pacientes(nome)")
        .eq("id", pedidoId)
        .single();

      if (!ped) {
        await telegramEnviarMensagem(botToken, chatId, "Pedido nao encontrado ou ja removido.", menuPrincipalBotoes());
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const pNome = ped.paciente?.nome || "Paciente";
      const apLabel = ped.tipo === "ortopedico" ? (ped.aparelho || "Aparelho Ortopedico") : "Alinhador";

      await telegramEnviarMensagem(
        botToken,
        chatId,
        `Confirmar que o pedido de ${pNome} (${apLabel}) para retorno em ${formatarDataBR(ped.data_retorno)} foi realizado junto a empresa/laboratorio?`,
        {
          inline_keyboard: [
            [{ text: "Sim, confirmar", callback_data: `solic_sim:${pedidoId}` }],
            [{ text: "Nao, voltar", callback_data: "solic_nao" }]
          ]
        }
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data.startsWith("solic_sim:")) {
      const pedidoId = data.split(":")[1];
      const agora = new Date().toISOString();

      const { data: updated, error: updError } = await supabase
        .from("alinhadores_pedidos")
        .update({ solicitado_em: agora, solicitado_por: null })
        .eq("id", pedidoId)
        .is("solicitado_em", null)
        .select("id, paciente:alinhadores_pacientes(nome)");

      if (updError) {
        await telegramEnviarMensagem(botToken, chatId, `Erro ao atualizar pedido: ${updError.message}`, menuPrincipalBotoes());
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      if (!updated || updated.length === 0) {
        await telegramEnviarMensagem(botToken, chatId, "Este pedido ja havia sido marcado como solicitado anteriormente.", menuPrincipalBotoes());
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const pNome = updated[0]?.paciente?.nome || "Paciente";
      await supabase.from("telegram_log").insert([
        {
          acao: "pedido_solicitado_telegram",
          resumo: `Pedido de ${pNome} marcado como solicitado via Telegram`,
          detalhes: { pedido_id: pedidoId },
        }
      ]);

      await telegramEnviarMensagem(botToken, chatId, `Pedido de ${pNome} marcado como solicitado com sucesso!\n`, menuPrincipalBotoes());
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (data === "solic_nao") {
      await telegramEnviarMensagem(botToken, chatId, "Operacao cancelada. O pedido nao foi alterado.\n", menuPrincipalBotoes());
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  // TRATAMENTO DE MENSAGENS DE TEXTO
  if (message) {
    const texto = (message.text || "").trim();

    if (texto.toLowerCase() === "/cancelar") {
      await supabase.from("telegram_estado").delete().eq("chat_id", chatId);
      await telegramEnviarMensagem(botToken, chatId, "Operacao cancelada.\nEscolha uma opcao:", menuPrincipalBotoes());
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (texto.toLowerCase().startsWith("/start") || texto.toLowerCase().startsWith("/menu") || !estado) {
      await telegramEnviarMensagem(botToken, chatId, "OrtoUnifase - Alinhadores e Ortopedicos\n\nEscolha uma das opcoes abaixo:", menuPrincipalBotoes());
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Processamento conforme a etapa do estado ativo
    if (estado.passo === "cadastro_nome") {
      const nomeLimpo = texto;
      if (nomeLimpo.length < 3 || nomeLimpo.length > 120) {
        await telegramEnviarMensagem(botToken, chatId, "Nome invalido. Digite um nome com entre 3 e 120 caracteres:");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const tipo = estado.dados?.tipo || "alinhador";
      const { data: pacientesExistentes } = await supabase
        .from("alinhadores_pacientes")
        .select("id, nome, turma:turmas(nome)")
        .eq("tipo", tipo)
        .eq("ativo", true);

      const conflitos: any[] = [];
      for (const p of pacientesExistentes || []) {
        if (nomesParecidos(nomeLimpo, p.nome)) {
          conflitos.push({ id: p.id, nome: p.nome, turma: p.turma?.nome });
          if (conflitos.length >= 3) break;
        }
      }

      if (conflitos.length > 0) {
        await supabase.from("telegram_estado").upsert([
          { chat_id: chatId, passo: "cadastro_conflito_nome", dados: { ...estado.dados, nome: nomeLimpo, conflitos }, updated_at: new Date().toISOString() }
        ]);

        const botoes = conflitos.map((c) => [
          { text: `E este: ${c.nome}${c.turma ? ` (${c.turma})` : ""}`, callback_data: `conf_exist:${c.id}` }
        ]);
        botoes.push([{ text: "Criar novo mesmo assim", callback_data: "conf_novo" }]);
        botoes.push([{ text: "Cancelar", callback_data: "cancelar" }]);

        await telegramEnviarMensagem(botToken, chatId, `Encontrei paciente(s) com nome parecido:\n`, { inline_keyboard: botoes });
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Nao ha conflitos: avanca para turma
      const { data: turmas } = await supabase.from("turmas").select("id, nome").eq("ativo", true).order("nome");
      const botoesTurma = (turmas || []).map((t: any) => [
        { text: t.nome, callback_data: `turma:${t.id}:${t.nome}` }
      ]);
      botoesTurma.push([{ text: "Cancelar", callback_data: "cancelar" }]);

      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_turma", dados: { ...estado.dados, nome: nomeLimpo }, updated_at: new Date().toISOString() }
      ]);
      await telegramEnviarMensagem(botToken, chatId, `Nome: ${nomeLimpo}\n\nEscolha a turma do paciente:`, { inline_keyboard: botoesTurma });
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (estado.passo === "cadastro_previsto") {
      const isOrto = estado.dados?.tipo === "ortopedico";
      let previstoValor: any = null;

      if (isOrto) {
        if (texto.length > 100) {
          await telegramEnviarMensagem(botToken, chatId, "Nome do aparelho deve ter no maximo 100 caracteres. Tente novamente ou clique em Pular:", {
            inline_keyboard: [[{ text: "Pular", callback_data: "pular_previsto" }], [{ text: "Cancelar", callback_data: "cancelar" }]]
          });
          return new Response("OK", { status: 200, headers: corsHeaders });
        }
        previstoValor = texto;
      } else {
        const num = parseInt(texto, 10);
        if (isNaN(num) || num < 1 || num > 99) {
          await telegramEnviarMensagem(botToken, chatId, "Informe um numero inteiro entre 1 e 99 ou clique em Pular:", {
            inline_keyboard: [[{ text: "Pular", callback_data: "pular_previsto" }], [{ text: "Cancelar", callback_data: "cancelar" }]]
          });
          return new Response("OK", { status: 200, headers: corsHeaders });
        }
        previstoValor = num;
      }

      const dadosAtualizados = { ...estado.dados, previsto: previstoValor };
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_obs", dados: dadosAtualizados, updated_at: new Date().toISOString() }
      ]);

      await telegramEnviarMensagem(
        botToken,
        chatId,
        "Deseja adicionar observacoes?\n(Ate 500 caracteres. ATENCAO: evite dados clinicos confidenciais)",
        {
          inline_keyboard: [
            [{ text: "Pular", callback_data: "pular_obs" }],
            [{ text: "Cancelar", callback_data: "cancelar" }]
          ]
        }
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (estado.passo === "cadastro_obs") {
      if (texto.length > 500) {
        await telegramEnviarMensagem(botToken, chatId, "A observacao deve ter no maximo 500 caracteres. Tente novamente ou clique em Pular:", {
          inline_keyboard: [[{ text: "Pular", callback_data: "pular_obs" }], [{ text: "Cancelar", callback_data: "cancelar" }]]
        });
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const dadosAtualizados = { ...estado.dados, observacao: texto };
      await supabase.from("telegram_estado").upsert([
        { chat_id: chatId, passo: "cadastro_confirmacao", dados: dadosAtualizados, updated_at: new Date().toISOString() }
      ]);

      const tipoLabel = dadosAtualizados.tipo === "ortopedico" ? "Aparelho Ortopedico" : "Alinhador";
      const previstoLabel = dadosAtualizados.tipo === "ortopedico" ? "Aparelho Previsto" : "Total Previsto";
      const resumo =
        "Confira os dados do novo paciente:\n\n" +
        `• Tipo: ${tipoLabel}\n` +
        `• Paciente: ${dadosAtualizados.nome}\n` +
        `• Turma: ${dadosAtualizados.turma_nome}\n` +
        `• ${previstoLabel}: ${dadosAtualizados.previsto || "Nao informado"}\n` +
        `• Observacao: ${dadosAtualizados.observacao || "Nenhuma"}\n\n` +
        "Deseja confirmar o cadastro?";

      await telegramEnviarMensagem(botToken, chatId, resumo, {
        inline_keyboard: [
          [{ text: "Confirmar cadastro", callback_data: "conf_gravar" }],
          [{ text: "Cancelar", callback_data: "cancelar" }]
        ]
      });
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Caso nao esperado em mensagem de texto
    await telegramEnviarMensagem(botToken, chatId, "Opcao nao reconhecida. Use os botoes ou digite /cancelar para reiniciar:", menuPrincipalBotoes());
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
});
