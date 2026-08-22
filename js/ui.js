const $ = id => document.getElementById(id);

const els = {
    timer: $("tempoSimulacao"),
    status: $("statusSimulacao"),
    velBadge: $("velocidadeAtual"),
    mapa: document.querySelector(".mapa"),
    pista: document.querySelector(".pista"),
    tabela: $("tabela"),
    vazio: $("mensagemVazio"),
    total: $("totalVeiculos"),
    estacionados: $("totalEstacionados"),
    saidas: $("totalSaidas"),
    tempoMedio: $("tempoMedio"),
};

let velocidadeAtual = 1;
let idsVistos = new Set();

let timeouts = new Set();

export function agendar(fn, ms) {
    const id = setTimeout(() => {
        timeouts.delete(id);
        fn();
    }, ms);

    timeouts.add(id);
    return id;
}

export function cancelarAgendamentos() {
    timeouts.forEach(clearTimeout);
    timeouts.clear();
}

export function formatarRelogio(seg) {
    const s = Math.max(0, Math.floor(seg));
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const r = String(s % 60).padStart(2, "0");
    return `${m}:${r}`;
}

export function formatarHora(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function atualizarTimer(seg) {
    els.timer.textContent = formatarRelogio(seg);
}

export function setStatus(texto, estado) {
    els.status.textContent = texto;
    els.status.dataset.estado = estado || "";
    els.pista.classList.toggle("rodando", estado === "rodando");
}

export function setVelocidade(v) {
    velocidadeAtual = v;
    els.velBadge.textContent = `${v}x`;
    els.pista.style.setProperty("--pista-vel", `${(1.4 / v).toFixed(2)}s`);

    document.querySelectorAll(".btn-velocidade").forEach(btn => {
        btn.classList.toggle("ativo", btn.id === `btn${v}x`);
    });
}

export function setPainelAberto(aberto, email) {
    $("painelTravado").classList.toggle("oculto", aberto);
    $("conteudoDados").classList.toggle("oculto", !aberto);
    $("btnExportar").classList.toggle("oculto", !aberto);
    $("btnSair").classList.toggle("oculto", !aberto);
    $("btnAbrirLogin").classList.toggle("oculto", aberto);
    $("usuarioAdmin").textContent = aberto ? (email || "Admin") : "Visitante";
}

const dur = ms => Math.max(ms * 0.35, ms / velocidadeAtual);

function criarCarro(cor) {
    const el = document.createElement("div");
    el.className = `carro cor-${cor}`;
    return el;
}

function getVaga(numero) {
    return document.querySelector(`.vaga[data-vaga="${numero}"]`);
}

function centroY(rect) {
    return rect.top + rect.height / 2;
}

export function animarEntrada(cor, numero) {
    const vaga = getVaga(numero);
    if (!vaga) return;

    vaga.classList.add("reservada");

    const el = criarCarro(cor);
    vaga.appendChild(el);

    const mapaRect = els.mapa.getBoundingClientRect();
    const pistaRect = els.pista.getBoundingClientRect();
    const carRect = el.getBoundingClientRect();

    const y = centroY(pistaRect) - centroY(carRect);
    const xFora = mapaRect.left - carRect.left - 140;

    el.style.transform = `translate(${xFora}px, ${y}px)`;

    const anim = el.animate(
        [
            { transform: `translate(${xFora}px, ${y}px)` },
            { transform: `translate(${xFora * 0.5}px, ${y - 2}px)`, offset: 0.28 },
            { transform: `translate(0px, ${y}px)`, offset: 0.58 },
            { transform: `translate(0px, ${y}px) rotate(0deg)`, offset: 0.66 },
            { transform: `translate(0px, ${y * 0.45}px) rotate(5deg)`, offset: 0.84 },
            { transform: "translate(0px, 0px) rotate(0deg)" },
        ],
        { duration: dur(3200), easing: "cubic-bezier(0.4, 0.6, 0.3, 1)" }
    );

    anim.onfinish = () => {
        el.style.transform = "";
        vaga.classList.remove("reservada");
        vaga.classList.add("ocupada");
    };
}

export function animarSaida(numero) {
    const vaga = getVaga(numero);
    if (!vaga) return;

    const el = vaga.querySelector(".carro");

    vaga.classList.remove("ocupada");
    vaga.classList.add("saindo");
    agendar(() => vaga.classList.remove("saindo"), 700);

    if (!el) return;

    const mapaRect = els.mapa.getBoundingClientRect();
    const pistaRect = els.pista.getBoundingClientRect();
    const carRect = el.getBoundingClientRect();

    const y = centroY(pistaRect) - centroY(carRect);
    const xFora = mapaRect.right - carRect.left + 140;

    const tempoAnim = dur(2400);

    const anim = el.animate(
        [
            { transform: "translate(0px, 0px) rotate(0deg)" },
            { transform: `translate(0px, ${y * 0.5}px) rotate(-5deg)`, offset: 0.2 },
            { transform: `translate(0px, ${y}px) rotate(0deg)`, offset: 0.4 },
            { transform: `translate(${xFora * 0.5}px, ${y - 2}px)`, offset: 0.72 },
            { transform: `translate(${xFora}px, ${y}px)` },
        ],
        { duration: tempoAnim, easing: "cubic-bezier(0.5, 0.6, 0.4, 1)" }
    );

    anim.onfinish = () => el.remove();
    agendar(() => el.remove(), tempoAnim + 300);
}

export function limparCena() {
    cancelarAgendamentos();
    idsVistos.clear();

    document.querySelectorAll(".carro").forEach(el => {
        el.getAnimations?.().forEach(a => a.cancel());
        el.remove();
    });

    document.querySelectorAll(".vaga").forEach(v => {
        v.classList.remove("ocupada", "saindo", "reservada");
    });
}

export function atualizarRelatorio(regs) {
    const total = regs.length;
    const estacionados = regs.filter(r => r.status === "ESTACIONADO").length;
    const saidas = total - estacionados;

    const tempos = regs
        .filter(r => r.tempo_minutos !== null)
        .map(r => r.tempo_minutos);

    const media = tempos.length
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : 0;

    els.total.textContent = total;
    els.estacionados.textContent = estacionados;
    els.saidas.textContent = saidas;
    els.tempoMedio.textContent = `${media} min`;

    els.vazio.classList.toggle("oculto", total > 0);

    const visiveis = regs.slice(0, 50);

    els.tabela.innerHTML = visiveis.map(r => {
        const nova = !idsVistos.has(r.id);
        idsVistos.add(r.id);

        return `
            <tr class="${nova ? "linha-nova" : ""}">
                <td>${r.placa}</td>
                <td><span class="cor-dot dot-${r.cor}"></span>${r.cor}</td>
                <td>${formatarHora(r.hora_entrada)}</td>
                <td>${r.hora_saida ? formatarHora(r.hora_saida) : "—"}</td>
                <td>${r.tempo_minutos !== null ? r.tempo_minutos + " min" : "—"}</td>
                <td>
                    <span class="status-pill ${r.status === "SAIU" ? "status-saiu" : "status-estacionado"}">
                        ${r.status === "SAIU" ? "Saiu" : "Estacionado"}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

export function exportarPDF(regs, sessao) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("ParkSim — Relatório da Simulação", 14, 18);

    doc.setFontSize(10);
    doc.text(
        `Sessão: ${sessao}   |   Gerado em: ${new Date().toLocaleString("pt-BR")}`,
        14, 26
    );

    const total = regs.length;
    const est = regs.filter(r => r.status === "ESTACIONADO").length;
    const saidas = total - est;
    const tempos = regs.filter(r => r.tempo_minutos !== null).map(r => r.tempo_minutos);
    const media = tempos.length
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : 0;

    doc.text(
        `Veículos: ${total}   |   Estacionados: ${est}   |   Saídas: ${saidas}   |   Tempo médio: ${media} min`,
        14, 34
    );

    doc.autoTable({
        startY: 40,
        head: [["Placa", "Cor", "Vaga", "Entrada", "Saída", "Tempo (min)", "Status"]],
        body: regs.map(r => [
            r.placa,
            r.cor,
            r.vaga,
            formatarHora(r.hora_entrada),
            r.hora_saida ? formatarHora(r.hora_saida) : "—",
            r.tempo_minutos !== null ? String(r.tempo_minutos) : "—",
            r.status === "SAIU" ? "Saiu" : "Estacionado",
        ]),
        styles: { fontSize: 8 },
    });

    let yy = (doc.lastAutoTable?.finalY ?? 40) + 14;

    if (yy > 260) {
        doc.addPage();
        yy = 20;
    }

    doc.setFontSize(13);
    doc.text("Conceitos de Banco de Dados Aplicados", 14, yy);
    doc.setFontSize(9);

    const conceitos = [
        "• Modelagem relacional: tabela 'movimentacoes' com chave primária, carimbos de tempo e status.",
        "• INSERT: registrado automaticamente quando um veículo entra na simulação.",
        "• UPDATE + TRIGGER: ao registrar a saída, uma trigger no PostgreSQL calcula 'tempo_minutos'.",
        "• SELECT com agregações: COUNT (totais), AVG (tempo médio) e GROUP BY (cor/vaga mais usadas).",
        "• Segurança (RLS + Auth): somente o administrador autenticado consulta (SELECT) os dados; a simulação insere/atualiza como anônima.",
        "• Persistência em nuvem: os dados permanecem salvos no Supabase (PostgreSQL) mesmo após fechar o site.",
    ];

    yy += 7;

    conceitos.forEach(t => {
        const lines = doc.splitTextToSize(t, 180);

        if (yy + lines.length * 5 > 285) {
            doc.addPage();
            yy = 20;
        }

        doc.text(lines, 14, yy);
        yy += lines.length * 5 + 2;
    });

    doc.save(`parksim-relatorio-sessao-${sessao}.pdf`);
}