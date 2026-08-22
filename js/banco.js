import { supabase } from "./supabase.js";

export function getSessaoAtual() {
    const s = parseInt(localStorage.getItem("parksim_sessao") || "1", 10);
    return Number.isFinite(s) ? s : 1;
}

export function novaSessao() {
    const s = getSessaoAtual() + 1;
    localStorage.setItem("parksim_sessao", String(s));
    return s;
}

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

export async function registrarEntrada({ placa, cor, vaga, sessao }) {
    return await supabase
        .from("movimentacoes")
        .insert([{ placa, cor, vaga, sessao, status: "ESTACIONADO" }]);
}

export async function registrarSaida(placa, sessao) {
    return await supabase
        .from("movimentacoes")
        .update({ hora_saida: new Date().toISOString(), status: "SAIU" })
        .eq("placa", placa)
        .eq("sessao", sessao)
        .is("hora_saida", null);
}

export async function buscarMovimentacoes(sessao) {
    return await supabase
        .from("movimentacoes")
        .select("*")
        .eq("sessao", sessao)
        .order("hora_entrada", { ascending: false });
}