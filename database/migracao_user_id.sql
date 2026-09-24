-- =====================================================================
-- PARKSIM — MIGRAÇÃO: salvar os dados NA CONTA do usuário (user_id)
-- =====================================================================
-- Execute este script UMA vez no SQL Editor do Supabase.
-- Ele é ADITIVO e IDEMPOTENTE (pode reexecutar sem erro):
--   * cria as colunas user_id (se ainda não existirem);
--   * cria índices;
--   * troca as políticas RLS públicas por políticas "por conta".
-- Nada do que já existe é apagado: tabelas, trigger, sessao e carga
-- inicial continuam iguais.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Novas colunas: vinculam cada registro à conta logada (auth.users)
-- ---------------------------------------------------------------------
alter table public.veiculo
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.movimentacao
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 2) Índices para as novas colunas
-- ---------------------------------------------------------------------
create index if not exists idx_veiculo_user      on public.veiculo(user_id);
create index if not exists idx_movimentacao_user on public.movimentacao(user_id);

-- ---------------------------------------------------------------------
-- 3) RLS — cada conta só LÊ / INSERE / ATUALIZA / APAGA os próprios dados
--    (as políticas antigas são substituídas pelo nome; sem duplicar)
-- ---------------------------------------------------------------------

-- movimentacao: SELECT só das próprias linhas (antes: qualquer logado via tudo)
drop policy if exists leitura_restrita_movimentacao on public.movimentacao;
create policy leitura_restrita_movimentacao on public.movimentacao
    for select
    using (auth.uid() is not null and user_id = auth.uid());

-- movimentacao: INSERT só logado e só para a própria conta
drop policy if exists insercao_publica_movimentacao on public.movimentacao;
create policy insercao_conta_movimentacao on public.movimentacao
    for insert
    with check (auth.uid() is not null and user_id = auth.uid());

-- movimentacao: UPDATE (registrar saída) só nas próprias linhas
drop policy if exists atualizacao_publica_movimentacao on public.movimentacao;
create policy atualizacao_conta_movimentacao on public.movimentacao
    for update
    using (auth.uid() is not null and user_id = auth.uid());

-- veiculo: INSERT só logado e só para a própria conta
drop policy if exists insercao_publica_veiculo on public.veiculo;
create policy insercao_conta_veiculo on public.veiculo
    for insert
    with check (auth.uid() is not null and user_id = auth.uid());

-- veiculo: DELETE só dos próprios veículos (o ON DELETE CASCADE de
-- movimentacao continua limpando as movimentações da conta junto).
-- Isso também impede que um visitante com o JS antigo em cache
-- apague o banco inteiro ao abrir o site.
drop policy if exists exclusao_publica_veiculo on public.veiculo;
create policy exclusao_conta_veiculo on public.veiculo
    for delete
    using (auth.uid() is not null and user_id = auth.uid());

-- veiculo: o SELECT continua público (leitura_publica_veiculo), pois a
-- simulação consulta placas e o relatório faz JOIN com veiculo/cliente.
-- As tabelas de referência (cliente, funcionario, vaga, tipo_vaga) não
-- mudam: continuam com leitura pública.

-- ---------------------------------------------------------------------
-- 4) (OPCIONAL) Adotar registros antigos/órfãos (user_id NULL) para a
--    conta admin, para que apareçam no painel dela.
--    Pegue o UUID em: Dashboard → Authentication → Users → admin@parksim.com
--    Descomente e troque 'COLE-O-UUID-AQUI' pelo UUID real:
-- ---------------------------------------------------------------------
-- update public.veiculo      set user_id = 'COLE-O-UUID-AQUI' where user_id is null;
-- update public.movimentacao set user_id = 'COLE-O-UUID-AQUI' where user_id is null;
