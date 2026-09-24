import { supabase } from "./supabase.js";

/* ---------- sessão local (apenas para separar execuções de demo) ---------- */

export function getSessaoAtual() {
    const s = parseInt(localStorage.getItem("parksim_sessao") || "1", 10);
    return Number.isFinite(s) ? s : 1;
}

export function novaSessao() {
    const s = getSessaoAtual() + 1;
    localStorage.setItem("parksim_sessao", String(s));
    return s;
}

export function resetarSessao() {
    localStorage.setItem("parksim_sessao", "1");
    return 1;
}

/* ---------- autenticação (Supabase Auth) ---------- */

export async function login(email, senha) {
    return await supabase.auth.signInWithPassword({ email, password: senha });
}

export async function logout() {
    return await supabase.auth.signOut();
}

export async function sessaoAtiva() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export function aoMudarAuth(cb) {
    supabase.auth.onAuthStateChange((_evento, session) => cb(session));
}

/* ---------- cache de tabelas de referência (vaga, tipo_vaga, funcionario, cliente) ----------
   Essas tabelas são carregadas uma vez no início: elas representam o
   cadastro "fixo" do estacionamento (vagas físicas, tarifas, atendentes,
   clientes já cadastrados) e são usadas para montar as chaves estrangeiras
   ao registrar uma movimentação. */

let cacheVagas = [];
let cacheFuncionarios = [];
let cacheClientes = [];

export async function carregarReferencias() {
    const [{ data: vagas, error: e1 }, { data: funcionarios, error: e2 }, { data: clientes, error: e3 }] =
        await Promise.all([
            supabase.from("vaga").select("id, numero").order("numero"),
            supabase.from("funcionario").select("id"),
            supabase.from("cliente").select("id"),
        ]);

    if (e1 || e2 || e3) {
        console.error("Erro ao carregar tabelas de referência:", e1 || e2 || e3);
    }

    cacheVagas = vagas || [];
    cacheFuncionarios = funcionarios || [];
    cacheClientes = clientes || [];
}

function vagaIdPorNumero(numero) {
    return cacheVagas.find(v => v.numero === numero)?.id ?? null;
}

function funcionarioAleatorio() {
    if (!cacheFuncionarios.length) return null;
    return cacheFuncionarios[Math.floor(Math.random() * cacheFuncionarios.length)].id;
}

function clienteAleatorio() {
    if (!cacheClientes.length) return null;
    return cacheClientes[Math.floor(Math.random() * cacheClientes.length)].id;
}

/* ---------- veículo (cria sob demanda, vinculado à conta logada) ---------- */

export async function obterOuCriarVeiculo(placa, cor, modelo, user_id) {
    // Procura apenas entre os veículos da própria conta
    const { data: existente } = await supabase
        .from("veiculo")
        .select("id")
        .eq("placa", placa)
        .eq("user_id", user_id)
        .maybeSingle();

    if (existente) return existente.id;

    const { data: novo, error } = await supabase
        .from("veiculo")
        .insert([{ placa, cor, modelo, cliente_id: clienteAleatorio(), user_id }])
        .select("id")
        .single();

    if (error) {
        console.error("Erro ao criar veículo:", error);
        return null;
    }

    return novo.id;
}

/* ---------- movimentação (entrada/saída) ---------- */

// Apaga os veículos DA CONTA logada (ON DELETE CASCADE também limpa as
// movimentações dela). Sem user_id (visitante), não faz nada: assim um
// visitante nunca apaga dados de outra conta. Tabelas de referência
// (cliente, funcionario, vaga, tipo_vaga) são preservadas.
export async function limparMovimentacoes(user_id) {
    if (!user_id) return { count: 0, error: null };
    return await supabase.from("veiculo").delete().eq("user_id", user_id);
}

export async function registrarEntrada({ placa, cor, modelo, vaga, sessao, user_id }) {
    if (!user_id) {
        // Visitante (não logado): a simulação roda apenas visualmente,
        // nada é gravado no banco — os dados pertencem a uma conta.
        return { skipped: true };
    }

    const veiculo_id = await obterOuCriarVeiculo(placa, cor, modelo, user_id);
    const vaga_id = vagaIdPorNumero(vaga);
    const funcionario_id = funcionarioAleatorio();

    if (!veiculo_id || !vaga_id || !funcionario_id) {
        console.error("Referências ausentes para registrar entrada (veículo/vaga/funcionário).");
        return { error: "referencias_ausentes" };
    }

    return await supabase
        .from("movimentacao")
        .insert([{ veiculo_id, vaga_id, funcionario_id, sessao, user_id, status: "ESTACIONADO" }]);
}

export async function registrarSaida(placa, sessao, user_id) {
    if (!user_id) return { skipped: true };

    const { data: veiculo } = await supabase
        .from("veiculo")
        .select("id")
        .eq("placa", placa)
        .eq("user_id", user_id)
        .maybeSingle();

    if (!veiculo) return { error: "veiculo_nao_encontrado" };

    return await supabase
        .from("movimentacao")
        .update({ hora_saida: new Date().toISOString(), status: "SAIU" })
        .eq("veiculo_id", veiculo.id)
        .eq("sessao", sessao)
        .eq("user_id", user_id)
        .is("hora_saida", null);
}

// Relatório: um SELECT com JOIN entre movimentacao, veiculo, cliente,
// vaga e funcionario (feito via "embedded resources" do PostgREST, que
// o Supabase traduz em JOINs reais no PostgreSQL por trás das FKs).
// Filtra pela conta logada: os dados persistem entre logout/login e
// entre recarregamentos de página.
export async function buscarMovimentacoes(user_id) {
    if (!user_id) return { data: [], error: null };

    return await supabase
        .from("movimentacao")
        .select(`
            id,
            sessao,
            hora_entrada,
            hora_saida,
            tempo_minutos,
            valor_cobrado,
            status,
            veiculo:veiculo_id (
                placa,
                cor,
                cliente:cliente_id ( nome )
            ),
            vaga:vaga_id ( numero ),
            funcionario:funcionario_id ( nome )
        `)
        .eq("user_id", user_id)
        .order("hora_entrada", { ascending: false });
}
