# ParkSim — Simulador de Estacionamento com Banco de Dados

Projeto acadêmico (Disciplina: Banco de Dados) — simulação de entrada e
saída de veículos com painel administrativo, usando um banco relacional
real (PostgreSQL via Supabase).

Site: https://lebot007.github.io/a3controlecarros/

Acesso administrativo (dados fictícios, uso de teste):
- E-mail: admin@parksim.com
- Senha: admin123

## Banco de dados

O script completo (DDL + DML + DQL) está em `database/parksim_schema.sql`.
Ele cria as tabelas `cliente`, `veiculo`, `funcionario`, `tipo_vaga`,
`vaga` e `movimentacao`, com chaves estrangeiras, trigger de cálculo de
tempo/valor na saída, políticas de segurança (RLS) e consultas de
exemplo com JOIN. Para reproduzir o banco usado pelo site, execute o
script no SQL Editor de um projeto Supabase e configure a URL/chave em
`js/config.js`.

## Estrutura

Ver `estrutura.txt`.
admin@parksim.com / senha: admin123

https://lebot007.github.io/a3controlecarros/