-- ETAPA 1: MÓDULO AGENDA DA ESPECIALIZAÇÃO
-- Tabelas: turmas, agenda_alunos, agenda_fixa, agenda_mensal, inconsistencias

-- Extensão pg_trgm (já deve estar ativa, mas assegurando)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. TABELA TURMAS
CREATE TABLE IF NOT EXISTS public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL
);

-- Popula turmas com os 3 valores obrigatórios se não existirem
INSERT INTO public.turmas (nome)
VALUES ('ESP1'), ('ESP2'), ('SERVIÇO')
ON CONFLICT (nome) DO NOTHING;

-- 2. TABELA AGENDA_ALUNOS
CREATE TABLE IF NOT EXISTS public.agenda_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  ativo boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_agenda_alunos_turma ON public.agenda_alunos(turma_id);

-- 3. TABELA AGENDA_FIXA
CREATE TABLE IF NOT EXISTS public.agenda_fixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente text NOT NULL,
  aluno_id uuid REFERENCES public.agenda_alunos(id) ON DELETE CASCADE,
  horario time NOT NULL,
  dia_semana text NOT NULL, -- 'QUINTA' | 'SEXTA' | 'SABADO'
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_fixa_turma ON public.agenda_fixa(turma_id);
CREATE INDEX IF NOT EXISTS idx_agenda_fixa_aluno ON public.agenda_fixa(aluno_id);

-- 4. TABELA AGENDA_MENSAL
CREATE TABLE IF NOT EXISTS public.agenda_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente text NOT NULL,
  aluno_id uuid REFERENCES public.agenda_alunos(id) ON DELETE CASCADE,
  horario time NOT NULL,
  dia_semana text NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_agenda_mensal UNIQUE (turma_id, mes_referencia, paciente, horario, dia_semana)
);

CREATE INDEX IF NOT EXISTS idx_agenda_mensal_turma_mes ON public.agenda_mensal(turma_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_agenda_mensal_aluno ON public.agenda_mensal(aluno_id);

-- 5. TABELA INCONSISTENCIAS
CREATE TABLE IF NOT EXISTS public.inconsistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- 'AUSENTE' | 'ALUNO_TROCADO' | 'PACIENTE_NOVO'
  paciente text NOT NULL,
  aluno_fixa text,
  aluno_mensal text,
  horario time NOT NULL,
  dia_semana text NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  status text DEFAULT 'PENDENTE', -- 'PENDENTE' | 'REVISADO' | 'OK' | 'EDITAR'
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inconsistencias_turma_mes ON public.inconsistencias(turma_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_inconsistencias_status ON public.inconsistencias(status);

-- 6. HABILITA RLS NAS 5 TABELAS
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_fixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inconsistencias ENABLE ROW LEVEL SECURITY;

-- Limpa políticas anteriores se existirem
DROP POLICY IF EXISTS "Gerenciar turmas" ON public.turmas;
DROP POLICY IF EXISTS "Gerenciar agenda_alunos" ON public.agenda_alunos;
DROP POLICY IF EXISTS "Gerenciar agenda_fixa" ON public.agenda_fixa;
DROP POLICY IF EXISTS "Gerenciar agenda_mensal" ON public.agenda_mensal;
DROP POLICY IF EXISTS "Gerenciar inconsistencias" ON public.inconsistencias;

-- Políticas de RLS estritas: leitura E escrita restritas exclusivamente a coordenador e admin_master
CREATE POLICY "Gerenciar turmas" ON public.turmas
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

CREATE POLICY "Gerenciar agenda_alunos" ON public.agenda_alunos
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

CREATE POLICY "Gerenciar agenda_fixa" ON public.agenda_fixa
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

CREATE POLICY "Gerenciar agenda_mensal" ON public.agenda_mensal
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

CREATE POLICY "Gerenciar inconsistencias" ON public.inconsistencias
  FOR ALL USING (public.get_user_papel(auth.uid()) IN ('coordenador', 'admin_master'));

-- 7. FUNÇÃO DE COMPARAÇÃO DE AGENDAS
CREATE OR REPLACE FUNCTION public.compare_agendas(p_turma_id uuid, p_mes_referencia date)
RETURNS jsonb AS $$
DECLARE
  rec_fixa RECORD;
  rec_mensal RECORD;
  v_match_mensal RECORD;
  v_match_fixa RECORD;
  v_total_ausentes INT := 0;
  v_total_trocados INT := 0;
  v_total_novos INT := 0;
BEGIN
  -- 1. Idempotência: remove inconsistências existentes da mesma turma e mês de referência
  DELETE FROM public.inconsistencias
  WHERE turma_id = p_turma_id
    AND mes_referencia = p_mes_referencia;

  -- 2. Itera sobre cada registro de agenda_fixa para a turma
  FOR rec_fixa IN
    SELECT af.id, af.paciente, af.aluno_id, af.horario, af.dia_semana,
           aa.nome AS aluno_nome
    FROM public.agenda_fixa af
    LEFT JOIN public.agenda_alunos aa ON aa.id = af.aluno_id
    WHERE af.turma_id = p_turma_id
  LOOP
    -- Busca correspondente em agenda_mensal no mesmo horário, dia_semana e similaridade de nome >= 0.4
    SELECT am.id, am.paciente, am.aluno_id, aa_m.nome AS aluno_nome
    INTO v_match_mensal
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa_m ON aa_m.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
      AND am.horario = rec_fixa.horario
      AND upper(trim(am.dia_semana)) = upper(trim(rec_fixa.dia_semana))
      AND similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) >= 0.4
    ORDER BY similarity(normalizar_nome(am.paciente), normalizar_nome(rec_fixa.paciente)) DESC
    LIMIT 1;

    IF v_match_mensal IS NULL THEN
      -- Paciente da fixa não encontrado no mensal no mesmo horário/dia
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status
      ) VALUES (
        'AUSENTE', rec_fixa.paciente, rec_fixa.aluno_nome, NULL, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE'
      );
      v_total_ausentes := v_total_ausentes + 1;
    ELSIF v_match_mensal.aluno_id IS DISTINCT FROM rec_fixa.aluno_id THEN
      -- Paciente encontrado no mensal, mas vinculado a outro aluno
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status
      ) VALUES (
        'ALUNO_TROCADO', rec_fixa.paciente, rec_fixa.aluno_nome, v_match_mensal.aluno_nome, rec_fixa.horario, rec_fixa.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE'
      );
      v_total_trocados := v_total_trocados + 1;
    END IF;
  END LOOP;

  -- 3. Itera sobre cada registro de agenda_mensal para identificar PACIENTE_NOVO
  FOR rec_mensal IN
    SELECT am.id, am.paciente, am.aluno_id, am.horario, am.dia_semana,
           aa.nome AS aluno_nome
    FROM public.agenda_mensal am
    LEFT JOIN public.agenda_alunos aa ON aa.id = am.aluno_id
    WHERE am.turma_id = p_turma_id
      AND am.mes_referencia = p_mes_referencia
  LOOP
    -- Busca se existe correspondente na fixa no mesmo horário/dia_semana com similarity >= 0.4
    SELECT af.id
    INTO v_match_fixa
    FROM public.agenda_fixa af
    WHERE af.turma_id = p_turma_id
      AND af.horario = rec_mensal.horario
      AND upper(trim(af.dia_semana)) = upper(trim(rec_mensal.dia_semana))
      AND similarity(normalizar_nome(af.paciente), normalizar_nome(rec_mensal.paciente)) >= 0.4
    LIMIT 1;

    IF v_match_fixa IS NULL THEN
      -- Paciente do mensal não consta na agenda fixa daquele horário/dia
      INSERT INTO public.inconsistencias (
        tipo, paciente, aluno_fixa, aluno_mensal, horario, dia_semana, turma_id, mes_referencia, status
      ) VALUES (
        'PACIENTE_NOVO', rec_mensal.paciente, NULL, rec_mensal.aluno_nome, rec_mensal.horario, rec_mensal.dia_semana, p_turma_id, p_mes_referencia, 'PENDENTE'
      );
      v_total_novos := v_total_novos + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'turma_id', p_turma_id,
    'mes_referencia', p_mes_referencia,
    'ausentes', v_total_ausentes,
    'trocados', v_total_trocados,
    'novos', v_total_novos,
    'total', v_total_ausentes + v_total_trocados + v_total_novos
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
