# ParkSim — Simulador de Estacionamento com Banco de Dados

Projeto acadêmico (Disciplina: Banco de Dados — Desafio A3, trilha Oracle
Academy: Database Design): simulação de entrada e saída de veículos com
painel administrativo, usando um banco relacional real (PostgreSQL via
Supabase) com persistência dos dados por conta (Auth + Row Level Security).

Site publicado: https://lebot007.github.io/a3controlecarros/

Acesso administrativo (dados fictícios, uso de teste):
- E-mail: admin@parksim.com
- Senha: admin123

## Entrega da A3

| Arquivo | Conteúdo |
| --- | --- |
| `entrega/ParkSim_A3_Documento_Projeto.docx` | Documento de projeto: requisitos e regras de negócio, modelagem conceitual (DER), modelagem lógica e normalização (3FN), integridade referencial, SQL e diagramas |
| `entrega/ParkSim_A3_Apresentacao.pptx` | Slides da apresentação final |
| `database/parksim_schema.sql` | Script `.sql` único e executável: DDL (CREATE/ALTER TABLE, índices, TRIGGER, RLS) + migração idempotente + DML (INSERT/UPDATE/DELETE) + DQL (SELECT com JOINs e agregações) |

## Estrutura

```
projeto/
├── index.html                  # aplicação web (GitHub Pages)
├── style.css
├── js/
│   ├── config.js               # configuração da simulação e do Supabase
│   ├── supabase.js             # cliente Supabase
│   ├── banco.js                # camada de acesso a dados (INSERT/UPDATE/SELECT/DELETE)
│   ├── simulacao.js            # motor da simulação do pátio
│   ├── ui.js                   # interface, painel e exportação em PDF
│   └── app.js                  # integração (auth + simulação + painel)
├── database/
│   └── parksim_schema.sql      # script único do banco (DDL + migração + DML + DQL)
└── entrega/
    ├── ParkSim_A3_Documento_Projeto.docx
    └── ParkSim_A3_Apresentacao.pptx
```

## Banco de dados

O script `database/parksim_schema.sql` cria as tabelas `cliente`, `veiculo`,
`funcionario`, `tipo_vaga`, `vaga` e `movimentacao`, com chaves estrangeiras,
trigger de cálculo de tempo/valor na saída, políticas de segurança (RLS) por
conta e a carga inicial de homologação, além das consultas estratégicas com
JOIN. Para reproduzir o banco usado pelo site, execute o script no SQL Editor
de um projeto Supabase e configure a URL/chave em `js/config.js`.
