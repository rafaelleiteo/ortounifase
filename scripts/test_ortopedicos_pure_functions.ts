import assert from 'node:assert/strict';
import {
  calcularPrazoLimiteOrtopedico,
  calcularStatusPedidoOrtopedico,
  gerarMensagemLaboratorioOrtopedico,
  verificarNomeExistenteOuParecido,
  filtrarPedidosPorTipo,
  filtrarPacientesPorTipo,
  planejarNovoPedidoOrtopedico
} from '../src/lib/ortopedicosPure';
import {
  formatarDataISO,
  parseDataLocal,
  AlinhadorPedido,
  AlinhadorPaciente,
  TEMPLATE_MENSAGEM_ORTOPEDICO_PADRAO
} from '../src/lib/alinhadoresTypes';

console.log('--- INICIANDO TESTES DE FUNCOES PURAS DE ORTOPEDICOS ---');

// TESTE 1: Prazo com virada de mes e de ano
{
  console.log('Teste 1: Prazo com virada de mes e ano');
  
  // Virada de mes comum: 10 de marco com 20 dias de antecedencia -> 18 de fevereiro (em ano nao bissexto 2025)
  const prazoMarco = calcularPrazoLimiteOrtopedico('2025-03-10', 20);
  assert.equal(formatarDataISO(prazoMarco), '2025-02-18');

  // Virada de ano: 10 de janeiro de 2027 com 20 dias de antecedencia -> 21 de dezembro de 2026
  const prazoAno = calcularPrazoLimiteOrtopedico('2027-01-10', 20);
  assert.equal(formatarDataISO(prazoAno), '2026-12-21');

  // Prazo dentro do mesmo mes: 25 de novembro com 10 dias -> 15 de novembro
  const prazoMesmoMes = calcularPrazoLimiteOrtopedico('2026-11-25', 10);
  assert.equal(formatarDataISO(prazoMesmoMes), '2026-11-15');
  console.log('  [OK] Virada de mes e ano calculada corretamente.');
}

// TESTE 2: Estados pendente, vencendo, atrasado e solicitado
{
  console.log('Teste 2: Estados pendente, vencendo, atrasado e solicitado');
  const hoje = parseDataLocal('2026-11-10');
  const antecedencia = 20;

  // Caso 1: Retorno em 2026-12-15 (prazo limite: 2026-11-25)
  // Hoje (10/11) esta a 15 dias do prazo limite -> pendente
  const pedidoPendente: AlinhadorPedido = {
    id: 'p1',
    paciente_id: 'pac1',
    data_retorno: '2026-12-15',
    alinhador_de: null,
    alinhador_ate: null,
    solicitado_em: null,
    lote_id: null,
    observacao: null,
    mensagem_enviada_em: null,
    tipo: 'ortopedico',
    aparelho: 'Disjuntor de Hyrax'
  };
  assert.equal(calcularStatusPedidoOrtopedico(pedidoPendente, hoje, antecedencia), 'pendente');

  // Caso 2: Retorno em 2026-11-30 (prazo limite: 2026-11-10)
  // Hoje (10/11) e exatamente a data limite (faltam 0 dias) -> vencendo (<= 3 dias)
  const pedidoVencendo: AlinhadorPedido = {
    ...pedidoPendente,
    id: 'p2',
    data_retorno: '2026-11-30'
  };
  assert.equal(calcularStatusPedidoOrtopedico(pedidoVencendo, hoje, antecedencia), 'vencendo');

  // Caso 3: Retorno em 2026-11-20 (prazo limite: 2026-10-31)
  // Hoje (10/11) ja passou do prazo limite (31/10) mas ainda nao passou da consulta (20/11) -> atrasado
  const pedidoAtrasado: AlinhadorPedido = {
    ...pedidoPendente,
    id: 'p3',
    data_retorno: '2026-11-20'
  };
  assert.equal(calcularStatusPedidoOrtopedico(pedidoAtrasado, hoje, antecedencia), 'atrasado');

  // Caso 4: Retorno em 2026-11-05 (hoje 10/11 ja passou do retorno) -> expirado
  const pedidoExpirado: AlinhadorPedido = {
    ...pedidoPendente,
    id: 'p4',
    data_retorno: '2026-11-05'
  };
  assert.equal(calcularStatusPedidoOrtopedico(pedidoExpirado, hoje, antecedencia), 'expirado');

  // Caso 5: Pedido ja solicitado
  const pedidoSolicitado: AlinhadorPedido = {
    ...pedidoAtrasado,
    id: 'p5',
    solicitado_em: '2026-10-25'
  };
  assert.equal(calcularStatusPedidoOrtopedico(pedidoSolicitado, hoje, antecedencia), 'solicitado');
  console.log('  [OK] Estados calculados corretamente.');
}

// TESTE 3: Solicitado nao alerta de novo
{
  console.log('Teste 3: Solicitado nao alerta de novo');
  const hoje = parseDataLocal('2026-11-10');
  const pedido: AlinhadorPedido = {
    id: 'p_solic',
    paciente_id: 'pac1',
    data_retorno: '2026-11-12', // Prazo ja estaria super atrasado se nao solicitado
    alinhador_de: null,
    alinhador_ate: null,
    solicitado_em: '2026-10-15',
    lote_id: 'lote-123',
    observacao: null,
    mensagem_enviada_em: '2026-10-16',
    tipo: 'ortopedico',
    aparelho: 'Placa de Hawley'
  };

  const status = calcularStatusPedidoOrtopedico(pedido, hoje, 20);
  assert.equal(status, 'solicitado');
  assert.notEqual(status, 'atrasado');
  assert.notEqual(status, 'vencendo');
  console.log('  [OK] Pedido solicitado permanece estavel como solicitado sem disparar alerta.');
}

// TESTE 4: Novo aparelho gera novo pedido independente
{
  console.log('Teste 4: Novo aparelho gera novo pedido');
  const plano = planejarNovoPedidoOrtopedico({
    pacienteId: 'pac123',
    dataRetorno: '2026-12-10',
    aparelho: 'Bionator de Balters',
    observacao: 'Ajuste de mordida'
  });

  assert.equal(plano.paciente_id, 'pac123');
  assert.equal(plano.data_retorno, '2026-12-10');
  assert.equal(plano.aparelho, 'Bionator de Balters');
  assert.equal(plano.observacao, 'Ajuste de mordida');
  assert.equal(plano.tipo, 'ortopedico');
  assert.equal(plano.solicitado_em, null);
  assert.equal(plano.mensagem_enviada_em, null);
  console.log('  [OK] Planejamento de novo pedido ortopedico estruturado com sucesso.');
}

// TESTE 5: Mensagem para laboratorio com 1, 2 e 3 pacientes
{
  console.log('Teste 5: Mensagem para laboratorio com 1, 2 e 3 pacientes');

  // 1 paciente com template padrao
  const msg1 = gerarMensagemLaboratorioOrtopedico([
    { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' }
  ]);
  assert.match(msg1, /Lucas Silva/);
  assert.match(msg1, /Disjuntor de Hyrax/);
  assert.match(msg1, /01\/12\/2026/);

  // Template com marcador {pacientes} e {lista}
  const templateComPacientes = 'Favor confeccionar para {pacientes}:\n\n{lista}';

  const msg1Custom = gerarMensagemLaboratorioOrtopedico([
    { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' }
  ], templateComPacientes);
  assert.match(msg1Custom, /Favor confeccionar para Lucas Silva:/);
  assert.match(msg1Custom, /Disjuntor de Hyrax/);

  // 2 pacientes
  const msg2 = gerarMensagemLaboratorioOrtopedico([
    { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' },
    { paciente_nome: 'Mariana Costa', data_retorno: '2026-12-01', aparelho: 'Placa de Hawley' }
  ], templateComPacientes);
  assert.match(msg2, /Favor confeccionar para Lucas Silva e Mariana Costa:/);
  assert.match(msg2, /Disjuntor de Hyrax/);
  assert.match(msg2, /Placa de Hawley/);

  // 3 pacientes
  const msg3 = gerarMensagemLaboratorioOrtopedico([
    { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' },
    { paciente_nome: 'Mariana Costa', data_retorno: '2026-12-01', aparelho: 'Placa de Hawley' },
    { paciente_nome: 'Pedro Rocha', data_retorno: '2026-12-05', aparelho: 'Grade Palatina' }
  ], templateComPacientes);
  assert.match(msg3, /Favor confeccionar para Lucas Silva, Mariana Costa e Pedro Rocha:/);
  assert.match(msg3, /Grade Palatina/);
  assert.match(msg3, /05\/12\/2026/);
  console.log('  [OK] Mensagens para 1, 2 e 3 pacientes geradas com formatacao correta.');
}

// TESTE 6: Template sem marcador
{
  console.log('Teste 6: Template sem marcador anexa lista detalhada ao final');
  const templateSemMarcador = 'Ola laboratorio, favor confeccionar os aparelhos solicitados com urgencia.';
  const msgCustom = gerarMensagemLaboratorioOrtopedico(
    [{ paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' }],
    templateSemMarcador
  );

  assert.ok(msgCustom.startsWith(templateSemMarcador));
  assert.ok(msgCustom.includes('- Lucas Silva: Disjuntor de Hyrax, retorno previsto em 01/12/2026'));
  console.log('  [OK] Template sem marcador anexa a lista automaticamente.');
}

// TESTE 7: Aviso de nome parecido sem bloqueio
{
  console.log('Teste 7: Aviso de nome parecido sem bloqueio');
  const nomesCadastrados = [
    'Carlos Eduardo da Silva',
    'Beatriz Albuquerque',
    'Mariana Ribeiro'
  ];

  // Nome identico
  const checkExato = verificarNomeExistenteOuParecido('Carlos Eduardo da Silva', nomesCadastrados);
  assert.equal(checkExato.existeExato, true);
  assert.equal(checkExato.temParecido, true);

  // Nome com pequenas diferencas/acentuacao/typo (distancia <= 2)
  const checkParecido = verificarNomeExistenteOuParecido('Carlos Eduardo da Silve', nomesCadastrados);
  assert.equal(checkParecido.existeExato, false);
  assert.equal(checkParecido.temParecido, true);
  assert.equal(checkParecido.nomeParecido, 'Carlos Eduardo da Silva');

  // Nome completamente diferente
  const checkDiferente = verificarNomeExistenteOuParecido('Rodrigo Fernandes', nomesCadastrados);
  assert.equal(checkDiferente.existeExato, false);
  assert.equal(checkDiferente.temParecido, false);
  assert.equal(checkDiferente.nomeParecido, null);
  console.log('  [OK] Verificacao de similaridade de nomes funciona sem bloqueio.');
}

// TESTE 8: Filtro por tipo
{
  console.log('Teste 8: Filtro por tipo de pedido e paciente');

  const pedidosLista: AlinhadorPedido[] = [
    {
      id: 'p1',
      paciente_id: 'pac1',
      data_retorno: '2026-12-01',
      alinhador_de: 1,
      alinhador_ate: 2,
      solicitado_em: null,
      lote_id: null,
      observacao: null,
      mensagem_enviada_em: null,
      tipo: 'alinhador'
    },
    {
      id: 'p2',
      paciente_id: 'pac2',
      data_retorno: '2026-12-01',
      alinhador_de: null,
      alinhador_ate: null,
      solicitado_em: null,
      lote_id: null,
      observacao: null,
      mensagem_enviada_em: null,
      tipo: 'ortopedico',
      aparelho: 'Disjuntor de Hyrax'
    },
    {
      id: 'p3',
      paciente_id: 'pac3',
      data_retorno: '2026-12-05',
      alinhador_de: 3,
      alinhador_ate: 4,
      solicitado_em: null,
      lote_id: null,
      observacao: null,
      mensagem_enviada_em: null
      // tipo undefined -> considerado alinhador
    }
  ];

  const soAlinhadores = filtrarPedidosPorTipo(pedidosLista, 'alinhador');
  assert.equal(soAlinhadores.length, 2);
  assert.deepEqual(soAlinhadores.map((p) => p.id), ['p1', 'p3']);

  const soOrtopedicos = filtrarPedidosPorTipo(pedidosLista, 'ortopedico');
  assert.equal(soOrtopedicos.length, 1);
  assert.deepEqual(soOrtopedicos.map((p) => p.id), ['p2']);

  const todosPedidos = filtrarPedidosPorTipo(pedidosLista, 'todos');
  assert.equal(todosPedidos.length, 3);

  const pacientesLista: AlinhadorPaciente[] = [
    {
      id: 'pac1',
      nome: 'Paciente 1',
      turma_id: 't1',
      total_alinhadores: 10,
      observacao: null,
      ativo: true,
      tipo: 'alinhador'
    },
    {
      id: 'pac2',
      nome: 'Paciente 2',
      turma_id: 't1',
      total_alinhadores: null,
      aparelho_previsto: 'Hyrax',
      observacao: null,
      ativo: true,
      tipo: 'ortopedico'
    }
  ];

  assert.equal(filtrarPacientesPorTipo(pacientesLista, 'alinhador').length, 1);
  assert.equal(filtrarPacientesPorTipo(pacientesLista, 'ortopedico').length, 1);
  assert.equal(filtrarPacientesPorTipo(pacientesLista).length, 2);
  console.log('  [OK] Filtros por tipo operam com total compatibilidade.');
}

console.log('--- TODOS OS TESTES DE ORTOPEDICOS PASSARAM COM SUCESSO! ---');
