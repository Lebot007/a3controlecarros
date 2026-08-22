import * as banco from "./banco.js";
import * as ui from "./ui.js";
import { criarSimulacao } from "./simulacao.js";

let painelAberto = false;

async function refrescarRelatorio() {
    if (!painelAberto) return;

    const { data } = await banco.buscarMovimentacoes(banco.getSessaoAtual());
    ui.atualizarRelatorio(data || []);
}

async function aplicarAuth(session) {
    painelAberto = !!session;
    ui.setPainelAberto(painelAberto, session?.user?.email || "");

    if (painelAberto) {
        await refrescarRelatorio();
    } else {
        ui.atualizarRelatorio([]);
    }
}

banco.aoMudarAuth(session => aplicarAuth(session));

async function tentarLogin() {
    const email = document.getElementById("emailAdmin").value.trim();
    const senha = document.getElementById("senhaAdmin").value;

    if (!email || !senha) {
        alert("Preencha email e senha.");
        return;
    }

    const { error } = await banco.login(email, senha);

    if (error) {
        alert("Email ou senha inválidos.");
        return;
    }

    document.getElementById("modalLogin").classList.add("oculto");
}

const simulacao = criarSimulacao({
    aoTick: ui.atualizarTimer,

    aoIniciar: () => ui.setStatus("Simulação rodando", "rodando"),

    aoPausar: () => ui.setStatus("Simulação pausada", "pausada"),

    aoReiniciar: async () => {
        banco.novaSessao();
        ui.limparCena();
        ui.atualizarTimer(0);
        await refrescarRelatorio();
    },

    aoEntrarCarro: carro => {
        banco
            .registrarEntrada({
                placa: carro.placa,
                cor: carro.cor,
                vaga: carro.vaga,
                sessao: banco.getSessaoAtual(),
            })
            .then(refrescarRelatorio);

        ui.animarEntrada(carro.cor, carro.vaga);
    },

    aoSairCarro: carro => {
        banco
            .registrarSaida(carro.placa, banco.getSessaoAtual())
            .then(refrescarRelatorio);

        ui.animarSaida(carro.vaga);
    },
});

document.getElementById("btnIniciar").addEventListener("click", () => {
    if (simulacao.estaFinalizada()) simulacao.reiniciar();
    simulacao.iniciar();
});

document.getElementById("btnPausar").addEventListener("click", () => {
    simulacao.pausar();
});

document.getElementById("btnReiniciar").addEventListener("click", () => {
    simulacao.reiniciar();
});

[1, 2, 3].forEach(v => {
    document.getElementById(`btn${v}x`).addEventListener("click", () => {
        simulacao.setVelocidade(v);
        ui.setVelocidade(v);
    });
});

const modal = document.getElementById("modalLogin");

document.getElementById("btnAbrirLogin").addEventListener("click", () => {
    modal.classList.remove("oculto");
});

document.getElementById("btnFecharLogin").addEventListener("click", () => {
    modal.classList.add("oculto");
});

modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.add("oculto");
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape") modal.classList.add("oculto");
});

document.getElementById("btnEntrar").addEventListener("click", tentarLogin);

document.getElementById("btnSair").addEventListener("click", async () => {