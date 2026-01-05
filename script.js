/**
 * Gerador de Números para Mega-Sena
 * Integrado com UI Moderna e Lógica Estatística
 * @version 4.3
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
                { pares: 3, impares: 3 }, // Equilíbrio perfeito
                { pares: 2, impares: 4 }, // Leve tendência
                { pares: 4, impares: 2 }  // Leve tendência
            ],
            limites: {
                minPrimos: 1, maxPrimos: 3,
                minQuadrantes: 3, maxPorQuadrante: 3,
                maxPorLinha: 3,
                maxSequencia: 2 // Ex: permite 1,2 mas bloqueia 1,2,3
            },
            maxTentativas: 5000 // Segurança contra loops
        };

        // Estado da Aplicação
        this.dadosHistoricos = new Map(); 
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
        
        // UX: Foca no input ao carregar para o usuário digitar direto
        if(this.ui.inputQtd) this.ui.inputQtd.focus();

        // Carrega dados em segundo plano
        await this.carregarDadosHistoricos();
    }

    registrarEventos() {
        // 1. Submit Padrão (Clique no botão ou Enter com foco no input)
        if (this.ui.form) {
            this.ui.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.iniciarGeracao();
            });
        }

        // 2. ENTER GLOBAL (Correção Definitiva)
        // Captura o Enter mesmo se o usuário clicou fora do input
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Se estiver processando, ignora
                if (this.ui.btnGerar && this.ui.btnGerar.disabled) return;

                // Se o foco estiver no botão limpar, deixa o limpar funcionar
                if (document.activeElement === this.ui.btnLimpar) return;

                // Se o foco NÃO estiver no input nem no botão gerar, forçamos o envio
                if (document.activeElement !== this.ui.inputQtd && document.activeElement !== this.ui.btnGerar) {
                    e.preventDefault();
                    this.iniciarGeracao();
                }
            }
        });

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
            const response = await fetch('./data/sorteios_mega_sena.json');
            
            if (!response.ok) throw new Error('Arquivo de dados não encontrado.');
            
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                data.forEach(sorteio => {
                    sorteio.forEach(num => {
                        const count = this.dadosHistoricos.get(num) || 0;
                        this.dadosHistoricos.set(num, count + 1);
                    });
                });
                
                this.ultimoSorteio = data[data.length - 1];
                console.log(`[Sistema] Base carregada: ${data.length} concursos processados.`);
            }
        } catch (error) {
            console.warn("[Sistema] Modo Offline (Sem histórico).", error);
        }
    }

    // =================================================================
    // CORE: GERAÇÃO E VALIDAÇÃO
    // =================================================================
    
    iniciarGeracao() {
        // Prevenção extra contra múltiplos cliques
        if (this.ui.btnGerar && this.ui.btnGerar.disabled) return;

        this.setLoading(true);
        this.limparNotificacoes();

        // Delay para renderizar o spinner na UI
        setTimeout(() => {
            try {
                const qtd = parseInt(this.ui.inputQtd.value) || 1;
                const jogos = [];

                for (let i = 0; i < qtd; i++) {
                    jogos.push(this.gerarUnicoJogo());
                }

                this.renderizarJogos(jogos);
                
                if(this.ui.btnLimpar) this.ui.btnLimpar.classList.remove('hidden');

            } catch (erro) {
                this.mostrarNotificacao("Erro: " + erro.message, "erro");
            } finally {
                this.setLoading(false);
                // Retorna foco para o input em Desktop para facilitar nova geração
                if (window.innerWidth > 768 && this.ui.inputQtd) {
                    this.ui.inputQtd.focus();
                }
            }
        }, 100);
    }

    gerarUnicoJogo() {
        let tentativas = 0;
        const poolBase = Array.from({ length: this.config.numeroMaximo }, (_, i) => i + 1);
        
        let poolSorteio = [...poolBase];
        this.dadosHistoricos.forEach((freq, num) => {
            if (freq > 0) poolSorteio.push(num); 
        });

        while (tentativas < this.config.maxTentativas) {
            tentativas++;
            
            let candidatos = this.embaralharESelecionar(poolSorteio, this.config.numerosPorJogo);
            candidatos = [...new Set(candidatos)].sort((a, b) => a - b);

            while (candidatos.length < this.config.numerosPorJogo) {
                const extra = poolBase[Math.floor(Math.random() * poolBase.length)];
                if (!candidatos.includes(extra)) candidatos.push(extra);
            }
            candidatos.sort((a, b) => a - b);

            if (this.validarJogo(candidatos)) {
                return { numeros: candidatos };
            }
        }

        console.warn("[Sistema] Fallback acionado.");
        const fallback = this.embaralharESelecionar(poolBase, this.config.numerosPorJogo)
            .sort((a, b) => a - b);
        return { numeros: fallback };
    }

    validarJogo(nums) {
        const soma = nums.reduce((a, b) => a + b, 0);
        const pares = nums.filter(n => n % 2 === 0).length;
        const impares = nums.length - pares;
        
        if (soma < this.config.somaMinima || soma > this.config.somaMaxima) return false;

        const parImparOk = this.config.combinacoesParImpar.some(c => c.pares === pares && c.impares === impares);
        if (!parImparOk) return false;

        const qtdPrimos = nums.filter(n => this.primos.has(n)).length;
        if (qtdPrimos < this.config.limites.minPrimos || qtdPrimos > this.config.limites.maxPrimos) return false;

        for (let i = 0; i <= nums.length - 1 - this.config.limites.maxSequencia; i++) {
             let seqCount = 0;
             for(let k = 0; k < nums.length - 1; k++) {
                 if(nums[k+1] === nums[k] + 1) seqCount++;
                 else seqCount = 0;
                 if(seqCount >= this.config.limites.maxSequencia) return false;
             }
        }

        const linhas = new Map();
        const quadrantes = new Map();
        
        nums.forEach(n => {
            const linha = Math.floor((n - 1) / 10) + 1;
            const coluna = ((n - 1) % 10) + 1;
            
            linhas.set(linha, (linhas.get(linha) || 0) + 1);
            
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

        if (this.ultimoSorteio.length > 0) {
            const repetidosDoUltimo = nums.filter(n => this.ultimoSorteio.includes(n)).length;
            if (repetidosDoUltimo > 4) return false;
        }

        return true;
    }

    embaralharESelecionar(array, quantidade) {
        const arr = [...array];
        const resultado = [];
        for (let i = 0; i < quantidade; i++) {
            const idx = Math.floor(Math.random() * arr.length);
            resultado.push(arr[idx]);
            arr.splice(idx, 1); 
        }
        return resultado;
    }

    // =================================================================
    // UI HELPER METHODS
    // =================================================================

    renderizarJogos(jogosLista) {
        this.ui.containerJogos.innerHTML = '';
        const fragment = document.createDocumentFragment();

        jogosLista.forEach((jogoObj, index) => {
            const div = document.createElement('div');
            div.className = 'jogo';
            div.style.animationDelay = `${index * 0.1}s`;

            const idxElem = document.createElement('i');
            idxElem.textContent = `${index + 1}.`;
            div.appendChild(idxElem);

            jogoObj.numeros.forEach(num => {
                const span = document.createElement('span');
                span.textContent = String(num).padStart(2, '0');
                
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

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new LotteryGame();
});