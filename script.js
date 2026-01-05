/**
 * Gerador da Sorte - Mega-Sena (Luxury Edition)
 * Lógica: Unicidade Global (sem repetição entre os 3 jogos) + Filtros Estatísticos
 */

class LotteryGame {
    constructor() {
        // Cache de elementos do DOM
        this.ui = {
            form: document.getElementById('form-gerador'),
            btnGerar: document.getElementById('btn-gerar'),
            btnLimpar: document.getElementById('btn-limpar'),
            containerJogos: document.getElementById('jogos-container'),
            avisoContainer: document.getElementById('aviso-container'),
            spinner: document.querySelector('.spinner'),
            yearSpan: document.getElementById('year')
        };

        // Regras de Negócio
        this.config = {
            qtdJogosFixos: 3, // Regra de UX definida
            numerosPorJogo: 6,
            numeroMaximo: 60,
            somaMinima: 135,
            somaMaxima: 210,
            combinacoesParImpar: [
                { pares: 3, impares: 3 }, 
                { pares: 2, impares: 4 }, 
                { pares: 4, impares: 2 }
            ],
            // Limites estatísticos para evitar jogos "impossíveis"
            limites: { 
                minPrimos: 1, 
                maxPrimos: 3, 
                maxSequencia: 2 // Ex: 1,2,3 é proibido (seq > 2)
            },
            maxTentativas: 3000 // Timeout para evitar loop infinito
        };

        this.primos = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);
        
        this.init();
    }

    init() {
        this.atualizarAnoFooter();
        this.registrarEventos();
        console.log("🍀 Sistema Gerador da Sorte iniciado.");
    }

    registrarEventos() {
        // Submit do formulário (Botão Gerar)
        if (this.ui.form) {
            this.ui.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.iniciarGeracao();
            });
        }

        // Tecla Enter global
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (this.ui.btnGerar && this.ui.btnGerar.disabled) return;
                // Evita conflito se o foco estiver no botão de limpar
                if (document.activeElement === this.ui.btnLimpar) return;
                
                e.preventDefault();
                this.iniciarGeracao();
            }
        });

        // Botão Limpar
        if (this.ui.btnLimpar) {
            this.ui.btnLimpar.addEventListener('click', () => this.limparTela());
        }
    }

    atualizarAnoFooter() {
        if (this.ui.yearSpan) this.ui.yearSpan.textContent = new Date().getFullYear();
    }

    iniciarGeracao() {
        if (this.ui.btnGerar && this.ui.btnGerar.disabled) return;

        this.setLoading(true);
        this.limparNotificacoes();

        // Timeout para permitir que a UI desenhe o spinner antes de travar no cálculo
        setTimeout(() => {
            try {
                const jogosGerados = [];
                const numerosUsadosNaRodada = new Set(); // O "Pool" Global

                for (let i = 0; i < this.config.qtdJogosFixos; i++) {
                    const resultado = this.gerarUnicoJogo(numerosUsadosNaRodada);
                    
                    // Adiciona os números gerados ao pool de proibidos para os próximos jogos
                    resultado.numeros.forEach(n => numerosUsadosNaRodada.add(n));
                    
                    jogosGerados.push(resultado);
                }

                this.renderizarJogos(jogosGerados);
                
                if (this.ui.btnLimpar) this.ui.btnLimpar.classList.remove('hidden');

            } catch (erro) {
                console.error(erro);
                this.mostrarNotificacao("Não foi possível gerar combinações perfeitas. Tente novamente.", "error");
            } finally {
                this.setLoading(false);
            }
        }, 150); // Delay estético leve
    }

    /**
     * Tenta gerar um jogo que obedeça estatísticas E não repita números já usados
     */
    gerarUnicoJogo(numerosProibidosGlobalmente) {
        let tentativas = 0;
        
        // Cria pool de números disponíveis (1 a 60 menos os já usados na rodada)
        const poolDisponivel = Array.from({ length: this.config.numeroMaximo }, (_, i) => i + 1)
                                    .filter(n => !numerosProibidosGlobalmente.has(n));

        // Loop de tentativa de "Jogo Perfeito"
        while (tentativas < this.config.maxTentativas) {
            tentativas++;
            
            // Sorteia 6 números do pool disponível
            let candidatos = this.embaralharESelecionar(poolDisponivel, this.config.numerosPorJogo);
            candidatos.sort((a, b) => a - b);

            // Valida estatísticas
            if (this.validarEstatisticas(candidatos)) {
                return { 
                    numeros: candidatos, 
                    stats: this.calcularStats(candidatos) 
                };
            }
        }

        // Fallback: Se não conseguir estatística perfeita, retorna aleatório seguro (respeitando unicidade global)
        console.warn("Fallback acionado para garantir unicidade.");
        const fallback = this.embaralharESelecionar(poolDisponivel, this.config.numerosPorJogo).sort((a, b) => a - b);
        return { 
            numeros: fallback,
            stats: this.calcularStats(fallback)
        };
    }

    validarEstatisticas(nums) {
        const soma = nums.reduce((a, b) => a + b, 0);
        const pares = nums.filter(n => n % 2 === 0).length;
        const impares = 6 - pares;

        // 1. Valida Soma
        if (soma < this.config.somaMinima || soma > this.config.somaMaxima) return false;

        // 2. Valida Par/Ímpar
        const padraoParImpar = this.config.combinacoesParImpar.some(c => c.pares === pares && c.impares === impares);
        if (!padraoParImpar) return false;
        
        // 3. Valida Primos
        const qtdPrimos = nums.filter(n => this.primos.has(n)).length;
        if (qtdPrimos < this.config.limites.minPrimos || qtdPrimos > this.config.limites.maxPrimos) return false;

        // 4. Valida Sequência (Ex: 1, 2, 3)
        let maxSeq = 0;
        let atualSeq = 0;
        for (let i = 0; i < nums.length - 1; i++) {
            if (nums[i+1] === nums[i] + 1) {
                atualSeq++;
            } else {
                atualSeq = 0;
            }
            if (atualSeq > maxSeq) maxSeq = atualSeq;
        }
        if (maxSeq >= this.config.limites.maxSequencia) return false;

        return true;
    }

    calcularStats(nums) {
        return {
            soma: nums.reduce((a, b) => a + b, 0),
            pares: nums.filter(n => n % 2 === 0).length
        };
    }

    embaralharESelecionar(array, quantidade) {
        // Algoritmo Fisher-Yates simplificado para seleção
        const arr = [...array];
        const resultado = [];
        for (let i = 0; i < quantidade; i++) {
            const idx = Math.floor(Math.random() * arr.length);
            resultado.push(arr[idx]);
            arr.splice(idx, 1); // Remove para não repetir dentro do mesmo jogo
        }
        return resultado;
    }

    /**
     * Renderização compatível com CSS Luxury
     */
    renderizarJogos(jogosLista) {
        this.ui.containerJogos.innerHTML = '';
        const fragment = document.createDocumentFragment();

        jogosLista.forEach((jogoObj, index) => {
            // Cria o Container do Ticket
            const card = document.createElement('div');
            card.className = 'ticket'; // Classe CSS correta
            card.style.animationDelay = `${index * 0.15}s`; // Cascata de animação

            // Header do Ticket
            const header = document.createElement('div');
            header.className = 'ticket-header';
            header.innerHTML = `<span>PALPITE OFICIAL</span> <span>#0${index + 1}</span>`;
            
            // Grid de Números (Bolas)
            const grid = document.createElement('div');
            grid.className = 'numbers-grid'; // Grid CSS correto

            jogoObj.numeros.forEach(num => {
                const ball = document.createElement('div');
                ball.className = 'ball'; // Classe da bola 3D
                ball.textContent = String(num).padStart(2, '0');
                grid.appendChild(ball);
            });

            // Rodapé com Estatísticas
            const stats = document.createElement('div');
            stats.className = 'ticket-stats';
            stats.innerHTML = `
                <span>Soma: <strong>${jogoObj.stats.soma}</strong></span>
                <span>Pares: <strong>${jogoObj.stats.pares}</strong></span>
                <span>Ímpares: <strong>${6 - jogoObj.stats.pares}</strong></span>
            `;

            // Montagem
            card.appendChild(header);
            card.appendChild(grid);
            card.appendChild(stats);
            fragment.appendChild(card);
        });

        this.ui.containerJogos.appendChild(fragment);
    }

    limparTela() {
        // Retorna ao Empty State
        this.ui.containerJogos.innerHTML = `
            <div class="empty-state fade-in">
                <div class="empty-icon">🎲</div>
                <p>Sua sorte começa aqui!</p>
                <span>Clique em <strong>GERAR PALPITES</strong> para criar 3 jogos únicos.</span>
            </div>`;
        
        this.limparNotificacoes();
        if (this.ui.btnLimpar) this.ui.btnLimpar.classList.add('hidden');
    }

    setLoading(isLoading) {
        if (!this.ui.btnGerar) return;
        this.ui.btnGerar.disabled = isLoading;
        
        const btnText = this.ui.btnGerar.querySelector('.btn-text');
        
        if (isLoading) {
            this.ui.spinner?.classList.remove('hidden');
            if(btnText) btnText.textContent = "PROCESSANDO...";
        } else {
            this.ui.spinner?.classList.add('hidden');
            if(btnText) btnText.textContent = "GERAR PALPITES";
        }
    }

    mostrarNotificacao(msg, tipo) {
        if (this.ui.avisoContainer) {
            this.ui.avisoContainer.innerHTML = `
                <div class="alert alert-${tipo}" role="alert">
                    ${msg}
                </div>`;
        }
    }

    limparNotificacoes() {
        if (this.ui.avisoContainer) this.ui.avisoContainer.innerHTML = '';
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => new LotteryGame());