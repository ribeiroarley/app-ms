/**
 * Gerador de Números para Mega-Sena com Estratégias Baseadas em Padrões
 * @author Arley Ribeiro
 * @version 3.1 (Edição - Calibrada com Estatística Real)
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
    
    // CALIBRAGEM BASEADA NA SUA ANÁLISE (Média da Soma ~183)
    somaMinima: 135, // Foca no centro da curva de Gauss
    somaMaxima: 210, 
    
    combinacoesParImparAceitas: [
        { pares: 3, impares: 3 }, // O equilíbrio perfeito (mais frequente)
        { pares: 2, impares: 4 }, 
        { pares: 4, impares: 2 }
    ],
    
    minPrimos: 1, 
    maxPrimos: 3, // Validado pela análise (Moda = 3)
    
    minQuadrantes: 3, // Garante distribuição espacial
    maxNumerosPorQuadrante: 3,
    maxNumerosPorLinha: 3, 
    maxSequencia: 2 // Evita sequências longas (ex: 10, 11, 12)
};

const numeroFrequencia = new Map();
let ultimoSorteio = []; // Armazenará o último resultado para evitar repetição
const primos = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

// ===================================================================
// 2. FUNÇÕES DE MAPEAMENTO E VALIDAÇÃO DAS REGRAS
// ===================================================================

function getLinha(n) { return Math.floor((n - 1) / 10) + 1; }
function getColuna(n) { return ((n - 1) % 10) + 1; }

function getQuadrante(n) {
    const l = getLinha(n), c = getColuna(n);
    if (l <= 3 && c <= 5) return 1; // Q1
    if (l <= 3 && c > 5) return 2;  // Q2
    if (l > 3 && c <= 5) return 3;  // Q3
    return 4;                       // Q4
}

function contarRepeticoes(n) { return numeroFrequencia.get(n) || 0; }
function somaValida(nums) { const s = nums.reduce((a, b) => a + b, 0); return s >= config.somaMinima && s <= config.somaMaxima; }
function proporcaoParImparValida(nums) { const p = nums.filter(n => n % 2 === 0).length; return config.combinacoesParImparAceitas.some(c => c.pares === p); }
function quadrantesValidos(nums) { const m = new Map(); nums.forEach(n => m.set(getQuadrante(n), (m.get(getQuadrante(n)) || 0) + 1)); return m.size >= config.minQuadrantes && Math.max(0, ...m.values()) <= config.maxNumerosPorQuadrante; }
function linhasValidas(nums) { const m = new Map(); nums.forEach(n => m.set(getLinha(n), (m.get(getLinha(n)) || 0) + 1)); return Math.max(0, ...m.values()) <= config.maxNumerosPorLinha; }
function semSequenciasLongas(nums) { const o = [...nums].sort((a, b) => a - b); for (let i = 0; i <= o.length - config.maxSequencia; i++) { if (o[i + config.maxSequencia - 1] - o[i] === config.maxSequencia - 1) return false; } return true; }
function primosValidos(nums) { const p = nums.filter(n => primos.includes(n)).length; return p >= config.minPrimos && p <= config.maxPrimos; }
function digitosFinaisVariados(nums) { return new Set(nums.map(n => n % 10)).size >= 4; }

// Regra baseada na análise: Moda de repetições = 0
// Evita gerar jogos que repitam mais de 1 número do concurso anterior
function evitarRepeticaoImediata(nums) {
    if (ultimoSorteio.length === 0) return true;
    const repetidos = nums.filter(n => ultimoSorteio.includes(n));
    return repetidos.length <= 1; 
}

// ===================================================================
// 3. LÓGICA PRINCIPAL DA APLICAÇÃO
// ===================================================================

/**
 * Inicializa a aplicação.
 */
async function init() {
    // Verificação de segurança dos elementos DOM
    Object.entries(elements).forEach(([key, value]) => {
        if (!value) console.error(`Elemento com ID "${key}" não encontrado no DOM.`);
    });
    
    // Configura o botão
    if (elements.btnGerarNovos) {
        elements.btnGerarNovos.addEventListener('click', gerarJogos);
    }
    
    // Configura o ano no rodapé
    const yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    
    // Carrega os dados, mas NÃO gera jogos automaticamente (aguarda clique)
    await carregarDadosSorteados();
}

/**
 * Limpa a tela.
 */
function limpar() {
    if (elements.jogosContainer) elements.jogosContainer.innerHTML = "";
    if (elements.avisoContainer) elements.avisoContainer.innerHTML = "";
}

/**
 * Cria Pool Ponderado (Dá leve preferência a números quentes, mas mantém aleatoriedade).
 * Se um número saiu mais de 280 vezes, ele ganha uma "ficha" extra no sorteio.
 */
function criarPoolPonderado(poolOriginal) {
    let poolPonderado = [];
    poolOriginal.forEach(num => {
        poolPonderado.push(num);
        if (contarRepeticoes(num) > 280) { 
            poolPonderado.push(num);
        }
    });
    return poolPonderado;
}

/**
 * Gera um único jogo validado.
 */
function gerarJogo(pool) {
    let tentativas = 0;
    const poolParaSorteio = criarPoolPonderado(pool);

    // Tenta até 10.000 vezes encontrar um jogo que atenda a TODAS as estatísticas
    while (tentativas < 10000) {
        tentativas++;
        let numerosCandidatos = embaralharESelecionar(poolParaSorteio);
        numerosCandidatos = [...new Set(numerosCandidatos)]; // Remove duplicatas da ponderação
        
        // Completa se faltar números (caso a remoção de duplicatas tenha reduzido o array)
        while (numerosCandidatos.length < 6) {
            const extra = pool[Math.floor(Math.random() * pool.length)];
            if (!numerosCandidatos.includes(extra)) numerosCandidatos.push(extra);
        }
        
        const numeros = numerosCandidatos.slice(0, 6);

        // O "FILTRO SNIPER": O jogo só passa se atender a TODOS os critérios
        if (somaValida(numeros) && 
            proporcaoParImparValida(numeros) && 
            quadrantesValidos(numeros) && 
            linhasValidas(numeros) && 
            semSequenciasLongas(numeros) && 
            primosValidos(numeros) && 
            digitosFinaisVariados(numeros) &&
            evitarRepeticaoImediata(numeros)) {
            
            return { numeros: numeros.sort((a, b) => a - b), aviso: "Jogo gerado com padrões estatísticos calibrados." };
        }
    }
    
    // Fallback: Se for muito difícil achar um jogo perfeito, gera um baseado na frequência inversa (mais frios)
    const numeros = pool.sort((a, b) => contarRepeticoes(a) - contarRepeticoes(b)).slice(0, config.numerosPorJogo);
    return { numeros: numeros.sort((a, b) => a - b), aviso: "Jogo gerado com números menos frequentes (fallback)." };
}

/**
 * Embaralha e seleciona números (Fisher-Yates Shuffle).
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
 * Mostra avisos na tela.
 */
function mostrarAviso(msg, tipo = "info") {
    if (elements.avisoContainer) elements.avisoContainer.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
}

/**
 * Gera o conjunto de 3 jogos únicos.
 */
function gerarJogos() {
    console.log("Botão clicado: Gerando novo conjunto de jogos...");
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
        
        // Garante que os números não se repitam entre os 3 jogos gerados agora
        pool = pool.filter(n => !resultado.numeros.includes(n));
    }
    
    if (aviso) mostrarAviso(aviso, "info");
    exibirJogos(jogosGerados);
}

/**
 * Exibe os jogos com as cores corretas (Verde/Laranja).
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
            
            // APLICAÇÃO DAS CORES (Classes CSS)
            if (freq > 0) {
                bola.classList.add("sorteado");
                bola.title = `Sorteado ${freq} vez(es).`;
            } else {
                bola.classList.add("nao-sorteado"); // Nunca deve acontecer se o JSON estiver completo, mas é bom ter
                bola.title = "Nunca sorteado.";
            }
            divJogo.appendChild(bola);
        });
        fragment.appendChild(divJogo);
    });
    if (elements.jogosContainer) elements.jogosContainer.appendChild(fragment);
}

/**
 * Carrega e processa o JSON.
 */
async function carregarDadosSorteados() {
    try {
        const res = await fetch('./data/sorteios_mega_sena.json');
        if (!res.ok) throw new Error(`Erro HTTP! Status: ${res.status}`);
        const data = await res.json();
        
        // Mapa de Frequência
        data.forEach(s => s.forEach(n => numeroFrequencia.set(n, (numeroFrequencia.get(n) || 0) + 1)));
        
        // Captura o último sorteio para a regra de anti-repetição
        if (data.length > 0) {
            ultimoSorteio = data[data.length - 1]; 
        }
        
        console.log(`Dados carregados: ${data.length} sorteios. Último: ${ultimoSorteio}`);
    } catch (error) {
        console.error("Erro ao carregar JSON:", error);
        mostrarAviso(`Erro ao carregar dados históricos.`, "erro");
    }
}

// ===================================================================
// 4. INICIALIZAÇÃO DA APLICAÇÃO
// ===================================================================

document.addEventListener('DOMContentLoaded', init);