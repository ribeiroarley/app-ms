/**
 * Gerador de Números para Mega-Sena com Estratégias Baseadas em Padrões
 * @author Arley Ribeiro
 * @version 2.0
 */

// Cache de elementos DOM
const elements = {
    jogosContainer: document.getElementById("jogos"),
    btnGerarNovos: document.getElementById("gerar-novos"),
    avisoContainer: document.getElementById("aviso-container")
};

// Verifica se todos os elementos foram encontrados
Object.entries(elements).forEach(([key, value]) => {
    if (!value) console.error(`Elemento com ID "${key}" não encontrado no DOM. Verifique o HTML.`);
});

// Configurações baseadas em análise estatística
const config = {
    jogosPorVez: 3,
    numerosPorJogo: 6,
    numeroMaximo: 60,
    somaMinima: 100,
    somaMaxima: 215,
    combinacoesParImparAceitas: [
        { pares: 3, impares: 3 },
        { pares: 2, impares: 4 },
        { pares: 4, impares: 2 }
    ],
    minPrimos: 1,
    maxPrimos: 3,
    minQuadrantes: 3,
    maxNumerosPorQuadrante: 3,
    maxNumerosPorLinha: 3,
    maxSequencia: 2
};

// Map para armazenar a frequência de cada número
const numeroFrequencia = new Map();
const primos = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

// --- FUNÇÕES DE MAPEAMENTO DO VOLANTE ---
function getLinha(n) { return Math.floor((n - 1) / 10) + 1; }
function getColuna(n) { return ((n - 1) % 10) + 1; }
function getQuadrante(n) {
    const linha = getLinha(n);
    const coluna = getColuna(n);
    if (linha <= 3 && coluna <= 5) return 1;
    if (linha <= 3 && coluna > 5)  return 2;
    if (linha > 3 && coluna <= 5)  return 3;
    return 4;
}

// --- FUNÇÕES DE VALIDAÇÃO DE JOGOS ---
function contarRepeticoes(numero) { return numeroFrequencia.get(numero) || 0; }
function somaValida(numeros) {
    const soma = numeros.reduce((acc, num) => acc + num, 0);
    return soma >= config.somaMinima && soma <= config.somaMaxima;
}
function proporcaoParImparValida(numeros) {
    const pares = numeros.filter(n => n % 2 === 0).length;
    return config.combinacoesParImparAceitas.some(c => c.pares === pares);
}
function quadrantesValidos(numeros) {
    const contagem = new Map();
    numeros.forEach(n => contagem.set(getQuadrante(n), (contagem.get(getQuadrante(n)) || 0) + 1));
    return contagem.size >= config.minQuadrantes && Math.max(0, ...contagem.values()) <= config.maxNumerosPorQuadrante;
}
function linhasValidas(numeros) {
    const contagem = new Map();
    numeros.forEach(n => contagem.set(getLinha(n), (contagem.get(getLinha(n)) || 0) + 1));
    return Math.max(0, ...contagem.values()) <= config.maxNumerosPorLinha;
}
function semSequenciasLongas(numeros) {
    const ordenados = [...numeros].sort((a, b) => a - b);
    for (let i = 0; i <= ordenados.length - config.maxSequencia; i++) {
        if (ordenados[i + config.maxSequencia - 1] - ordenados[i] === config.maxSequencia - 1) return false;
    }
    return true;
}
function primosValidos(numeros) {
    const numPrimos = numeros.filter(n => primos.includes(n)).length;
    return numPrimos >= config.minPrimos && numPrimos <= config.maxPrimos;
}
function digitosFinaisVariados(numeros) {
    return new Set(numeros.map(n => n % 10)).size >= 4;
}

// Inicialização da aplicação
async function init() {
    if (!elements.btnGerarNovos) return;
    elements.btnGerarNovos.addEventListener('click', gerarJogos);
    const yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    await carregarDadosSorteados();
    gerarJogos();
}

// Limpa os resultados e avisos
function limpar() {
    if (elements.jogosContainer) elements.jogosContainer.innerHTML = "";
    if (elements.avisoContainer) elements.avisoContainer.innerHTML = "";
}

/**
 * Gera um único jogo com base nas estratégias de padrões
 */
function gerarJogo(poolDisponivel) {
    let tentativas = 0;
    const maxTentativas = 5000;
    while (tentativas < maxTentativas) {
        tentativas++;
        const numerosGerados = embaralharESelecionar(poolDisponivel);
        if (somaValida(numerosGerados) && proporcaoParImparValida(numerosGerados) && quadrantesValidos(numerosGerados) && linhasValidas(numerosGerados) && semSequenciasLongas(numerosGerados) && primosValidos(numerosGerados) && digitosFinaisVariados(numerosGerados)) {
            return { numeros: numerosGerados.sort((a, b) => a - b), aviso: "Jogo gerado com padrões estatísticos." };
        }
    }
    const numerosGerados = poolDisponivel.sort((a, b) => contarRepeticoes(a) - contarRepeticoes(b)).slice(0, config.numerosPorJogo);
    return { numeros: numerosGerados.sort((a, b) => a - b), aviso: "Jogo gerado com números menos frequentes (fallback)." };
}

/**
 * Embaralha e seleciona números usando Fisher-Yates
 */
function embaralharESelecionar(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, config.numerosPorJogo);
}

// Mostra mensagens de aviso ou erro
function mostrarAviso(mensagem, tipo = "info") {
    if (elements.avisoContainer) elements.avisoContainer.innerHTML = `<div class="alert alert-${tipo}">${mensagem}</div>`;
}

/**
 * Gera um conjunto fixo de jogos, garantindo unicidade
 */
function gerarJogos() {
    console.log("Gerando novo conjunto de jogos...");
    const qtdJogos = config.jogosPorVez;
    let avisoGlobal = "";
    const jogosGerados = [];
    let poolAtual = Array.from({ length: config.numeroMaximo }, (_, i) => i + 1);
    for (let i = 0; i < qtdJogos; i++) {
        if (poolAtual.length < config.numerosPorJogo) {
            mostrarAviso(`Não há números suficientes no pool para gerar o jogo ${i + 1}.`, "aviso");
            break;
        }
        const { numeros, aviso } = gerarJogo(poolAtual);
        avisoGlobal = aviso;
        jogosGerados.push(numeros);
        poolAtual = poolAtual.filter(n => !numeros.includes(n));
    }
    if (avisoGlobal) mostrarAviso(avisoGlobal, "info");
    exibirJogos(jogosGerados);
}

// Exibe os jogos gerados
function exibirJogos(jogos) {
    limpar();
    const fragment = document.createDocumentFragment();
    jogos.forEach((jogo, index) => {
        const divJogo = document.createElement("div");
        divJogo.className = "jogo";
        const indicador = document.createElement("i");
        indicador.textContent = `${index + 1}.`;
        divJogo.appendChild(indicador);
        jogo.forEach(numero => {
            const bola = document.createElement("span");
            bola.textContent = String(numero).padStart(2, '0');
            const frequencia = contarRepeticoes(numero);

            // --- AJUSTE REALIZADO AQUI ---
            // Adiciona a classe CSS correta para a cor da bola
            if (frequencia > 0) {
                bola.classList.add("sorteado");
                bola.title = `Sorteado ${frequencia} vez(es).`;
            } else {
                bola.classList.add("nao-sorteado");
                bola.title = "Nunca sorteado.";
            }
            
            divJogo.appendChild(bola);
        });
        fragment.appendChild(divJogo);
    });
    elements.jogosContainer.appendChild(fragment);
}

/**
 * Carrega os dados dos números sorteados
 */
async function carregarDadosSorteados() {
    try {
        const response = await fetch('./data/sorteios_mega_sena.json');
        if (!response.ok) throw new Error(`Erro HTTP! Status: ${response.status}`);
        const concursos = await response.json();
        concursos.forEach(sorteio => sorteio.forEach(numero => {
            numeroFrequencia.set(numero, (numeroFrequencia.get(numero) || 0) + 1);
        }));
        console.log(`Dados de ${concursos.length} sorteios carregados.`);
    } catch (error) {
        console.error("Erro ao carregar dados sorteados:", error);
        mostrarAviso(`Erro ao carregar dados históricos. A geração pode não ser otimizada.`, "erro");
    }
}

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', init);