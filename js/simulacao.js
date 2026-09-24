import { CONFIG } from "./config.js";

const aleatorio = (min, max) => Math.random() * (max - min) + min;
const escolher = lista => lista[Math.floor(Math.random() * lista.length)];

function gerarPlaca() {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numeros = "0123456789";

    return (
        escolher(letras) +
        escolher(letras) +
        escolher(letras) +
        escolher(numeros) +
        escolher(letras) +
        escolher(numeros) +
        escolher(numeros)
    );
}

export function criarSimulacao(ev) {
    let velocidade = 1;
    let rodando = false;
    let finalizada = false;
    let tempo = 0;
    let ultimo = 0;
    let frameId = null;
    let estacionados = [];
    let proximoCarro = 1;

    function vagasLivres() {
        return CONFIG.totalVagas - estacionados.length;
    }

    function vagaLivre() {
        const ocupadas = new Set(estacionados.map(c => c.vaga));
        const livres = [];

        for (let i = 1; i <= CONFIG.totalVagas; i++) {
            if (!ocupadas.has(i)) livres.push(i);
        }

        return livres.length ? escolher(livres) : null;
    }

    function proximoIntervalo() {
        const livres = vagasLivres();

        if (livres <= 1) return aleatorio(5, 9);
        if (livres >= 5) return aleatorio(2, 5);
        return aleatorio(...CONFIG.intervaloSpawn);
    }

    function tentarEntrada() {
        const vaga = vagaLivre();
        if (vaga === null) return;

        const longa = Math.random() < 0.15;
        const faixa = longa ? [120, 240] : CONFIG.permanencia;

        const carro = {
            placa: gerarPlaca(),
            cor: escolher(CONFIG.cores),
            modelo: escolher(CONFIG.modelos),
            vaga,
            saiEm: tempo + aleatorio(...faixa),
        };

        estacionados.push(carro);
        ev.aoEntrarCarro?.({ ...carro, momento: tempo });
    }

    function finalizar() {
        rodando = false;
        finalizada = true;
        cancelAnimationFrame(frameId);
        ev.aoFinalizar?.();
    }

    function loop(agora) {
        if (!rodando) return;

        const delta = ((agora - ultimo) / 1000) * velocidade;
        ultimo = agora;
        tempo += delta;

        ev.aoTick?.(tempo);

        if (CONFIG.duracaoLimite && tempo >= CONFIG.duracaoLimite) {
            return finalizar();
        }

        proximoCarro -= delta;

        if (proximoCarro <= 0) {
            if (vagasLivres() > 0) tentarEntrada();
            proximoCarro = proximoIntervalo();
        }

        for (const carro of [...estacionados]) {
            if (carro.saiEm <= tempo) {
                estacionados = estacionados.filter(c => c !== carro);
                ev.aoSairCarro?.({ ...carro, momento: tempo });
            }
        }

        frameId = requestAnimationFrame(loop);
    }

    function iniciar() {
        if (rodando || finalizada) return;

        rodando = true;
        ultimo = performance.now();
        frameId = requestAnimationFrame(loop);
        ev.aoIniciar?.();
    }

    function pausar() {
        if (!rodando) return;

        rodando = false;
        cancelAnimationFrame(frameId);
        ev.aoPausar?.();
    }

    function reiniciar() {
        rodando = false;
        finalizada = false;
        cancelAnimationFrame(frameId);

        tempo = 0;
        estacionados = [];
        proximoCarro = 1;

        ev.aoReiniciar?.();
        ev.aoTick?.(0);
    }

    function setVelocidade(v) {
        velocidade = v;
    }

    function estaFinalizada() {
        return finalizada;
    }

    function estaRodando() {
        return rodando;
    }

    return {
        iniciar,
        pausar,
        reiniciar,
        setVelocidade,
        estaFinalizada,
        estaRodando,
    };
}