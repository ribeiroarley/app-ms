/**
 * Gerador de Números para Mega-Sena
 * Integrado com UI Moderna e Lógica Estatística
 * @version 4.0
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

        // Configurações Estatísticas
        this.config = {
            numerosPorJogo: 6,
            numeroMaximo: 60,
            somaMinima: 135,
            somaMaxima: 210,
            combinacoesParImpar: [
                { pares: 3, impares: 3 }, // Equilíbrio perfeito
                { pares: 2, impares: 4 }, // Leve tendência
                { pares: 4, impares: 2 }  // Leve tendência
            ],
            limites: {
                minPrimos: 1, maxPrimos: 3,
                minQuadrantes: 3, maxPorQuadrante: 3,
                maxPorLinha: 3,
                maxSequencia: 2 // Ex: 1, 2 permitido. 1, 2, 3 proibido.
            },
            maxTentativas: 5000 // Evita loop infinito
        };

        // Estado da Aplicação
        this.dadosHistoricos = new Map(); // Mapa de frequência
        this.ultimoSorteio = [];
        this.primos = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);

        this.init();
    }

    // =================================================================
    // INICIALIZAÇÃO E EVENTOS
    // =================================================================
    async init() {
        this.atualizarAnoFooter();
        this.registrarEventos();
        
        // Carrega dados silenciosamente ao iniciar
        await this.carregarDadosHistoricos();
    }

    registrarEventos() {
        // Submit do formulário
        if (this.ui.form) {
            this.ui.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.iniciarGeracao();
            });
        }

        // Botão Limpar
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
            // Tenta carregar o JSON local. 
            // OBS: Certifique-se de ter a pasta 'data/sorteios_mega_sena.json' ou ajuste o caminho.
            const response = await fetch('./data/sorteios_mega_sena.json');
            
            if (!response.ok) throw new Error('Arquivo de dados não encontrado.');
            
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                // Processa frequências
                data.forEach(sorteio => {
                    sorteio.forEach(num => {
                        const count = this.dadosHistoricos.get(num) || 0;
                        this.dadosHistoricos.set(num, count + 1);
                    });
                });
                
                // Salva o último sorteio para validação de repetição
                this.ultimoSorteio = data[data.length - 1];
                console.log(`Base carregada: ${data.length} concursos processados.`);
            }
        } catch (error) {
            console.warn("Rodando sem dados históricos (Modo Offline/Fallback).", error);
            // Não bloqueamos o app, ele funcionará com frequências zeradas (aleatório puro)
        }
    }

    // =================================================================
    // CORE: GERAÇÃO E VALIDAÇÃO
    // =================================================================
    
    iniciarGeracao() {
        this.setLoading(true);
        this.limparNotificacoes();

        // Pequeno delay para permitir que a UI desenhe o spinner
        setTimeout(() => {
            try {
                const qtd = parseInt(this.ui.inputQtd.value) || 1;
                const jogos = [];

                for (let i = 0; i < qtd; i++) {
                    jogos.push(this.gerarUnicoJogo());
                }

                this.renderizarJogos(jogos);
                
                // Mostra botão limpar se houver jogos
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
        // Pool base 1 a 60
        const poolBase = Array.from({ length: this.config.numeroMaximo }, (_, i) => i + 1);
        
        // Criar pool ponderado (números quentes aparecem mais vezes no array de sorteio)
        // Se não houver dados históricos, o peso é igual para todos.
        let poolSorteio = [...poolBase];
        this.dadosHistoricos.forEach((freq, num) => {
            // Adiciona "fichas" extras baseadas na frequência (lógica simplificada)
            // Se saiu muito, tem peso maior. (Estratégia de tendência)
            if (freq > 0) poolSorteio.push(num); 
        });

        while (tentativas < this.config.maxTentativas) {
            tentativas++;
            
            // 1. Sorteia 6 números do pool ponderado
            let candidatos = this.embaralharESelecionar(poolSorteio, this.config.numerosPorJogo);
            
            // Garante unicidade e ordena
            candidatos = [...new Set(candidatos)].sort((a, b) => a - b);

            // Se o set removeu duplicatas e ficou com menos de 6, completa com aleatórios do base
            while (candidatos.length < this.config.numerosPorJogo) {
                const extra = poolBase[Math.floor(Math.random() * poolBase.length)];
                if (!candidatos.includes(extra)) candidatos.push(extra);
            }
            candidatos.sort((a, b) => a - b);

            // 2. Valida estatisticamente
            if (this.validarJogo(candidatos)) {
                return { numeros: candidatos, metodo: "Estatístico", tentativas };
            }
        }

        // Fallback: Se não conseguir cumprir regras restritas, retorna um jogo aleatório simples
        console.warn("Fallback acionado para um jogo.");
        const fallback = this.embaralharESelecionar(poolBase, this.config.numerosPorJogo)
            .sort((a, b) => a - b);
        return { numeros: fallback, metodo: "Aleatório (Fallback)", tentativas };
    }

    validarJogo(nums) {
        // Helpers matemáticos
        const soma = nums.reduce((a, b) => a + b, 0);
        const pares = nums.filter(n => n % 2 === 0).length;
        const impares = nums.length - pares;
        
        // Regras
        // 1. Soma
        if (soma < this.config.somaMinima || soma > this.config.somaMaxima) return false;

        // 2. Par/Ímpar
        const parImparOk = this.config.combinacoesParImpar.some(c => c.pares === pares && c.impares === impares);
        if (!parImparOk) return false;

        // 3. Primos
        const qtdPrimos = nums.filter(n => this.primos.has(n)).length;
        if (qtdPrimos < this.config.limites.minPrimos || qtdPrimos > this.config.limites.maxPrimos) return false;

        // 4. Sequências (ex: 1,2,3)
        for (let i = 0; i <= nums.length - 1 - this.config.limites.maxSequencia; i++) {
             // Checa se existe sequencia maior que o permitido
             let seqCount = 0;
             for(let k = 0; k < nums.length - 1; k++) {
                 if(nums[k+1] === nums[k] + 1) seqCount++;
                 else seqCount = 0;
                 if(seqCount >= this.config.limites.maxSequencia) return false;
             }
        }

        // 5. Distribuição de Linhas e Colunas
        const linhas = new Map();
        const quadrantes = new Map();
        
        nums.forEach(n => {
            const linha = Math.floor((n - 1) / 10) + 1;
            const coluna = ((n - 1) % 10) + 1;
            
            linhas.set(linha, (linhas.get(linha) || 0) + 1);
            
            // Quadrantes
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

        // 6. Evitar repetição exata do último sorteio (se houver dados)
        if (this.ultimoSorteio.length > 0) {
            const repetidosDoUltimo = nums.filter(n => this.ultimoSorteio.includes(n)).length;
            if (repetidosDoUltimo > 4) return false; // Muito raro repetir 5 ou 6 números do concurso anterior
        }

        return true;
    }

    embaralharESelecionar(array, quantidade) {
        // Algoritmo Fisher-Yates simplificado para pegar N itens
        const arr = [...array];
        const resultado = [];
        for (let i = 0; i < quantidade; i++) {
            const idx = Math.floor(Math.random() * arr.length);
            resultado.push(arr[idx]);
            arr.splice(idx, 1); // Remove para não repetir no mesmo jogo
        }
        return resultado;
    }

    // =================================================================
    // UI HELPER METHODS
    // =================================================================

    renderizarJogos(jogosLista) {
        // Limpa o estado "vazio"
        this.ui.containerJogos.innerHTML = '';

        const fragment = document.createDocumentFragment();

        jogosLista.forEach((jogoObj, index) => {
            const div = document.createElement('div');
            div.className = 'jogo';
            div.style.animationDelay = `${index * 0.1}s`; // Efeito cascata

            // Índice
            const idxElem = document.createElement('i');
            idxElem.textContent = `${index + 1}.`;
            div.appendChild(idxElem);

            // Bolas
            jogoObj.numeros.forEach(num => {
                const span = document.createElement('span');
                span.textContent = String(num).padStart(2, '0');
                
                // Define cor baseada se é quente (sorteado) ou frio (nunca sorteado/sem dados)
                const freq = this.dadosHistoricos.get(num) || 0;
                if (freq > 0) {
                    span.classList.add('sorteado');
                    span.title = `Frequência histórica: ${freq}`;
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
        if(this.ui.inputQtd) this.ui.inputQtd.value = 1;
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

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new LotteryGame();
});