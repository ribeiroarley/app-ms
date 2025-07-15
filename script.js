/**
 * Gerador de Números para Mega-Sena com Estratégias Baseadas em Padrões
 * @author Arley Ribeiro
 * @version 1.3 (Aprimorado com Análise Estatística)
 */

// Cache de elementos DOM
const elements = {
    jogosContainer: document.getElementById("jogos"),
    qtdInput: document.getElementById("qtd"),
    btnGerar: document.getElementById("gerar-jogos"),
    btnLimpar: document.getElementById("limpar"),
    avisoContainer: document.getElementById("aviso-container")
};

// Verifica se todos os elementos foram encontrados
Object.entries(elements).forEach(([key, value]) => {
    if (!value) console.error(`Elemento com ID "${key}" não encontrado no DOM. Verifique o HTML.`);
});

// Configurações baseadas em análise estatística
const config = {
    maxJogos: 3,
    numerosPorJogo: 6,
    numeroMaximo: 60,
    valorPadrao: 1,
    somaMinima: 100,
    somaMaxima: 215,
    combinacoesParImparAceitas: [
        { pares: 3, impares: 3 }, // A mais comum
        { pares: 2, impares: 4 }, // Segunda mais comum
        { pares: 4, impares: 2 }  // Terceira mais comum
    ],
    minPrimos: 1,
    maxPrimos: 3,
    minQuadrantes: 3,
    maxNumerosPorQuadrante: 3,
    maxNumerosPorLinha: 3, // Nova regra
    maxSequencia: 2
};

// Map para armazenar a frequência de cada número
const numeroFrequencia = new Map();
const primos = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

// --- FUNÇÕES DE MAPEAMENTO DO VOLANTE ---

/**
 * Retorna a linha do volante (1 a 6) para um dado número.
 * @param {number} n - O número da bola.
 * @returns {number} A linha correspondente.
 */
function getLinha(n) {
    return Math.floor((n - 1) / 10) + 1;
}

/**
 * Retorna a coluna do volante (1 a 10) para um dado número.
 * @param {number} n - O número da bola.
 * @returns {number} A coluna correspondente.
 */
function getColuna(n) {
    return ((n - 1) % 10) + 1;
}

/**
 * Retorna o quadrante do volante (1 a 4) para um dado número.
 * @param {number} n - O número da bola.
 * @returns {number} O quadrante correspondente (1:SE, 2:SD, 3:IE, 4:ID).
 */
function getQuadrante(n) {
    const linha = getLinha(n);
    const coluna = getColuna(n);
    if (linha <= 3 && coluna <= 5) return 1; // Superior Esquerdo
    if (linha <= 3 && coluna > 5)  return 2; // Superior Direito
    if (linha > 3 && coluna <= 5)  return 3; // Inferior Esquerdo
    return 4; // Inferior Direito
}


// --- FUNÇÕES DE VALIDAÇÃO DE JOGOS ---

// Conta repetições de um número
function contarRepeticoes(numero) {
    return numeroFrequencia.get(numero) || 0;
}

// Verifica se a soma dos números está na faixa desejada
function somaValida(numeros) {
    const soma = numeros.reduce((acc, num) => acc + num, 0);
    return soma >= config.somaMinima && soma <= config.somaMaxima;
}

// Verifica se a proporção de pares/ímpares está entre as mais sorteadas
function proporcaoParImparValida(numeros) {
    const pares = numeros.filter(n => n % 2 === 0).length;
    const impares = config.numerosPorJogo - pares;
    return config.combinacoesParImparAceitas.some(combinacao =>
        combinacao.pares === pares && combinacao.impares === impares
    );
}

// Verifica a distribuição por quadrantes usando o mapeamento do volante real
function quadrantesValidos(numeros) {
    const quadrantesContagem = new Map();
    numeros.forEach(n => {
        const q = getQuadrante(n);
        quadrantesContagem.set(q, (quadrantesContagem.get(q) || 0) + 1);
    });
    const quadrantesUsados = quadrantesContagem.size;
    const maxPorQuadrante = Math.max(0, ...quadrantesContagem.values());
    return quadrantesUsados >= config.minQuadrantes && maxPorQuadrante <= config.maxNumerosPorQuadrante;
}

// Verifica se os números estão bem distribuídos pelas linhas
function linhasValidas(numeros) {
    const linhasContagem = new Map();
    numeros.forEach(n => {
        const l = getLinha(n);
        linhasContagem.set(l, (linhasContagem.get(l) || 0) + 1);
    });
    return Math.max(0, ...linhasContagem.values()) <= config.maxNumerosPorLinha;
}

// Verifica se há sequências longas
function semSequenciasLongas(numeros) {
    const ordenados = [...numeros].sort((a, b) => a - b);
    for (let i = 0; i <= ordenados.length - config.maxSequencia; i++) {
        if (ordenados[i + config.maxSequencia - 1] - ordenados[i] === config.maxSequencia - 1) {
            return false;
        }
    }
    return true;
}

// Verifica quantidade de números primos
function primosValidos(numeros) {
    const numPrimos = numeros.filter(n => primos.includes(n)).length;
    return numPrimos >= config.minPrimos && numPrimos <= config.maxPrimos;
}

// Verifica variação nos dígitos finais
function digitosFinaisVariados(numeros) {
    const finais = numeros.map(n => n % 10);
    const unicos = new Set(finais).size;
    return unicos >= 4; // Pelo menos 4 dígitos finais diferentes
}

// Inicialização da aplicação
function init() {
    if (!elements.btnGerar || !elements.btnLimpar || !elements.qtdInput || !elements.jogosContainer || !elements.avisoContainer) {
        console.error("Um ou mais elementos necessários não foram encontrados. Abortando inicialização.");
        return;
    }
    setupEventListeners();
    resetarParaPadrao();
    carregarDadosSorteados();
    const yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

// Reseta o input e limpa a tela
function resetarParaPadrao() {
    if (!elements.qtdInput) {
        console.error("Input com ID 'qtd' não encontrado.");
        return;
    }
    elements.qtdInput.value = config.valorPadrao;
    limpar();
    elements.qtdInput.focus();
}

// Configura os event listeners
function setupEventListeners() {
    elements.btnGerar.addEventListener('click', () => {
        console.log("Botão Gerar Jogos clicado");
        gerarJogos();
    });
    elements.btnLimpar.addEventListener('click', () => {
        console.log("Botão Limpar Tudo clicado");
        resetarParaPadrao();
    });
    elements.qtdInput.addEventListener('input', validarEntradaEmTempoReal);
    elements.qtdInput.addEventListener('keypress', enter);
}

// Validação em tempo real do input
function validarEntradaEmTempoReal() {
    let valor = this.value.replace(/[^0-9]/g, '');
    if (valor === '') {
        valor = config.valorPadrao;
    } else {
        valor = parseInt(valor, 10);
        if (isNaN(valor)) valor = config.valorPadrao;
        else if (valor > config.maxJogos) valor = config.maxJogos;
        else if (valor < 1) valor = 1;
    }
    this.value = valor;
}

// Gerenciador de tecla Enter
function enter(event) {
    if (event.key === "Enter") gerarJogos();
}

// Limpa os resultados e avisos
function limpar() {
    if (!elements.jogosContainer || !elements.avisoContainer) {
        console.error("Um ou mais elementos (jogosContainer ou avisoContainer) não foram encontrados.");
        return;
    }
    elements.jogosContainer.innerHTML = "";
    elements.avisoContainer.innerHTML = "";
}

/**
 * Gera um único jogo com base nas estratégias de padrões
 * @param {Array<number>} poolDisponivel - O array de números disponíveis
 * @returns {{numeros: Array<number>, aviso: string, poolRestante: Array<number>}}
 */
function gerarJogo(poolDisponivel) {
    let tentativas = 0;
    const maxTentativas = 5000;
    let numerosGerados = [];
    let poolAtual = [...poolDisponivel];
    let aviso = "Jogo gerado com padrões estatísticos.";

    while (tentativas < maxTentativas) {
        tentativas++;
        numerosGerados = embaralharESelecionar(poolAtual);
        if (
            somaValida(numerosGerados) &&
            proporcaoParImparValida(numerosGerados) &&
            quadrantesValidos(numerosGerados) &&
            linhasValidas(numerosGerados) && // <-- Nova regra adicionada
            semSequenciasLongas(numerosGerados) &&
            primosValidos(numerosGerados) &&
            digitosFinaisVariados(numerosGerados)
        ) {
            return {
                numeros: numerosGerados.sort((a, b) => a - b),
                aviso: aviso,
                poolRestante: poolAtual.filter(n => !numerosGerados.includes(n))
            };
        }
    }

    // Fallback: números menos frequentes
    numerosGerados = poolAtual
        .sort((a, b) => contarRepeticoes(a) - contarRepeticoes(b))
        .slice(0, config.numerosPorJogo);
    aviso = "Jogo gerado com números menos frequentes (fallback).";
    return {
        numeros: numerosGerados.sort((a, b) => a - b),
        aviso: aviso,
        poolRestante: poolAtual.filter(n => !numerosGerados.includes(n))
    };
}

/**
 * Embaralha e seleciona números usando Fisher-Yates
 * @param {Array<number>} array - O array a ser embaralhado
 * @returns {Array<number>} Números selecionados
 */
function embaralharESelecionar(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, config.numerosPorJogo);
}

// Valida a entrada do usuário
function validarEntrada() {
    const valor = parseInt(elements.qtdInput.value, 10);
    if (isNaN(valor) || valor < 1) {
        mostrarAviso("Por favor, digite um número válido maior que zero", "erro");
        resetarParaPadrao();
        return false;
    }
    if (valor > config.maxJogos) {
        mostrarAviso(`Você pode gerar no máximo ${config.maxJogos} jogos por vez`, "erro");
        elements.qtdInput.value = config.maxJogos;
        elements.qtdInput.focus();
        return false;
    }
    return true;
}

// Mostra mensagens de aviso ou erro
function mostrarAviso(mensagem, tipo = "info") {
    if (!elements.avisoContainer) {
        console.error("Elemento avisoContainer não encontrado.");
        return;
    }
    elements.avisoContainer.innerHTML = `
        <div class="alert alert-${tipo}">
            ${mensagem}
        </div>
    `;
}

/**
 * Gera múltiplos jogos, garantindo unicidade
 */
function gerarJogos() {
    if (!validarEntrada()) return;
    const qtdJogos = parseInt(elements.qtdInput.value, 10);
    let avisoGlobal = "";
    const jogosGerados = [];
    let poolAtual = Array.from({ length: config.numeroMaximo }, (_, i) => i + 1);

    for (let i = 0; i < qtdJogos; i++) {
        if (poolAtual.length < config.numerosPorJogo) {
            mostrarAviso(`Não há números suficientes (${poolAtual.length} restantes) no pool para gerar o jogo ${i + 1}.`, "aviso");
            break;
        }
        const { numeros, aviso, poolRestante } = gerarJogo(poolAtual);
        if (aviso) avisoGlobal = aviso;
        if (numeros.length === config.numerosPorJogo) {
            jogosGerados.push(numeros);
            poolAtual = poolRestante;
        } else {
            mostrarAviso("Não foi possível gerar um jogo completo. Tente novamente.", "erro");
            return;
        }
    }
    if (avisoGlobal) mostrarAviso(avisoGlobal, "aviso");
    exibirJogos(jogosGerados);
}

// Exibe os jogos gerados
function exibirJogos(jogos) {
    console.log("Jogos gerados:", jogos);
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
            if (frequencia > 0) {
                bola.classList.add("sorteado");
                bola.title = `Número sorteado ${frequencia} vez(es) anteriormente.`;
            } else {
                bola.classList.add("nao-sorteado");
                bola.title = "Número nunca sorteado";
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
        if (!response.ok) throw new Error(`Erro HTTP! Status: ${response.status} ${response.statusText}`);
        const concursos = await response.json();
        concursos.forEach(sorteio => {
            sorteio.forEach(numero => {
                numeroFrequencia.set(numero, (numeroFrequencia.get(numero) || 0) + 1);
            });
        });
        console.log("Dados de frequência carregados:", numeroFrequencia);
        mostrarAviso(`Dados históricos de ${concursos.length} sorteios carregados com sucesso!`, "info");
    } catch (error) {
        console.error("Erro ao carregar dados sorteados:", error);
        mostrarAviso(`Erro ao carregar dados históricos: ${error.message}. A geração de números pode não ser otimizada.`, "erro");
    }
}

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', init);