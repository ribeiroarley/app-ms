/**
 * Gerador de Números para Mega-Sena com Estratégias Baseadas em Padrões
 * @author Arley Ribeiro
 * @version 2.0
 */

// ===================================================================
// 1. CONFIGURAÇÃO INICIAL E CACHE DE ELEMENTOS
// ===================================================================

const elements = {
    jogosContainer: document.getElementById("jogos"),
    btnGerarNovos: document.getElementById("gerar-novos"),
    avisoContainer: document.getElementById("aviso-container")
};

const config = {
    jogosPorVez: 3,
    numerosPorJogo: 6,
    numeroMaximo: 60,
    somaMinima: 100,
    somaMaxima: 215,
    combinacoesParImparAceitas: [
        { pares: 3, impares: 3 }, { pares: 2, impares: 4 }, { pares: 4, impares: 2 }
    ],
    minPrimos: 1, maxPrimos: 3,
    minQuadrantes: 3, maxNumerosPorQuadrante: 3,
    maxNumerosPorLinha: 3, maxSequencia: 2
};

const numeroFrequencia = new Map();
const primos = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

// ===================================================================
// 2. FUNÇÕES DE MAPEAMENTO E VALIDAÇÃO DAS REGRAS
// ===================================================================

function getLinha(n) { return Math.floor((n - 1) / 10) + 1; }
function getColuna(n) { return ((n - 1) % 10) + 1; }
function getQuadrante(n) {
    const l = getLinha(n), c = getColuna(n);
    if (l <= 3 && c <= 5) return 1;
    if (l <= 3 && c > 5) return 2;
    if (l > 3 && c <= 5) return 3;
    return 4;
}
function contarRepeticoes(n) { return numeroFrequencia.get(n) || 0; }
function somaValida(nums) { const s = nums.reduce((a, b) => a + b, 0); return s >= config.somaMinima && s <= config.somaMaxima; }
function proporcaoParImparValida(nums) { const p = nums.filter(n => n % 2 === 0).length; return config.combinacoesParImparAceitas.some(c => c.pares === p); }
function quadrantesValidos(nums) { const m = new Map(); nums.forEach(n => m.set(getQuadrante(n), (m.get(getQuadrante(n)) || 0) + 1)); return m.size >= config.minQuadrantes && Math.max(0, ...m.values()) <= config.maxNumerosPorQuadrante; }
function linhasValidas(nums) { const m = new Map(); nums.forEach(n => m.set(getLinha(n), (m.get(getLinha(n)) || 0) + 1)); return Math.max(0, ...m.values()) <= config.maxNumerosPorLinha; }
function semSequenciasLongas(nums) { const o = [...nums].sort((a, b) => a - b); for (let i = 0; i <= o.length - config.maxSequencia; i++) { if (o[i + config.maxSequencia - 1] - o[i] === config.maxSequencia - 1) return false; } return true; }
function primosValidos(nums) { const p = nums.filter(n => primos.includes(n)).length; return p >= config.minPrimos && p <= config.maxPrimos; }
function digitosFinaisVariados(nums) { return new Set(nums.map(n => n % 10)).size >= 4; }

// ===================================================================
// 3. LÓGICA PRINCIPAL DA APLICAÇÃO
// ===================================================================

/**
 * Inicializa a aplicação, configura os listeners e carrega os dados.
 */
async function init() {
    Object.entries(elements).forEach(([key, value]) => {
        if (!value) console.error(`Elemento com ID "${key}" não encontrado no DOM.`);
    });
    
    if (elements.btnGerarNovos) {
        elements.btnGerarNovos.addEventListener('click', gerarJogos);
    }
    
    const yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    
    await carregarDadosSorteados();
    gerarJogos(); // Gera os jogos na primeira carga
}

/**
 * Limpa a área de exibição dos jogos e os avisos.
 */
function limpar() {
    if (elements.jogosContainer) elements.jogosContainer.innerHTML = "";
    if (elements.avisoContainer) elements.avisoContainer.innerHTML = "";
}

/**
 * Tenta gerar um único jogo que passe em todas as regras de validação.
 * @param {Array<number>} pool - O conjunto de números disponíveis para o sorteio.
 * @returns {{numeros: Array<number>, aviso: string}} O jogo gerado e um aviso.
 */
function gerarJogo(pool) {
    let tentativas = 0;
    while (tentativas < 5000) {
        tentativas++;
        const numeros = embaralharESelecionar(pool);
        if (somaValida(numeros) && proporcaoParImparValida(numeros) && quadrantesValidos(numeros) && linhasValidas(numeros) && semSequenciasLongas(numeros) && primosValidos(numeros) && digitosFinaisVariados(numeros)) {
            return { numeros: numeros.sort((a, b) => a - b), aviso: "Jogo gerado com padrões estatísticos." };
        }
    }
    // Fallback: Se não encontrar um jogo ideal, gera com os menos frequentes.
    const numeros = pool.sort((a, b) => contarRepeticoes(a) - contarRepeticoes(b)).slice(0, config.numerosPorJogo);
    return { numeros: numeros.sort((a, b) => a - b), aviso: "Jogo gerado com números menos frequentes (fallback)." };
}

/**
 * Embaralha um array e seleciona a quantidade de números para um jogo.
 * @param {Array<number>} array - O array a ser embaralhado.
 * @returns {Array<number>} Um subconjunto do array embaralhado.
 */
function embaralharESelecionar(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, config.numerosPorJogo);
}

/**
 * Exibe uma mensagem de status para o usuário.
 * @param {string} msg - A mensagem a ser exibida.
 * @param {string} tipo - O tipo de alerta ('info' ou 'erro').
 */
function mostrarAviso(msg, tipo = "info") {
    if (elements.avisoContainer) elements.avisoContainer.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
}

/**
 * Orquestra a geração de um conjunto completo de jogos.
 */
function gerarJogos() {
    console.log("Gerando novo conjunto de jogos...");
    let pool = Array.from({ length: config.numeroMaximo }, (_, i) => i + 1);
    const jogosGerados = [];
    let aviso = "";
    for (let i = 0; i < config.jogosPorVez; i++) {
        if (pool.length < config.numerosPorJogo) {
            mostrarAviso(`Não há números suficientes para gerar o jogo ${i + 1}.`, "aviso");
            break;
        }
        const resultado = gerarJogo(pool);
        jogosGerados.push(resultado.numeros);
        aviso = resultado.aviso;
        // Garante que os números não se repitam entre os jogos gerados na mesma vez
        pool = pool.filter(n => !resultado.numeros.includes(n));
    }
    if (aviso) mostrarAviso(aviso, "info");
    exibirJogos(jogosGerados);
}

/**
 * Renderiza os jogos gerados na tela.
 * @param {Array<Array<number>>} jogos - Um array contendo os jogos a serem exibidos.
 */
function exibirJogos(jogos) {
    limpar();
    const fragment = document.createDocumentFragment();
    jogos.forEach((jogo, index) => {
        const divJogo = document.createElement("div");
        divJogo.className = "jogo";
        const indicador = document.createElement("i");
        indicador.textContent = `${index + 1}.`;
        divJogo.appendChild(indicador);
        jogo.forEach(n => {
            const bola = document.createElement("span");
            bola.textContent = String(n).padStart(2, '0');
            const freq = contarRepeticoes(n);
            if (freq > 0) {
                bola.classList.add("sorteado");
                bola.title = `Sorteado ${freq} vez(es).`;
            } else {
                bola.classList.add("nao-sorteado");
                bola.title = "Nunca sorteado.";
            }
            divJogo.appendChild(bola);
        });
        fragment.appendChild(divJogo);
    });
    if (elements.jogosContainer) elements.jogosContainer.appendChild(fragment);
}

/**
 * Carrega os dados históricos dos sorteios do arquivo JSON.
 */
async function carregarDadosSorteados() {
    try {
        const res = await fetch('./data/sorteios_mega_sena.json');
        if (!res.ok) throw new Error(`Erro HTTP! Status: ${res.status}`);
        const data = await res.json();
        data.forEach(s => s.forEach(n => numeroFrequencia.set(n, (numeroFrequencia.get(n) || 0) + 1)));
        console.log(`Dados de ${data.length} sorteios carregados.`);
    } catch (error) {
        console.error("Erro ao carregar dados dos sorteios:", error);
        mostrarAviso(`Erro ao carregar dados históricos.`, "erro");
    }
}

// ===================================================================
// 4. INICIALIZAÇÃO DA APLICAÇÃO
// ===================================================================

document.addEventListener('DOMContentLoaded', init);