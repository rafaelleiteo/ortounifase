import assert from 'node:assert/strict';
import {
  validarSecretToken,
  verificarAutorizacaoChat,
  verificarEstadoExpirado,
  validarNomePacienteTelegram,
  validarAlinhadoresPrevistos,
  validarAparelhoPrevisto,
  validarObservacaoTelegram,
  gerarMenuPrincipalTelegram,
  gerarTecladoTurmasTelegram,
  processarTextoEmCadastroTurma,
  gerarTecladoConflitoNome,
  gerarTecladoPrevisto,
  gerarTecladoObservacao,
  gerarTecladoConfirmacaoCadastro,
  formatarResumoCadastro,
  formatarListaPendentes,
  montarAvisoDiarioTelegram,
  verificarJaEnviouAvisoHoje,
  verificarNomeSimilarTelegram,
  processarDecisaoConflito,
  processarInputPrevisto,
  processarInputObservacao,
  validarDadosParaGravacao,
  ItemPendenteView,
  ItemAvisoDiario,
  TelegramEstadoConversa
} from '../src/lib/telegramPure';
import {
  agruparBlocos,
  proximoBloco,
  formatarDataISO,
  parseDataLocal,
  planejarSincronizacao
} from '../src/lib/alinhadoresTypes';
import {
  planejarSincronizacaoOrtopedicos,
  PacienteParaVerificacaoNome
} from '../src/lib/ortopedicosPure';

console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: MODULO TELEGRAM BOT (FASE 1)');
console.log('Fuso do ambiente atual: America/Sao_Paulo');
console.log('================================================================\n');

let passou = 0;
let falhou = 0;

function test(nome: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${nome}`);
    passou++;
  } catch (err) {
    console.error(`  [FAIL] ${nome}`);
    console.error(err);
    falhou++;
  }
}

// -----------------------------------------------------------------------------
// 1. Validacao do secret_token
// -----------------------------------------------------------------------------
test('validarSecretToken: aceita token valido identico ao secret', () => {
  assert.equal(validarSecretToken('token-secreto-123', 'token-secreto-123'), true);
});

test('validarSecretToken: aceita token com espacos nas bordas (trim)', () => {
  assert.equal(validarSecretToken('  token-secreto-123  ', 'token-secreto-123'), true);
});

test('validarSecretToken: rejeita token diferente', () => {
  assert.equal(validarSecretToken('token-errado', 'token-secreto-123'), false);
});

test('validarSecretToken: rejeita se headerToken for nulo ou vazio', () => {
  assert.equal(validarSecretToken(null, 'token-secreto-123'), false);
  assert.equal(validarSecretToken('', 'token-secreto-123'), false);
  assert.equal(validarSecretToken(undefined, 'token-secreto-123'), false);
});

test('validarSecretToken: rejeita se secret configurado for vazio ou nulo', () => {
  assert.equal(validarSecretToken('token-secreto-123', null), false);
  assert.equal(validarSecretToken('token-secreto-123', ''), false);
  assert.equal(validarSecretToken('token-secreto-123', '   '), false);
});

// -----------------------------------------------------------------------------
// 2. Autorizacao de chat
// -----------------------------------------------------------------------------
test('verificarAutorizacaoChat: modo configuracao inicial permite /meuid', () => {
  const res = verificarAutorizacaoChat(123456, null, '/meuid');
  assert.equal(res.autorizado, true);
  assert.equal(res.modoConfiguracao, true);
  assert.equal(res.responderMeuId, true);
});

test('verificarAutorizacaoChat: modo configuracao inicial permite /meuid com espacos ou maiusculas', () => {
  const res = verificarAutorizacaoChat(123456, '', '  /MEUID  ');
  assert.equal(res.autorizado, true);
  assert.equal(res.modoConfiguracao, true);
  assert.equal(res.responderMeuId, true);
});

test('verificarAutorizacaoChat: modo configuracao inicial ignora qualquer outro comando em silencio', () => {
  const res = verificarAutorizacaoChat(123456, undefined, '/start');
  assert.equal(res.autorizado, false);
  assert.equal(res.modoConfiguracao, true);
  assert.equal(res.responderMeuId, false);
});

test('verificarAutorizacaoChat: modo normal autoriza chat_id configurado', () => {
  const res = verificarAutorizacaoChat(987654321, '987654321', '/start');
  assert.equal(res.autorizado, true);
  assert.equal(res.modoConfiguracao, false);
  assert.equal(res.responderMeuId, false);
});

test('verificarAutorizacaoChat: modo normal ignora chat_id nao autorizado em silencio', () => {
  const res = verificarAutorizacaoChat(111222333, '987654321', '/start');
  assert.equal(res.autorizado, false);
  assert.equal(res.modoConfiguracao, false);
  assert.equal(res.responderMeuId, false);
});

// -----------------------------------------------------------------------------
// 3. Expiracao de estado
// -----------------------------------------------------------------------------
test('verificarEstadoExpirado: estado ativo ha 10 minutos e valido (nao expirado)', () => {
  const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.equal(verificarEstadoExpirado(dezMinAtras), false);
});

test('verificarEstadoExpirado: estado ativo ha 29 minutos e valido', () => {
  const vinteNoveMinAtras = new Date(Date.now() - 29 * 60 * 1000).toISOString();
  assert.equal(verificarEstadoExpirado(vinteNoveMinAtras), false);
});

test('verificarEstadoExpirado: estado ativo ha mais de 30 minutos e expirado', () => {
  const trintaUmMinAtras = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  assert.equal(verificarEstadoExpirado(trintaUmMinAtras), true);
});

test('verificarEstadoExpirado: aceita objetos Date diretamente', () => {
  const agora = new Date(2026, 10, 11, 10, 30, 0);
  const updatedAtValido = new Date(2026, 10, 11, 10, 5, 0); // 25 min antes
  const updatedAtExpirado = new Date(2026, 10, 11, 9, 50, 0); // 40 min antes
  assert.equal(verificarEstadoExpirado(updatedAtValido, agora), false);
  assert.equal(verificarEstadoExpirado(updatedAtExpirado, agora), true);
});

// -----------------------------------------------------------------------------
// 4. Validacao de nome de paciente
// -----------------------------------------------------------------------------
test('validarNomePacienteTelegram: aceita nome valido de tamanho comum', () => {
  const res = validarNomePacienteTelegram('Beatriz de Souza');
  assert.equal(res.valido, true);
  assert.equal(res.nomeLimpo, 'Beatriz de Souza');
});

test('validarNomePacienteTelegram: aplica trim de espacos em branco', () => {
  const res = validarNomePacienteTelegram('   Carlos Eduardo Lima   ');
  assert.equal(res.valido, true);
  assert.equal(res.nomeLimpo, 'Carlos Eduardo Lima');
});

test('validarNomePacienteTelegram: rejeita nome com menos de 3 caracteres', () => {
  const res = validarNomePacienteTelegram('Lu');
  assert.equal(res.valido, false);
  assert.match(res.erro || '', /pelo menos 3 caracteres/);
});

test('validarNomePacienteTelegram: rejeita nome com mais de 120 caracteres', () => {
  const nomeLongo = 'A'.repeat(121);
  const res = validarNomePacienteTelegram(nomeLongo);
  assert.equal(res.valido, false);
  assert.match(res.erro || '', /no maximo 120 caracteres/);
});

test('validarNomePacienteTelegram: aceita nome no limite de 120 caracteres', () => {
  const nomeLimite = 'A'.repeat(120);
  const res = validarNomePacienteTelegram(nomeLimite);
  assert.equal(res.valido, true);
});

// -----------------------------------------------------------------------------
// 5. Validacao de alinhadores previstos
// -----------------------------------------------------------------------------
test('validarAlinhadoresPrevistos: aceita inteiro valido entre 1 e 99', () => {
  const res1 = validarAlinhadoresPrevistos('14');
  assert.equal(res1.valido, true);
  assert.equal(res1.numero, 14);

  const resMin = validarAlinhadoresPrevistos('1');
  assert.equal(resMin.valido, true);
  assert.equal(resMin.numero, 1);

  const resMax = validarAlinhadoresPrevistos('99');
  assert.equal(resMax.valido, true);
  assert.equal(resMax.numero, 99);
});

test('validarAlinhadoresPrevistos: rejeita 0, 100, negativos e letras', () => {
  assert.equal(validarAlinhadoresPrevistos('0').valido, false);
  assert.equal(validarAlinhadoresPrevistos('100').valido, false);
  assert.equal(validarAlinhadoresPrevistos('-5').valido, false);
  assert.equal(validarAlinhadoresPrevistos('abc').valido, false);
  assert.equal(validarAlinhadoresPrevistos('').valido, false);
});

// -----------------------------------------------------------------------------
// 6. Validacao de aparelho previsto
// -----------------------------------------------------------------------------
test('validarAparelhoPrevisto: aceita nome de aparelho valido', () => {
  const res = validarAparelhoPrevisto('Disjuntor de Hyrax');
  assert.equal(res.valido, true);
  assert.equal(res.texto, 'Disjuntor de Hyrax');
});

test('validarAparelhoPrevisto: retorna null para entrada vazia', () => {
  const res = validarAparelhoPrevisto('   ');
  assert.equal(res.valido, true);
  assert.equal(res.texto, null);
});

test('validarAparelhoPrevisto: rejeita texto com mais de 100 caracteres', () => {
  const longo = 'X'.repeat(101);
  const res = validarAparelhoPrevisto(longo);
  assert.equal(res.valido, false);
  assert.match(res.erro || '', /no maximo 100 caracteres/);
});

// -----------------------------------------------------------------------------
// 7. Validacao de observacao
// -----------------------------------------------------------------------------
test('validarObservacaoTelegram: aceita observacao ate 500 caracteres', () => {
  const obs = 'Paciente com mordida cruzada e apinhamento severo.';
  const res = validarObservacaoTelegram(obs);
  assert.equal(res.valido, true);
  assert.equal(res.texto, obs);
});

test('validarObservacaoTelegram: retorna null para observacao vazia', () => {
  const res = validarObservacaoTelegram('');
  assert.equal(res.valido, true);
  assert.equal(res.texto, null);
});

test('validarObservacaoTelegram: rejeita observacao com mais de 500 caracteres', () => {
  const longa = 'O'.repeat(501);
  const res = validarObservacaoTelegram(longa);
  assert.equal(res.valido, false);
  assert.match(res.erro || '', /no maximo 500 caracteres/);
});

// -----------------------------------------------------------------------------
// 8. Formatacao do menu principal e botoes
// -----------------------------------------------------------------------------
test('gerarMenuPrincipalTelegram: retorna texto com menu inicial (Novo paciente alinhador, Novo paciente ortopedico, Pendentes, Cancelar)', () => {
  const menu = gerarMenuPrincipalTelegram();
  assert.match(menu.texto, /Alinhadores e Ortopedicos/);
  assert.equal(menu.botoes.length, 2);
  assert.equal(menu.botoes[0][0].callback_data, 'menu:novo_alinhador');
  assert.equal(menu.botoes[0][1].callback_data, 'menu:novo_ortopedico');
  assert.equal(menu.botoes[1][0].callback_data, 'menu:pendentes');
  assert.equal(menu.botoes[1][1].callback_data, 'cancelar');
});

// -----------------------------------------------------------------------------
// 9. Formatacao de resumo do cadastro
// -----------------------------------------------------------------------------
test('formatarResumoCadastro: formata corretamente paciente de alinhador', () => {
  const dados: any = {
    tipo: 'alinhador',
    nome: 'Mariana Duarte',
    turma_nome: 'Especializacao T05',
    previsto: 20,
    observacao: 'Troca a cada 15 dias'
  };
  const resumo = formatarResumoCadastro(dados);
  assert.match(resumo, /Mariana Duarte/);
  assert.match(resumo, /Especializacao T05/);
  assert.match(resumo, /Total Previsto: 20/);
  assert.match(resumo, /Troca a cada 15 dias/);
  assert.match(resumo, /Deseja confirmar o cadastro?/);
});

test('formatarResumoCadastro: formata corretamente paciente ortopedico sem previsto e sem obs', () => {
  const dados: any = {
    tipo: 'ortopedico',
    nome: 'Lucas Mendes',
    turma_nome: 'Especializacao T04',
    previsto: null,
    observacao: null
  };
  const resumo = formatarResumoCadastro(dados);
  assert.match(resumo, /Lucas Mendes/);
  assert.match(resumo, /Aparelho Ortopedico/);
  assert.match(resumo, /Aparelho Previsto: Nao informado/);
  assert.match(resumo, /Observacao: Nenhuma/);
});

// -----------------------------------------------------------------------------
// 10. Formatacao de lista de pendentes
// -----------------------------------------------------------------------------
test('formatarListaPendentes: lista vazia informa mensagem amigavel', () => {
  const texto = formatarListaPendentes([]);
  assert.match(texto, /Nenhum pedido de alinhador ou aparelho ortopedico esta pendente/);
});

test('formatarListaPendentes: separa pedidos em ALINHADORES e APARELHOS ORTOPEDICOS', () => {
  const pedidos: ItemPendenteView[] = [
    {
      id: 'p1',
      paciente_nome: 'Joao da Silva',
      turma_nome: 'T01',
      tipo: 'alinhador',
      status: 'atrasado',
      prazo_formatado: '10/11/2026'
    },
    {
      id: 'p2',
      paciente_nome: 'Maria Clara',
      turma_nome: 'T02',
      tipo: 'ortopedico',
      aparelho: 'Mantenedor de Espaco',
      status: 'vencendo',
      prazo_formatado: '15/11/2026'
    }
  ];

  const texto = formatarListaPendentes(pedidos);
  assert.match(texto, /ALINHADORES:/);
  assert.equal(texto.includes('[ATRASADO] Joao da Silva (T01) - Prazo: 10/11/2026'), true);
  assert.match(texto, /APARELHOS ORTOPEDICOS:/);
  assert.equal(texto.includes('[VENCENDO] Maria Clara: Mantenedor de Espaco (T02) - Prazo: 15/11/2026'), true);
});

// -----------------------------------------------------------------------------
// 11. Geracao de aviso diario
// -----------------------------------------------------------------------------
test('montarAvisoDiarioTelegram: retorna null se nao houver pendencias vencendo ou atrasadas', () => {
  const aviso = montarAvisoDiarioTelegram([]);
  assert.equal(aviso, null);
});

test('montarAvisoDiarioTelegram: separa atrasados de vencendo e cria botoes inline', () => {
  const itens: ItemAvisoDiario[] = [
    {
      id: 'id-1',
      paciente_nome: 'Pedro Alcantara',
      turma_nome: 'T01',
      tipo: 'alinhador',
      status: 'atrasado',
      prazo_formatado: '05/11/2026'
    },
    {
      id: 'id-2',
      paciente_nome: 'Camila Pitanga',
      turma_nome: 'T02',
      tipo: 'ortopedico',
      aparelho: 'Bionator',
      status: 'vencendo',
      prazo_formatado: '14/11/2026'
    }
  ];

  const aviso = montarAvisoDiarioTelegram(itens);
  assert.notEqual(aviso, null);
  assert.match(aviso!.texto, /ATRASADOS:/);
  assert.match(aviso!.texto, /Pedro Alcantara/);
  assert.match(aviso!.texto, /VENCENDO:/);
  assert.match(aviso!.texto, /Camila Pitanga/);

  // Botoes inline para confirmar solicitacao com o primeiro nome
  assert.equal(aviso!.botoes.length, 2);
  assert.equal(aviso!.botoes[0][0].text, 'Pedido feito: Pedro');
  assert.equal(aviso!.botoes[0][0].callback_data, 'ped_feito:id-1');
  assert.equal(aviso!.botoes[1][0].text, 'Pedido feito: Camila');
  assert.equal(aviso!.botoes[1][0].callback_data, 'ped_feito:id-2');
});

test('montarAvisoDiarioTelegram: limita a 10 itens e exibe sufixo com excedente', () => {
  const itens: ItemAvisoDiario[] = [];
  for (let i = 1; i <= 13; i++) {
    itens.push({
      id: `id-${i}`,
      paciente_nome: `Paciente ${i.toString().padStart(2, '0')}`,
      turma_nome: 'T01',
      tipo: 'alinhador',
      status: 'atrasado',
      prazo_formatado: '01/11/2026'
    });
  }

  const aviso = montarAvisoDiarioTelegram(itens, 10);
  assert.notEqual(aviso, null);
  assert.equal(aviso!.botoes.length, 10);
  assert.match(aviso!.texto, /\.\.\. e mais 3, veja na plataforma\./);
});

// -----------------------------------------------------------------------------
// 12. Deduplicacao de aviso diario
// -----------------------------------------------------------------------------
test('verificarJaEnviouAvisoHoje: detecta se ja foi enviado no mesmo dia ISO', () => {
  assert.equal(verificarJaEnviouAvisoHoje(null, '2026-11-11'), false);
  assert.equal(verificarJaEnviouAvisoHoje(undefined, '2026-11-11'), false);
  assert.equal(verificarJaEnviouAvisoHoje('2026-11-10T12:00:00Z', '2026-11-11'), false);
  assert.equal(verificarJaEnviouAvisoHoje('2026-11-11T08:00:00Z', '2026-11-11'), true);
});

// -----------------------------------------------------------------------------
// 13. Maquina de estados do cadastro
// -----------------------------------------------------------------------------
test('maquina de estados: deteccao de nomes similares mostra ate 3 pacientes', () => {
  const pacientesExistentes: PacienteParaVerificacaoNome[] = [
    { id: '1', nome: 'Ana Carolina Santos', turma_nome: 'T01' },
    { id: '2', nome: 'Ana Carolina de Souza', turma_nome: 'T02' },
    { id: '3', nome: 'Ana Carolina Pereira', turma_nome: 'T03' },
    { id: '4', nome: 'Ana Carolina Duarte', turma_nome: 'T04' }
  ];

  const res = verificarNomeSimilarTelegram('Ana Carolina Santos', pacientesExistentes);
  assert.equal(res.temConflito, true);
  assert.equal(res.tipoConflito, 'exato');
  assert.equal(res.conflitos.length <= 3, true);
});

test('maquina de estados: decisao de conflito de nome - criar mesmo assim avanca para cadastro_turma', () => {
  const estadoInicial: TelegramEstadoConversa = {
    chat_id: 123,
    passo: 'cadastro_conflito_nome',
    dados: { tipo: 'alinhador', nome: 'Marcos Vinicius' },
    updated_at: new Date().toISOString()
  };

  const res = processarDecisaoConflito('criar_mesmo_assim', estadoInicial);
  assert.equal(res.proximoPasso, 'cadastro_turma');
  assert.equal(res.estadoAtualizado.passo, 'cadastro_turma');
  assert.equal(res.estadoAtualizado.dados.nome, 'Marcos Vinicius');
});

test('maquina de estados: decisao de conflito de nome - cancelar limpa e volta para aguardando_acao', () => {
  const estadoInicial: TelegramEstadoConversa = {
    chat_id: 123,
    passo: 'cadastro_conflito_nome',
    dados: { tipo: 'alinhador', nome: 'Marcos Vinicius' },
    updated_at: new Date().toISOString()
  };

  const res = processarDecisaoConflito('cancelar', estadoInicial);
  assert.equal(res.proximoPasso, 'aguardando_acao');
  assert.equal(res.estadoAtualizado.passo, 'aguardando_acao');
  assert.deepEqual(res.estadoAtualizado.dados, {});
});

test('maquina de estados: pular quantidade prevista no alinhador avanca com null', () => {
  const res = processarInputPrevisto('pular', 'alinhador');
  assert.equal(res.valido, true);
  assert.equal(res.pulou, true);
  assert.equal(res.valorFinal, null);
  assert.equal(res.proximoPasso, 'cadastro_obs');

  const resSlash = processarInputPrevisto('/pular', 'alinhador');
  assert.equal(resSlash.valido, true);
  assert.equal(resSlash.pulou, true);
});

test('maquina de estados: informar quantidade prevista valida no alinhador avanca com o numero', () => {
  const res = processarInputPrevisto('15', 'alinhador');
  assert.equal(res.valido, true);
  assert.equal(res.pulou, false);
  assert.equal(res.valorFinal, 15);
  assert.equal(res.proximoPasso, 'cadastro_obs');
});

test('maquina de estados: quantidade prevista invalida no alinhador permanece no mesmo passo com erro', () => {
  const res = processarInputPrevisto('cento e vinte', 'alinhador');
  assert.equal(res.valido, false);
  assert.equal(res.proximoPasso, 'cadastro_previsto');
  assert.notEqual(res.erro, undefined);
});

test('maquina de estados: pular observacao avanca para confirmacao com null', () => {
  const res = processarInputObservacao('pular');
  assert.equal(res.valido, true);
  assert.equal(res.pulou, true);
  assert.equal(res.observacaoFinal, null);
  assert.equal(res.proximoPasso, 'cadastro_confirmacao');
});

test('maquina de estados: observacao valida avanca para confirmacao com texto limpo', () => {
  const res = processarInputObservacao('  Paciente prefere atendimento vespertino  ');
  assert.equal(res.valido, true);
  assert.equal(res.pulou, false);
  assert.equal(res.observacaoFinal, 'Paciente prefere atendimento vespertino');
  assert.equal(res.proximoPasso, 'cadastro_confirmacao');
});

test('maquina de estados: validacao final de dados para gravacao no banco', () => {
  assert.equal(validarDadosParaGravacao({ nome: 'Joao', turma_id: 't1', tipo: 'alinhador' }).valido, true);
  assert.equal(validarDadosParaGravacao({ nome: 'Joao', turma_id: '', tipo: 'alinhador' }).valido, false);
  assert.equal(validarDadosParaGravacao({ nome: 'J', turma_id: 't1', tipo: 'alinhador' }).valido, false);
});

// -----------------------------------------------------------------------------
// 14. Teste de paridade com as regras de negocio do app
// -----------------------------------------------------------------------------
test('paridade: calculo de data de retorno de alinhadores no Telegram equivale a regra de planejarSincronizacao', () => {
  const hoje = '2026-11-10';
  const datasCalendarioTurma = [
    '2026-11-05',
    '2026-11-06',
    '2026-12-03',
    '2026-12-04',
    '2027-01-14',
    '2027-01-15'
  ];

  // Calculo direto do proximo bloco (mesmo algoritmo usado no bot do Telegram)
  const blocos = agruparBlocos(datasCalendarioTurma);
  const prox = proximoBloco(blocos, hoje);
  assert.notEqual(prox, null);
  const dataRetornoTelegram = prox!.base;

  // Calculo via funcao pura oficial do app: planejarSincronizacao
  const planoApp = planejarSincronizacao({
    pacientes: [{ id: 'pac-novo', turma_id: 'turma-a', ativo: true }],
    datasPorTurma: { 'turma-a': datasCalendarioTurma },
    pedidosExistentes: [],
    hoje
  });

  assert.equal(planoApp.inserir.length, 1);
  const dataRetornoApp = planoApp.inserir[0].data_retorno;

  // Paridade estrita: a data atribuida pelo bot deve ser identica a gerada pelo app
  assert.equal(dataRetornoTelegram, dataRetornoApp);
  assert.equal(dataRetornoTelegram, '2026-12-03');
});

test('paridade: calculo de data de retorno de ortopedicos no Telegram equivale a regra de planejarSincronizacaoOrtopedicos', () => {
  const hoje = '2026-11-10';
  const datasCalendarioTurma = [
    '2026-10-20',
    '2026-10-21',
    '2026-11-25',
    '2026-11-26',
    '2026-12-15'
  ];

  // Calculo direto do proximo bloco (mesmo algoritmo do bot)
  const blocos = agruparBlocos(datasCalendarioTurma);
  const prox = proximoBloco(blocos, hoje);
  assert.notEqual(prox, null);
  const dataRetornoTelegram = prox!.base;

  // Calculo via funcao pura oficial do app: planejarSincronizacaoOrtopedicos
  const planoApp = planejarSincronizacaoOrtopedicos({
    pacientes: [{
      id: 'pac-orto-1',
      turma_id: 'turma-b',
      tipo: 'ortopedico',
      aparelho_previsto: 'Disjuntor de McNamara',
      ativo: true
    }],
    datasPorTurma: { 'turma-b': datasCalendarioTurma },
    pedidosExistentes: [],
    hoje
  });

  assert.equal(planoApp.inserir.length, 1);
  const dataRetornoApp = planoApp.inserir[0].data_retorno;

  // Paridade estrita
  assert.equal(dataRetornoTelegram, dataRetornoApp);
  assert.equal(dataRetornoTelegram, '2026-11-25');
  assert.equal(planoApp.inserir[0].aparelho, 'Disjuntor de McNamara');
});


// -----------------------------------------------------------------------------
// 15. Auditoria de teclados e passo de selecao de turmas
// -----------------------------------------------------------------------------
test('passo de turma retorna teclado com um botao por turma', () => {
  const turmas = [
    { id: 't1', nome: 'ESP1' },
    { id: 't2', nome: 'ESP2' },
    { id: 't3', nome: 'SERVICO' }
  ];
  const res = gerarTecladoTurmasTelegram(turmas);
  assert.equal(res.temTurmas, true);
  assert.match(res.mensagem, /Escolha a turma/);
  assert.equal(res.botoes.length, 4); // 3 turmas + Cancelar
  assert.equal(res.botoes[0][0].text, 'ESP1');
  assert.equal(res.botoes[0][0].callback_data, 'turma:t1:ESP1');
  assert.equal(res.botoes[1][0].text, 'ESP2');
  assert.equal(res.botoes[1][0].callback_data, 'turma:t2:ESP2');
  assert.equal(res.botoes[2][0].text, 'SERVICO');
  assert.equal(res.botoes[2][0].callback_data, 'turma:t3:SERVICO');
  assert.equal(res.botoes[3][0].text, 'Cancelar');
  assert.equal(res.botoes[3][0].callback_data, 'cancelar');
});

test('passo de turma: turma vazia retorna erro sem pedir texto', () => {
  const res = gerarTecladoTurmasTelegram([]);
  assert.equal(res.temTurmas, false);
  assert.match(res.mensagem, /Nenhuma turma cadastrada/);
  assert.equal(res.botoes.length, 0);
});

test('passo de turma: texto digitado no passo de turma reenvia os botoes', () => {
  const turmas = [
    { id: 't1', nome: 'ESP1' },
    { id: 't2', nome: 'ESP2' }
  ];
  const res = processarTextoEmCadastroTurma(turmas, 'Lucas Silva');
  assert.equal(res.valido, false);
  assert.match(res.mensagem, /Por favor, selecione a turma do paciente "Lucas Silva" usando os botoes abaixo:/);
  assert.equal(res.botoes.length, 3); // 2 turmas + Cancelar
  assert.equal(res.botoes[0][0].text, 'ESP1');
  assert.equal(res.botoes[1][0].text, 'ESP2');
  assert.equal(res.botoes[2][0].text, 'Cancelar');
});

test('auditoria de teclados: nome parecido retorna botoes E este, Criar novo mesmo assim e Cancelar', () => {
  const conflitos = [
    { id: 'c1', nome: 'Mariana Duarte', turma: 'ESP1' }
  ];
  const botoes = gerarTecladoConflitoNome(conflitos);
  assert.equal(botoes.length, 3);
  assert.equal(botoes[0][0].text, 'E este: Mariana Duarte (ESP1)');
  assert.equal(botoes[0][0].callback_data, 'conf_exist:c1');
  assert.equal(botoes[1][0].text, 'Criar novo mesmo assim');
  assert.equal(botoes[1][0].callback_data, 'conf_novo');
  assert.equal(botoes[2][0].text, 'Cancelar');
  assert.equal(botoes[2][0].callback_data, 'cancelar');
});

test('auditoria de teclados: passo previsto retorna botao Pular e Cancelar', () => {
  const botoes = gerarTecladoPrevisto();
  assert.equal(botoes.length, 2);
  assert.equal(botoes[0][0].text, 'Pular');
  assert.equal(botoes[0][0].callback_data, 'pular_previsto');
  assert.equal(botoes[1][0].text, 'Cancelar');
  assert.equal(botoes[1][0].callback_data, 'cancelar');
});

test('auditoria de teclados: passo observacoes retorna botao Pular e Cancelar', () => {
  const botoes = gerarTecladoObservacao();
  assert.equal(botoes.length, 2);
  assert.equal(botoes[0][0].text, 'Pular');
  assert.equal(botoes[0][0].callback_data, 'pular_obs');
  assert.equal(botoes[1][0].text, 'Cancelar');
  assert.equal(botoes[1][0].callback_data, 'cancelar');
});

test('auditoria de teclados: passo resumo retorna Confirmar cadastro e Cancelar', () => {
  const botoes = gerarTecladoConfirmacaoCadastro();
  assert.equal(botoes.length, 2);
  assert.equal(botoes[0][0].text, 'Confirmar cadastro');
  assert.equal(botoes[0][0].callback_data, 'conf_gravar');
  assert.equal(botoes[1][0].text, 'Cancelar');
  assert.equal(botoes[1][0].callback_data, 'cancelar');
});

console.log('\n================================================================');
console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam (Total: ${passou + falhou})`);
console.log('================================================================');

if (falhou > 0) {
  process.exit(1);
}
