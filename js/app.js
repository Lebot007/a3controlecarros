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
        alert("Erro no login: " + error.message);
        return;
    }

    document.getElementById("modalLogin").classList.add("oculto");
}

const simulacao = criarSimulacao({
    aoTick: ui.atualizarTimer,

    aoIniciar: () => ui.setStatus("Simulação rodando", "rodando"),

    aoPausar: () => ui.setStatus("Simulação pausada", "pausada"),

    aoReiniciar: async () => {
        await banco.limparMovimentacoes(); // REINICIAR = APAGA TODOS OS DADOS DO BANCO
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
                modelo: carro.modelo,
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

/* ---------- botões ---------- */

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

/* ---------- login / logout / exportar ---------- */

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
    await banco.logout();
});

document.getElementById("btnExportar").addEventListener("click", async () => {
    const sessao = banco.getSessaoAtual();
    const { data } = await banco.buscarMovimentacoes(sessao);
    ui.exportarPDF(data || [], sessao);
});

/* ---------- início: recarregou a página = banco limpo ---------- */

async function iniciarApp() {
    await banco.carregarReferencias();
    await banco.limparMovimentacoes();
    banco.resetarSessao();

    ui.setVelocidade(1);
    await aplicarAuth(await banco.sessaoAtiva());
}

iniciarApp();