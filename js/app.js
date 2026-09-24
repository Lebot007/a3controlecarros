import * as banco from "./banco.js";
import * as ui from "./ui.js";
import { criarSimulacao } from "./simulacao.js";

let painelAberto = false;
let usuarioId = null; // id da conta logada (UUID do Supabase Auth); null = visitante

async function refrescarRelatorio() {
    if (!painelAberto || !usuarioId) return;

    const { data } = await banco.buscarMovimentacoes(usuarioId);
    ui.atualizarRelatorio(data || []);
}

async function aplicarAuth(session) {
    painelAberto = !!session;
    usuarioId = session?.user?.id ?? null;
    ui.setPainelAberto(painelAberto, session?.user?.email || "");

    if (painelAberto) {
        // Ao entrar na conta, o relatório é recarregado do banco:
        // os dados salvos anteriormente voltam a aparecer.
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
        // REINICIAR = apaga apenas os dados DA CONTA logada (visitante não apaga nada)
        await banco.limparMovimentacoes(usuarioId);
        banco.novaSessao();
        ui.limparCena();
        ui.atualizarTimer(0);
        await refrescarRelatorio();
    },

    aoEntrarCarro: carro => {
        if (usuarioId) {
            // Só grava no banco se houver conta logada (dados ficam salvos nela)
            banco
                .registrarEntrada({
                    placa: carro.placa,
                    cor: carro.cor,
                    modelo: carro.modelo,
                    vaga: carro.vaga,
                    sessao: banco.getSessaoAtual(),
                    user_id: usuarioId,
                })
                .then(refrescarRelatorio);
        }

        ui.animarEntrada(carro.cor, carro.vaga);
    },

    aoSairCarro: carro => {
        if (usuarioId) {
            banco
                .registrarSaida(carro.placa, banco.getSessaoAtual(), usuarioId)
                .then(refrescarRelatorio);
        }

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
    const { data } = await banco.buscarMovimentacoes(usuarioId);
    ui.exportarPDF(data || [], sessao);
});

/* ---------- início: NÃO apaga mais nada do banco ----------
   Antes, todo carregamento de página executava limparMovimentacoes() +
   resetarSessao(), o que destruía os dados salvos. Agora os dados da
   conta persistem no Supabase: quem recarrega a página já logado (ou faz
   login de novo) vê o relatório restaurado automaticamente. */

async function iniciarApp() {
    await banco.carregarReferencias();

    ui.setVelocidade(1);
    await aplicarAuth(await banco.sessaoAtiva());
}

iniciarApp();
