/**
 * Gerador de Números para Mega-Sena
 * Integrado com UI Moderna e Lógica Estatística
 * @version 4.2 - Production Ready
 * @author Arley Ribeiro
 */

class LotteryGame {
    constructor() {
        // Cache de elementos do DOM
        this.ui = {
            form: document.getElementById('form-gerador'),
            inputQtd: document.getElementById('qtd-jogos'),
            btnGerar: document.getElementById('btn-gerar'),
            btnLimpar: document.getElementById('btn-limpar'),
            containerJogos: document.getElementById('jogos-container'),
            avisoContainer: document.getElementById('aviso-container'),
            spinner: document.querySelector('.spinner'),
            yearSpan: document.getElementById('year')
        };

        // Configurações Estatísticas (Filtros)
        this.config = {
            numerosPorJogo: 6,
            numeroMaximo: 60,
            somaMinima: 135,
            somaMaxima: 210,
            combinacoesParImpar: [
                { pares: 3, impares: 3 }, // Equilíbrio perfeito (O mais comum)
                { pares: 2, impares: 4 }, // Leve tendência
                { pares: 4, impares: 2 }  // Leve tendência
            ],
            limites: {
                minPrimos: 1, maxPrimos: 3,
                minQuadrantes: 3, maxPorQuadrante: 3,
                maxPorLinha: 3,
                maxSequencia: 2 // Ex: permite 1,2 mas bloqueia 1,2,3
            },
            maxTentativas: 5000 // Limite de segurança para evitar loop infinito
        };

        // Estado da Aplicação
        this.dadosHistoricos = new Map(); // Armazena a frequência de cada número
        this.ultimoSorteio = [];
        // Conjunto de números primos para busca rápida (O(1))
        this.primos = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);

        this.init();
    }

    // =================================================================
    // INICIALIZAÇÃO E EVENTOS
    // =================================================================
    async init() {
        this.atualizarAnoFooter();
        this.registrarEventos();
        
        // Carrega dados históricos silenciosamente ao iniciar a aplicação
        await this.carregarDadosHistoricos();
    }

    registrarEventos() {
        // 1. Submit do formulário (Clique no botão ou envio nativo)
        if (this.ui.form) {
            this.ui.form.addEventListener('submit', (e) => {
                e.preventDefault(); // Impede o recarregamento da página
                this.iniciarGeracao();
            });
        }

        // 2. Melhoria de UX: Suporte à tecla ENTER no input de quantidade
        if (this.ui.inputQtd) {
            this.ui.inputQtd.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Impede envio duplicado
                    this.ui.btnGerar.click(); // Aciona o botão visualmente
                }
            });
        }

        // 3. Botão Limpar
        if (this.ui.btnLimpar) {
            this.ui.btnLimpar.addEventListener('click', () => this.limparTela());
        }
    }

    atualizarAnoFooter() {
        if (this.ui.yearSpan) {
            this.ui.yearSpan.textContent = new Date().getFullYear();
        }
    }

    // =================================================================
    // LÓGICA DE DADOS (JSON)
    // =================================================================
    async carregarDadosHistoricos() {
        try {
            // Tenta buscar o arquivo JSON local
            const response = await fetch('./data/sorteios_mega_sena.json');
            
            if (!response.ok) throw new Error('Arquivo de dados não encontrado.');
            
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                // Popula o mapa de frequência
                data.forEach(sorteio => {
                    sorteio.forEach(num => {
                        const count = this.dadosHistoricos.get(num) || 0;
                        this.dadosHistoricos.set(num, count + 1);
                    });
                });
                
                // Armazena o último sorteio para evitar repetição exata
                this.ultimoSorteio = data[data.length - 1];
                console.log(`[Sistema] Base carregada: ${data.length} concursos processados.`);
            }
        } catch (error) {
            console.warn("[Sistema] Rodando em modo Offline (Sem histórico).", error);
            // O app continua funcionando usando apenas as regras matemáticas
        }
    }

    // =================================================================
    // CORE: GERAÇÃO E VALIDAÇÃO
    // =================================================================
    
    iniciarGeracao() {
        this.setLoading(true);
        this.limparNotificacoes();

        // setTimeout permite que a UI renderize o spinner antes do cálculo pesado
        setTimeout(() => {
            try {
                const qtd = parseInt(this.ui.inputQtd.value) || 1;
                const jogos = [];

                for (let i = 0; i < qtd; i++) {
                    jogos.push(this.gerarUnicoJogo());
                }

                this.renderizarJogos(jogos);
                
                // Exibe o botão limpar se houver resultados
                if(this.ui.btnLimpar) this.ui.btnLimpar.classList.remove('hidden');

            } catch (erro) {
                this.mostrarNotificacao("Erro ao gerar jogos: " + erro.message, "erro");
            } finally {
                this.setLoading(false);
            }
        }, 100);
    }

    gerarUnicoJogo() {
        let tentativas = 0;
        // Cria um array base de 1 a 60
        const poolBase = Array.from({ length: this.config.numeroMaximo }, (_, i) => i + 1);
        
        // Cria um pool ponderado (se houver histórico, números sorteados ganham peso extra)
        let poolSorteio = [...poolBase];
        this.dadosHistoricos.forEach((freq, num) => {
            // Adiciona uma chance extra para números que já saíram (Estratégia de Tendência)
            if (freq > 0) poolSorteio.push(num); 
        });

        // Loop de Tentativa e Erro (Rejection Sampling)
        while (tentativas < this.config.maxTentativas) {
            tentativas++;
            
            // 1. Sorteia 6 números do pool ponderado
            let candidatos = this.embaralharESelecionar(poolSorteio, this.config.numerosPorJogo);
            
            // Garante unicidade e ordena
            candidatos = [...new Set(candidatos)].sort((a, b) => a - b);

            // Se removeu duplicatas e faltou número, completa com o pool base
            while (candidatos.length < this.config.numerosPorJogo) {
                const extra = poolBase[Math.floor(Math.random() * poolBase.length)];
                if (!candidatos.includes(extra)) candidatos.push(extra);
            }
            candidatos.sort((a, b) => a - b);

            // 2. Aplica os filtros estatísticos
            if (this.validarJogo(candidatos)) {
                return { numeros: candidatos };
            }
        }

        // Fallback: Se não conseguir um jogo perfeito estatisticamente, retorna um aleatório
        console.warn("[Sistema] Fallback acionado após exceder tentativas.");
        const fallback = this.embaralharESelecionar(poolBase, this.config.numerosPorJogo)
            .sort((a, b) => a - b);
        return { numeros: fallback };
    }

    validarJogo(nums) {
        // Cálculos auxiliares
        const soma = nums.reduce((a, b) => a + b, 0);
        const pares = nums.filter(n => n % 2 === 0).length;
        const impares = nums.length - pares;
        
        // Regra 1: Soma total das dezenas (intervalo de Gauss)
        if (soma < this.config.somaMinima || soma > this.config.somaMaxima) return false;

        // Regra 2: Balanceamento Par/Ímpar
        const parImparOk = this.config.combinacoesParImpar.some(c => c.pares === pares && c.impares === impares);
        if (!parImparOk) return false;

        // Regra 3: Quantidade de números Primos
        const qtdPrimos = nums.filter(n => this.primos.has(n)).length;
        if (qtdPrimos < this.config.limites.minPrimos || qtdPrimos > this.config.limites.maxPrimos) return false;

        // Regra 4: Evitar muitas sequências numéricas (ex: 1,2,3)
        for (let i = 0; i <= nums.length - 1 - this.config.limites.maxSequencia; i++) {
             let seqCount = 0;
             for(let k = 0; k < nums.length - 1; k++) {
                 if(nums[k+1] === nums[k] + 1) seqCount++;
                 else seqCount = 0;
                 if(seqCount >= this.config.limites.maxSequencia) return false;
             }
        }

        // Regra 5: Distribuição Espacial (Linhas e Quadrantes)
        const linhas = new Map();
        const quadrantes = new Map();
        
        nums.forEach(n => {
            const linha = Math.floor((n - 1) / 10) + 1;
            const coluna = ((n - 1) % 10) + 1;
            
            linhas.set(linha, (linhas.get(linha) || 0) + 1);
            
            // Lógica de Quadrantes (4 áreas do volante)
            let q = 0;
            if (linha <= 3 && coluna <= 5) q = 1;
            else if (linha <= 3 && coluna > 5) q = 2;
            else if (linha > 3 && coluna <= 5) q = 3;
            else q = 4;
            quadrantes.set(q, (quadrantes.get(q) || 0) + 1);
        });

        if (Math.max(...linhas.values()) > this.config.limites.maxPorLinha) return false;
        if (Math.max(...quadrantes.values()) > this.config.limites.maxPorQuadrante) return false;
        if (quadrantes.size < this.config.limites.minQuadrantes) return false;

        // Regra 6: Evitar repetição exata do concurso anterior
        if (this.ultimoSorteio.length > 0) {
            const repetidosDoUltimo = nums.filter(n => this.ultimoSorteio.includes(n)).length;
            if (repetidosDoUltimo > 4) return false; // Bloqueia quina ou sena repetida
        }

        return true;
    }

    embaralharESelecionar(array, quantidade) {
        // Algoritmo Fisher-Yates (Shuffle)
        const arr = [...array];
        const resultado = [];
        for (let i = 0; i < quantidade; i++) {
            const idx = Math.floor(Math.random() * arr.length);
            resultado.push(arr[idx]);
            arr.splice(idx, 1); // Garante não repetição dentro do mesmo sorteio
        }
        return resultado;
    }

    // =================================================================
    // MÉTODOS DE UI (Visualização)
    // =================================================================

    renderizarJogos(jogosLista) {
        this.ui.containerJogos.innerHTML = '';
        const fragment = document.createDocumentFragment();

        jogosLista.forEach((jogoObj, index) => {
            const div = document.createElement('div');
            div.className = 'jogo';
            div.style.animationDelay = `${index * 0.1}s`; // Animação em cascata

            // Número do Jogo
            const idxElem = document.createElement('i');
            idxElem.textContent = `${index + 1}.`;
            div.appendChild(idxElem);

            // Bolas Numeradas
            jogoObj.numeros.forEach(num => {
                const span = document.createElement('span');
                span.textContent = String(num).padStart(2, '0');
                
                // Coloração baseada em histórico (Quente/Frio)
                const freq = this.dadosHistoricos.get(num) || 0;
                if (freq > 0) {
                    span.classList.add('sorteado');
                    span.title = `Frequência histórica: ${freq} vezes`;
                } else {
                    span.classList.add('nao-sorteado');
                }
                div.appendChild(span);
            });

            fragment.appendChild(div);
        });

        this.ui.containerJogos.appendChild(fragment);
        this.mostrarNotificacao(`✅ ${jogosLista.length} palpites gerados com sucesso!`, "info");
    }

    limparTela() {
        this.ui.containerJogos.innerHTML = '<p class="empty-state">Configure acima e clique em gerar para ver as probabilidades.</p>';
        this.limparNotificacoes();
        if(this.ui.btnLimpar) this.ui.btnLimpar.classList.add('hidden');
        if(this.ui.inputQtd) {
            this.ui.inputQtd.value = 1;
            this.ui.inputQtd.focus();
        }
    }

    setLoading(isLoading) {
        if (!this.ui.btnGerar) return;
        
        this.ui.btnGerar.disabled = isLoading;
        if (isLoading) {
            this.ui.spinner?.classList.remove('hidden');
            this.ui.btnGerar.querySelector('.btn-text').textContent = "PROCESSANDO...";
        } else {
            this.ui.spinner?.classList.add('hidden');
            this.ui.btnGerar.querySelector('.btn-text').textContent = "GERAR PALPITES";
        }
    }

    mostrarNotificacao(msg, tipo) {
        if (!this.ui.avisoContainer) return;
        this.ui.avisoContainer.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
    }

    limparNotificacoes() {
        if (this.ui.avisoContainer) this.ui.avisoContainer.innerHTML = '';
    }
}

// Inicializa a aplicação assim que o navegador montar o HTML
document.addEventListener('DOMContentLoaded', () => {
    new LotteryGame();
});