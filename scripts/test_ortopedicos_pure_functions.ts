import assert from 'node:assert/strict';
import {
  calcularPrazoLimiteOrtopedico,
  calcularStatusPedidoOrtopedico,
  gerarMensagemLaboratorioOrtopedico,
  verificarNomeExistenteOuParecido,
  filtrarPedidosPorTipo,
  filtrarPacientesPorTipo,
  planejarNovoPedidoOrtopedico,
  planejarSincronizacaoOrtopedicos
} from '../src/lib/ortopedicosPure';
import {
  formatarDataISO,
  parseDataLocal,
  AlinhadorPedido,
  AlinhadorPaciente,
  planejarSincronizacao
} from '../src/lib/alinhadoresTypes';

console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: MODULO DE ORTOPEDICOS');
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

// 1. calcularPrazoLimiteOrtopedico
test('calcularPrazoLimiteOrtopedico: virada de mes comum (marco para fevereiro)', () => {
  const prazo = calcularPrazoLimiteOrtopedico('2025-03-10', 20);
  assert.equal(formatarDataISO(prazo), '2025-02-18');
});

test('calcularPrazoLimiteOrtopedico: virada de ano (janeiro para dezembro)', () => {
  const prazo = calcularPrazoLimiteOrtopedico('2027-01-10', 20);
  assert.equal(formatarDataISO(prazo), '2026-12-21');
});

test('calcularPrazoLimiteOrtopedico: prazo dentro do mesmo mes', () => {
  const prazo = calcularPrazoLimiteOrtopedico('2026-11-25', 10);
  assert.equal(formatarDataISO(prazo), '2026-11-15');
});

// 2. calcularStatusPedidoOrtopedico
const pedidoBase: AlinhadorPedido = {
  id: 'ped-base',
  paciente_id: 'pac-1',
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
const hojeRef = parseDataLocal('2026-11-10');

test('calcularStatusPedidoOrtopedico: status pendente quando prazo no futuro (> 5 dias)', () => {
  const st = calcularStatusPedidoOrtopedico(pedidoBase, hojeRef, 20);
  assert.equal(st, 'pendente');
});

test('calcularStatusPedidoOrtopedico: status vencendo quando faltam de 0 a 5 dias para o prazo', () => {
  const st = calcularStatusPedidoOrtopedico({ ...pedidoBase, data_retorno: '2026-11-30' }, hojeRef, 20);
  assert.equal(st, 'vencendo');
});

test('calcularStatusPedidoOrtopedico: status atrasado quando hoje passou do prazo limite mas antes do retorno', () => {
  const st = calcularStatusPedidoOrtopedico({ ...pedidoBase, data_retorno: '2026-11-20' }, hojeRef, 20);
  assert.equal(st, 'atrasado');
});

test('calcularStatusPedidoOrtopedico: status expirado quando hoje passou da data de retorno', () => {
  const st = calcularStatusPedidoOrtopedico({ ...pedidoBase, data_retorno: '2026-11-05' }, hojeRef, 20);
  assert.equal(st, 'expirado');
});

test('calcularStatusPedidoOrtopedico: status solicitado quando solicitado_em preenchido (nao alerta de novo)', () => {
  const st = calcularStatusPedidoOrtopedico(
    { ...pedidoBase, data_retorno: '2026-11-05', solicitado_em: '2026-10-15' },
    hojeRef,
    20
  );
  assert.equal(st, 'solicitado');
});

// 3. planejarNovoPedidoOrtopedico
test('planejarNovoPedidoOrtopedico: gera novo pedido com aparelho especificado', () => {
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
});

test('planejarNovoPedidoOrtopedico: lanca erro se data de retorno nao informada', () => {
  assert.throws(() => {
    planejarNovoPedidoOrtopedico({
      pacienteId: 'pac123',
      dataRetorno: '',
      aparelho: 'Hyrax'
    });
  }, /Data de retorno e obrigatoria/);
});

// 4. gerarMensagemLaboratorioOrtopedico
test('gerarMensagemLaboratorioOrtopedico: 1 paciente com template padrao', () => {
  const msg = gerarMensagemLaboratorioOrtopedico([
    { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' }
  ]);
  assert.match(msg, /Lucas Silva/);
  assert.match(msg, /Disjuntor de Hyrax/);
  assert.match(msg, /01\/12\/2026/);
});

test('gerarMensagemLaboratorioOrtopedico: 2 pacientes com template customizado', () => {
  const template = 'Favor confeccionar para {pacientes}:\n\n{lista}';
  const msg = gerarMensagemLaboratorioOrtopedico(
    [
      { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' },
      { paciente_nome: 'Mariana Costa', data_retorno: '2026-12-01', aparelho: 'Placa de Hawley' }
    ],
    template
  );
  assert.match(msg, /Favor confeccionar para Lucas Silva e Mariana Costa:/);
  assert.match(msg, /Disjuntor de Hyrax/);
  assert.match(msg, /Placa de Hawley/);
});

test('gerarMensagemLaboratorioOrtopedico: 3 pacientes com template customizado', () => {
  const template = 'Favor confeccionar para {pacientes}:\n\n{lista}';
  const msg = gerarMensagemLaboratorioOrtopedico(
    [
      { paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' },
      { paciente_nome: 'Mariana Costa', data_retorno: '2026-12-01', aparelho: 'Placa de Hawley' },
      { paciente_nome: 'Pedro Rocha', data_retorno: '2026-12-05', aparelho: 'Grade Palatina' }
    ],
    template
  );
  assert.match(msg, /Favor confeccionar para Lucas Silva, Mariana Costa e Pedro Rocha:/);
  assert.match(msg, /Grade Palatina/);
  assert.match(msg, /05\/12\/2026/);
});

test('gerarMensagemLaboratorioOrtopedico: template sem marcadores anexa lista ao final', () => {
  const template = 'Ola laboratorio, segue pedido com urgencia.';
  const msg = gerarMensagemLaboratorioOrtopedico(
    [{ paciente_nome: 'Lucas Silva', data_retorno: '2026-12-01', aparelho: 'Disjuntor de Hyrax' }],
    template
  );
  assert.ok(msg.startsWith(template));
  assert.ok(msg.includes('- Lucas Silva: Disjuntor de Hyrax, retorno previsto em 01/12/2026'));
});

// 5. verificarNomeExistenteOuParecido
test('verificarNomeExistenteOuParecido: detecta nome identico', () => {
  const nomes = ['Carlos Eduardo da Silva', 'Beatriz Albuquerque'];
  const res = verificarNomeExistenteOuParecido('Carlos Eduardo da Silva', nomes);
  assert.equal(res.existeExato, true);
  assert.equal(res.temParecido, true);
});

test('verificarNomeExistenteOuParecido: detecta nome parecido (distancia de edicao <= 2)', () => {
  const nomes = ['Carlos Eduardo da Silva', 'Beatriz Albuquerque'];
  const res = verificarNomeExistenteOuParecido('Carlos Eduardo da Silve', nomes);
  assert.equal(res.existeExato, false);
  assert.equal(res.temParecido, true);
  assert.equal(res.nomeParecido, 'Carlos Eduardo da Silva');
});

test('verificarNomeExistenteOuParecido: aceita nome diferente sem conflito', () => {
  const nomes = ['Carlos Eduardo da Silva', 'Beatriz Albuquerque'];
  const res = verificarNomeExistenteOuParecido('Rodrigo Fernandes', nomes);
  assert.equal(res.existeExato, false);
  assert.equal(res.temParecido, false);
  assert.equal(res.nomeParecido, null);
});

// 6. filtrarPedidosPorTipo e filtrarPacientesPorTipo
test('filtrarPedidosPorTipo e filtrarPacientesPorTipo: filtros operam com total compatibilidade', () => {
  const pedidos: AlinhadorPedido[] = [
    { ...pedidoBase, id: 'p1', tipo: 'alinhador' },
    { ...pedidoBase, id: 'p2', tipo: 'ortopedico', aparelho: 'Hyrax' },
    { ...pedidoBase, id: 'p3', tipo: undefined }
  ];
  assert.equal(filtrarPedidosPorTipo(pedidos, 'alinhador').length, 2);
  assert.equal(filtrarPedidosPorTipo(pedidos, 'ortopedico').length, 1);
  assert.equal(filtrarPedidosPorTipo(pedidos, 'todos').length, 3);

  const pacientes: AlinhadorPaciente[] = [
    { id: 'pac1', nome: 'P1', turma_id: 't1', total_alinhadores: 10, observacao: null, ativo: true, tipo: 'alinhador' },
    { id: 'pac2', nome: 'P2', turma_id: 't1', total_alinhadores: null, aparelho_previsto: 'Hyrax', observacao: null, ativo: true, tipo: 'ortopedico' }
  ];
  assert.equal(filtrarPacientesPorTipo(pacientes, 'alinhador').length, 1);
  assert.equal(filtrarPacientesPorTipo(pacientes, 'ortopedico').length, 1);
  assert.equal(filtrarPacientesPorTipo(pacientes).length, 2);
});

// 7. planejarSincronizacaoOrtopedicos
test('planejarSincronizacaoOrtopedicos: gera um pedido inicial para paciente ativo no proximo bloco clinico', () => {
  const plano = planejarSincronizacaoOrtopedicos({
    pacientes: [
      { id: 'orto-1', turma_id: 'turma-esp1', ativo: true, tipo: 'ortopedico', aparelho_previsto: 'Disjuntor de Hyrax' }
    ],
    datasPorTurma: {
      'turma-esp1': ['2026-11-20', '2026-11-21', '2026-12-15']
    },
    pedidosExistentes: [],
    hoje: '2026-11-10'
  });

  assert.equal(plano.inserir.length, 1);
  assert.equal(plano.inserir[0].paciente_id, 'orto-1');
  assert.equal(plano.inserir[0].data_retorno, '2026-11-20');
  assert.equal(plano.inserir[0].tipo, 'ortopedico');
  assert.equal(plano.inserir[0].aparelho, 'Disjuntor de Hyrax');
});

test('planejarSincronizacaoOrtopedicos: nao gera novos pedidos para paciente que ja possui pedido (um pedido por paciente)', () => {
  const plano = planejarSincronizacaoOrtopedicos({
    pacientes: [
      { id: 'orto-1', turma_id: 'turma-esp1', ativo: true, tipo: 'ortopedico', aparelho_previsto: 'Disjuntor de Hyrax' }
    ],
    datasPorTurma: {
      'turma-esp1': ['2026-11-20', '2026-11-21', '2026-12-15']
    },
    pedidosExistentes: [
      { id: 'ped-antigo', paciente_id: 'orto-1', data_retorno: '2026-11-20', tipo: 'ortopedico', aparelho: 'Disjuntor de Hyrax', solicitado_em: null }
    ],
    hoje: '2026-11-10'
  });

  assert.equal(plano.inserir.length, 0);
});

test('planejarSincronizacaoOrtopedicos: pedido solicitado nao gera pedido no proximo bloco (depois de solicitado nao alerta e nao gera duplicata)', () => {
  const plano = planejarSincronizacaoOrtopedicos({
    pacientes: [
      { id: 'orto-1', turma_id: 'turma-esp1', ativo: true, tipo: 'ortopedico', aparelho_previsto: 'Disjuntor de Hyrax' }
    ],
    datasPorTurma: {
      'turma-esp1': ['2026-11-20', '2026-11-21', '2026-12-15']
    },
    pedidosExistentes: [
      { id: 'ped-solic', paciente_id: 'orto-1', data_retorno: '2026-11-20', tipo: 'ortopedico', aparelho: 'Disjuntor de Hyrax', solicitado_em: '2026-11-01' }
    ],
    hoje: '2026-11-10'
  });

  assert.equal(plano.inserir.length, 0);
});

test('planejarSincronizacaoOrtopedicos: paciente inativo nao recebe pedido', () => {
  const plano = planejarSincronizacaoOrtopedicos({
    pacientes: [
      { id: 'orto-inativo', turma_id: 'turma-esp1', ativo: false, tipo: 'ortopedico', aparelho_previsto: 'Hyrax' }
    ],
    datasPorTurma: {
      'turma-esp1': ['2026-11-20']
    },
    pedidosExistentes: [],
    hoje: '2026-11-10'
  });

  assert.equal(plano.inserir.length, 0);
});

test('planejarSincronizacaoOrtopedicos: turma sem calendario futuro nao gera pedido', () => {
  const plano = planejarSincronizacaoOrtopedicos({
    pacientes: [
      { id: 'orto-1', turma_id: 'turma-vazia', ativo: true, tipo: 'ortopedico', aparelho_previsto: 'Hyrax' }
    ],
    datasPorTurma: {
      'turma-vazia': ['2026-10-01']
    },
    pedidosExistentes: [],
    hoje: '2026-11-10'
  });

  assert.equal(plano.inserir.length, 0);
});

// 8. Idempotencia da sincronizacao de alinhadores
test('planejarSincronizacao: sincronizacao de alinhadores continua estritamente idempotente', () => {
  const pacientes = [
    { id: 'pac-alin-1', turma_id: 't-esp1', ativo: true }
  ];
  const datasPorTurma = {
    't-esp1': ['2026-12-01', '2026-12-02', '2027-01-10']
  };

  const plano1 = planejarSincronizacao({
    pacientes,
    datasPorTurma,
    pedidosExistentes: [],
    hoje: '2026-11-10'
  });
  assert.equal(plano1.inserir.length, 1);
  assert.equal(plano1.inserir[0].data_retorno, '2026-12-01');
  assert.equal(plano1.apagarIds.length, 0);

  const pedidosBanco = [
    { id: 'ped-alin-criado', paciente_id: 'pac-alin-1', data_retorno: '2026-12-01', solicitado_em: null }
  ];
  const plano2 = planejarSincronizacao({
    pacientes,
    datasPorTurma,
    pedidosExistentes: pedidosBanco,
    hoje: '2026-11-10'
  });

  assert.equal(plano2.inserir.length, 0);
  assert.equal(plano2.apagarIds.length, 0);
});

console.log('\n================================================================');
console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam (Total: ${passou + falhou})`);
console.log('================================================================');

if (falhou > 0) {
  process.exit(1);
}

