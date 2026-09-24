-- =====================================================================
-- PARKSIM — Projeto de Banco de Dados
-- Disciplina: Banco de Dados
-- Tema: Estacionamento (entrada/saída de veículos monitorada)
-- Script executável: DDL + DML (carga inicial) + DQL (consultas)
-- SGBD: PostgreSQL (compatível com Supabase)
-- =====================================================================


-- =====================================================================
-- 1. DDL — DATA DEFINITION LANGUAGE
-- =====================================================================

-- Remove objetos existentes (permite reexecução do script em ambiente
-- de homologação/demonstração)
drop table if exists movimentacao cascade;
drop table if exists veiculo cascade;
drop table if exists vaga cascade;
drop table if exists tipo_vaga cascade;
drop table if exists funcionario cascade;
drop table if exists cliente cascade;

-- ---------------------------------------------------------------------
-- tipo_vaga: categoriza as vagas e define a tarifa por hora de cada uma
-- (tabela de referência — evita repetir o valor da tarifa em cada vaga)
-- ---------------------------------------------------------------------
create table tipo_vaga (
    id          serial primary key,
    descricao   varchar(30)   not null unique,
    valor_hora  numeric(6,2)  not null check (valor_hora >= 0)
);

-- ---------------------------------------------------------------------
-- cliente: condutor/proprietário cadastrado no estacionamento
-- ---------------------------------------------------------------------
create table cliente (
    id        serial primary key,
    nome      varchar(100) not null,
    cpf       char(11)     not null unique,
    telefone  varchar(20),
    email     varchar(100) unique
);

-- ---------------------------------------------------------------------
-- funcionario: atendente responsável por registrar entradas/saídas
-- ---------------------------------------------------------------------
create table funcionario (
    id     serial primary key,
    nome   varchar(100) not null,
    cargo  varchar(50)  not null,
    cpf    char(11)     not null unique
);

-- ---------------------------------------------------------------------
-- vaga: vaga física do estacionamento, vinculada a um tipo_vaga
-- ---------------------------------------------------------------------
create table vaga (
    id            serial primary key,
    numero        integer not null unique,
    tipo_vaga_id  integer not null references tipo_vaga(id),
    ativa         boolean not null default true
);

-- ---------------------------------------------------------------------
-- veiculo: veículo pertencente a um cliente (1 cliente : N veículos)
-- ---------------------------------------------------------------------
create table veiculo (
    id          serial primary key,
    placa       varchar(8)  not null unique,
    cor         varchar(20) not null,
    modelo      varchar(50),
    cliente_id  integer not null references cliente(id)
);

-- ---------------------------------------------------------------------
-- movimentacao: registro de uma entrada/saída (o "pedido" do domínio).
-- Regra de negócio: 1 veículo pode gerar várias movimentações ao longo
-- do tempo; cada movimentação usa 1 vaga e é registrada por 1 funcionário.
-- ---------------------------------------------------------------------
create table movimentacao (
    id              bigserial primary key,
    veiculo_id      integer not null references veiculo(id)     on delete cascade,
    vaga_id         integer not null references vaga(id)        on delete restrict,
    funcionario_id  integer not null references funcionario(id) on delete restrict,
    sessao          integer not null default 1,
    hora_entrada    timestamptz not null default now(),
    hora_saida      timestamptz,
    tempo_minutos   integer,
    valor_cobrado   numeric(8,2),
    status          varchar(15) not null default 'ESTACIONADO'
                        check (status in ('ESTACIONADO', 'SAIU')),
    constraint chk_saida_apos_entrada
        check (hora_saida is null or hora_saida >= hora_entrada)
);

create index idx_movimentacao_sessao  on movimentacao(sessao);
create index idx_movimentacao_veiculo on movimentacao(veiculo_id);
create index idx_movimentacao_vaga    on movimentacao(vaga_id);

-- ---------------------------------------------------------------------
-- Regra de negócio automatizada no banco (TRIGGER):
-- ao preencher hora_saida, calcula tempo_minutos e valor_cobrado
-- (valor_hora vem do tipo_vaga associado à vaga usada), sem depender
-- de lógica no front-end.
-- ---------------------------------------------------------------------
create or replace function fn_calcular_saida()
returns trigger as $$
declare
    v_valor_hora numeric(6,2);
begin
    if new.hora_saida is not null and old.hora_saida is null then
        new.tempo_minutos := round(extract(epoch from (new.hora_saida - new.hora_entrada)) / 60.0);

        select tv.valor_hora into v_valor_hora
          from vaga v
          join tipo_vaga tv on tv.id = v.tipo_vaga_id
         where v.id = new.vaga_id;

        new.valor_cobrado := round((new.tempo_minutos / 60.0) * coalesce(v_valor_hora, 0), 2);
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trg_calcular_saida
    before update on movimentacao
    for each row
    execute function fn_calcular_saida();

-- ---------------------------------------------------------------------
-- Segurança (Row Level Security) — usada pela aplicação Supabase:
-- tabelas de referência têm leitura pública; movimentação permite
-- inserir/atualizar/excluir publicamente (simulação), mas só o
-- administrador autenticado pode LER o relatório (painel travado).
-- ---------------------------------------------------------------------
alter table tipo_vaga     enable row level security;
alter table cliente       enable row level security;
alter table funcionario   enable row level security;
alter table vaga          enable row level security;
alter table veiculo       enable row level security;
alter table movimentacao  enable row level security;

create policy leitura_publica_tipo_vaga   on tipo_vaga   for select using (true);
create policy leitura_publica_cliente     on cliente     for select using (true);
create policy leitura_publica_funcionario on funcionario for select using (true);
create policy leitura_publica_vaga        on vaga        for select using (true);

create policy leitura_publica_veiculo  on veiculo for select using (true);
create policy insercao_publica_veiculo on veiculo for insert with check (true);
create policy exclusao_publica_veiculo on veiculo for delete using (true);

create policy insercao_publica_movimentacao   on movimentacao for insert with check (true);
create policy atualizacao_publica_movimentacao on movimentacao for update using (true);
create policy leitura_restrita_movimentacao   on movimentacao for select
    using (auth.role() = 'authenticated');


-- =====================================================================
-- 2. DML — DATA MANIPULATION LANGUAGE (carga inicial fictícia)
-- =====================================================================

-- Tipos de vaga e respectivas tarifas por hora
insert into tipo_vaga (descricao, valor_hora) values
    ('Comum',   6.00),
    ('Coberta', 9.00),
    ('PCD',     0.00),
    ('Idoso',   0.00);

-- 8 vagas físicas do estacionamento
insert into vaga (numero, tipo_vaga_id) values
    (1, (select id from tipo_vaga where descricao = 'Comum')),
    (2, (select id from tipo_vaga where descricao = 'Comum')),
    (3, (select id from tipo_vaga where descricao = 'Comum')),
    (4, (select id from tipo_vaga where descricao = 'Coberta')),
    (5, (select id from tipo_vaga where descricao = 'Coberta')),
    (6, (select id from tipo_vaga where descricao = 'PCD')),
    (7, (select id from tipo_vaga where descricao = 'Idoso')),
    (8, (select id from tipo_vaga where descricao = 'Comum'));

-- Clientes fictícios
insert into cliente (nome, cpf, telefone, email) values
    ('Ana Beatriz Souza',      '11111111111', '(31) 90000-0001', 'ana.souza@exemplo.com'),
    ('Bruno Carvalho Lima',    '22222222222', '(31) 90000-0002', 'bruno.lima@exemplo.com'),
    ('Carla Mendes Ferreira',  '33333333333', '(31) 90000-0003', 'carla.ferreira@exemplo.com'),
    ('Diego Martins Rocha',    '44444444444', '(31) 90000-0004', 'diego.rocha@exemplo.com'),
    ('Elisa Nogueira Pinto',   '55555555555', '(31) 90000-0005', 'elisa.pinto@exemplo.com'),
    ('Felipe Andrade Costa',   '66666666666', '(31) 90000-0006', 'felipe.costa@exemplo.com');

-- Funcionários (atendentes do estacionamento)
insert into funcionario (nome, cargo, cpf) values
    ('João Vitor Alves Rodrigues',     'Atendente',       '77777777777'),
    ('Rafael Luiz Ferreira de Souza',  'Atendente',       '88888888888'),
    ('Pietro Cardoso de Oliveira',     'Supervisor',      '99999999999');

-- Alguns veículos já cadastrados (a aplicação insere novos dinamicamente)
insert into veiculo (placa, cor, modelo, cliente_id) values
    ('ABC1D23', 'prata',   'Onix',    (select id from cliente where cpf = '11111111111')),
    ('DEF4E56', 'preto',   'HB20',    (select id from cliente where cpf = '22222222222')),
    ('GHI7F89', 'branco',  'Corolla', (select id from cliente where cpf = '33333333333'));

-- Movimentações de exemplo (uma finalizada, uma em aberto) para homologação
insert into movimentacao (veiculo_id, vaga_id, funcionario_id, sessao, hora_entrada, hora_saida, status)
values (
    (select id from veiculo where placa = 'ABC1D23'),
    (select id from vaga where numero = 1),
    (select id from funcionario where cpf = '77777777777'),
    1,
    now() - interval '90 minutes',
    now() - interval '30 minutes',
    'SAIU'
);

insert into movimentacao (veiculo_id, vaga_id, funcionario_id, sessao, hora_entrada, status)
values (
    (select id from veiculo where placa = 'DEF4E56'),
    (select id from vaga where numero = 2),
    (select id from funcionario where cpf = '88888888888'),
    1,
    now() - interval '15 minutes',
    'ESTACIONADO'
);

-- Exemplo de UPDATE (regra de negócio "manual", equivalente ao que a
-- TRIGGER já faz automaticamente em produção): registra a saída de um
-- veículo que ainda estava estacionado.
update movimentacao
   set hora_saida = now(),
       status = 'SAIU'
 where veiculo_id = (select id from veiculo where placa = 'GHI7F89')
   and hora_saida is null;

-- Exemplo de DELETE: remove uma movimentação de teste indevida
-- (equivalente ao "Reiniciar" da simulação, que limpa a demonstração)
-- delete from movimentacao where sessao = 0;


-- =====================================================================
-- 3. DQL — DATA QUERY LANGUAGE (consultas estratégicas com JOIN)
-- =====================================================================

-- 3.1 Relatório completo da sessão atual (JOIN entre as 5 tabelas)
select
    m.id,
    v.placa,
    v.cor,
    c.nome        as cliente,
    vg.numero     as vaga,
    tv.descricao  as tipo_vaga,
    f.nome        as atendente,
    m.hora_entrada,
    m.hora_saida,
    m.tempo_minutos,
    m.valor_cobrado,
    m.status
from movimentacao m
join veiculo      v  on v.id  = m.veiculo_id
join cliente      c  on c.id  = v.cliente_id
join vaga         vg on vg.id = m.vaga_id
join tipo_vaga    tv on tv.id = vg.tipo_vaga_id
join funcionario  f  on f.id  = m.funcionario_id
where m.sessao = 1
order by m.hora_entrada desc;

-- 3.2 Faturamento total por cliente no último mês
-- (equivalente ao exemplo do professor: "relatório que relacione as
-- notas fiscais dos clientes no último mês")
select
    c.nome                              as cliente,
    count(m.id)                         as total_movimentacoes,
    coalesce(sum(m.valor_cobrado), 0)   as faturamento_total
from cliente c
join veiculo      v on v.cliente_id = c.id
join movimentacao m on m.veiculo_id = v.id
where m.hora_saida >= now() - interval '1 month'
group by c.nome
order by faturamento_total desc;

-- 3.3 Vaga mais utilizada (JOIN + COUNT + GROUP BY)
select
    vg.numero,
    tv.descricao   as tipo,
    count(m.id)    as vezes_utilizada
from vaga vg
join tipo_vaga    tv on tv.id = vg.tipo_vaga_id
left join movimentacao m on m.vaga_id = vg.id
group by vg.numero, tv.descricao
order by vezes_utilizada desc;

-- 3.4 Tempo médio de permanência por tipo de vaga (JOIN + AVG + GROUP BY)
select
    tv.descricao        as tipo_vaga,
    round(avg(m.tempo_minutos), 1) as tempo_medio_minutos
from movimentacao m
join vaga      vg on vg.id = m.vaga_id
join tipo_vaga tv on tv.id = vg.tipo_vaga_id
where m.tempo_minutos is not null
group by tv.descricao
order by tempo_medio_minutos desc;

-- 3.5 Funcionário que mais registrou movimentações (JOIN + COUNT)
select
    f.nome,
    f.cargo,
    count(m.id) as total_atendimentos
from funcionario f
left join movimentacao m on m.funcionario_id = f.id
group by f.nome, f.cargo
order by total_atendimentos desc;

-- 3.6 Veículos atualmente estacionados, com dados do cliente (JOIN)
select
    v.placa,
    v.cor,
    c.nome     as cliente,
    vg.numero  as vaga,
    m.hora_entrada
from movimentacao m
join veiculo v on v.id = m.veiculo_id
join cliente c on c.id = v.cliente_id
join vaga    vg on vg.id = m.vaga_id
where m.status = 'ESTACIONADO'
order by m.hora_entrada;
