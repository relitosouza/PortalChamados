document.addEventListener('DOMContentLoaded', () => {
    // Detectar se é dispositivo móvel (PRIMEIRO)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const toggleRotationBtn = document.getElementById('toggleRotation');
    const rotationIndicator = document.querySelector('.rotation-indicator');
    
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';

    const rotationOrder = ['abertos', 'andamento', 'resolvidos'];
    let currentIndex = 0;
    const rotationIntervalTime = 5000; // 5 seconds
    let rotationInterval;
    let isRotationActive = true;
    
    let allTickets = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    
    // Auto-scroll configuration (apenas para desktop)
    let autoScrollInterval;
    let isAutoScrolling = false;
    let scrollPosition = 0;
    const SCROLL_SPEED = 2; // pixels por frame (aumentado para ser mais visível)
    const SCROLL_PAUSE_TOP = 2000; // pausa no topo (ms)
    const SCROLL_PAUSE_BOTTOM = 3000; // pausa no fundo (ms)
    
    // Swiper instances
    let swiperInstances = {};

    // Fetch and Render Tickets
    fetchTickets();

    // Auto-refresh quando a página voltar ao foco (usuário voltou da página de detalhes)
    let lastFetchTime = Date.now();
    const AUTO_REFRESH_INTERVAL = 10000; // 10 segundos de intervalo mínimo entre refreshes

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Página voltou ao foco
            const timeSinceLastFetch = Date.now() - lastFetchTime;
            
            if (timeSinceLastFetch > AUTO_REFRESH_INTERVAL) {
                console.log('Página voltou ao foco - atualizando chamados...');
                fetchTickets();
                lastFetchTime = Date.now();
            }
        }
    });

    // Refresh periódico a cada 2 minutos (enquanto a página estiver visível)
    setInterval(() => {
        if (!document.hidden) {
            console.log('Refresh automático - atualizando chamados...');
            fetchTickets();
            lastFetchTime = Date.now();
        }
    }, 120000); // 2 minutos

    function fetchTickets() {
        console.log('Fetching tickets...');
        console.log('isMobile:', isMobile);
        console.log('SHEET_URL:', SHEET_URL);

        fetch(SHEET_URL)
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(csvText => {
                console.log('CSV received, length:', csvText.length);
                if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
                    throw new Error('Received HTML instead of CSV. Check sheet permissions.');
                }

                const tickets = parseCSV(csvText);
                console.log('Parsed tickets:', tickets.length, 'tickets');
                console.log('First ticket:', tickets[0]);
                allTickets = tickets;
                renderTickets(tickets);
                updateCounts();
                
                // Mostrar toast apenas se não for o primeiro carregamento
                if (lastFetchTime > 0) {
                    showToast('Chamados atualizados!');
                }
                
                if (!rotationInterval) {
                    startRotation();
                }
                
                // Iniciar auto-scroll após carregar os dados (apenas desktop)
                if (!isMobile) {
                    startAutoScroll();
                }
            })
            .catch(error => {
                console.error('Error fetching tickets:', error);
                showError(error.message);
            });
    }

    function parseCSV(csvText) {
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let inQuotes = false;

        const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentVal);
                currentVal = '';
            } else if (char === '\n' && !inQuotes) {
                currentRow.push(currentVal);
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentVal = '';
            } else {
                currentVal += char;
            }
        }

        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal);
            rows.push(currentRow);
        }

        if (rows.length === 0) return [];

        const headers = rows[0].map(h => h.trim());
        const data = rows.slice(1).map(values => {
            const ticket = {};
            headers.forEach((header, index) => {
                const val = values[index] !== undefined ? values[index] : '';
                ticket[header] = val.trim();
            });
            return ticket;
        });

        return data;
    }

    function renderTickets(tickets) {
        console.log('renderTickets called with', tickets.length, 'tickets');
        
        // Clear all containers
        document.querySelector('#abertos .cards-container').innerHTML = '';
        document.querySelector('#andamento .cards-container').innerHTML = '';
        document.querySelector('#resolvidos .cards-container').innerHTML = '';

        const filteredTickets = filterTickets(tickets);
        console.log('Filtered tickets:', filteredTickets.length);

        filteredTickets.forEach(ticket => {
            const id = ticket['Numero do Chamado'];
            const title = ticket['Titulo'];
            const description = ticket['Assunto'];
            const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
            const timestamp = ticket['Carimbo de data/hora'];
            const system = ticket['Sistema'] ? ticket['Sistema'].trim() : '';
            
            // Tentar pegar solicitante de várias formas possíveis
            // Testa variações comuns do nome da coluna
            const possibleRequesterKeys = [
                'Solicitante',
                'solicitante', 
                'SOLICITANTE',
                'Nome do Solicitante',
                'Nome Solicitante',
                'Solicitado por',
                'Criado por',
                'Usuário',
                'Usuario',
                'Nome'
            ];
            
            let requester = 'Não informado';
            
            // Procura a primeira coluna que existe e tem valor
            for (const key of possibleRequesterKeys) {
                if (ticket[key] && ticket[key].trim()) {
                    requester = ticket[key].trim();
                    break;
                }
            }
            
            // Se ainda não encontrou, tenta buscar por coluna que contenha "solicit" ou "nome"
            if (requester === 'Não informado') {
                const keys = Object.keys(ticket);
                for (const key of keys) {
                    const lowerKey = key.toLowerCase();
                    if ((lowerKey.includes('solicit') || lowerKey.includes('nome') || lowerKey.includes('criado') || lowerKey.includes('usuario') || lowerKey.includes('usuário')) 
                        && ticket[key] && ticket[key].trim() && ticket[key].trim() !== '') {
                        requester = ticket[key].trim();
                        console.log(`Campo solicitante encontrado na coluna: "${key}" = "${requester}"`);
                        break;
                    }
                }
            }
            
            // Log para debug - mostrar todos os campos do primeiro ticket
            if (filteredTickets.indexOf(ticket) === 0) {
                console.log('=== DEBUG SOLICITANTE ===');
                console.log('Todas as colunas disponíveis:', Object.keys(ticket));
                console.log('Ticket completo:', ticket);
                console.log('Solicitante selecionado:', requester);
                console.log('========================');
            }

            let targetSectionId = '';
            let statusClass = '';
            let statusLabel = '';

            if (statusRaw.includes('aberto')) {
                targetSectionId = 'abertos';
                statusClass = 'status-aberto';
                statusLabel = 'Aberto';
            } else if (statusRaw.includes('andamento') || statusRaw.includes('em andamento')) {
                targetSectionId = 'andamento';
                statusClass = 'status-andamento';
                statusLabel = 'Em Andamento';
            } else if (statusRaw.includes('resolvido')) {
                targetSectionId = 'resolvidos';
                statusClass = 'status-resolvido';
                statusLabel = 'Resolvido';
            } else {
                return;
            }

            // Truncate description - melhorado para garantir exatamente 12 palavras
            const words = description
                .trim()                           // Remove espaços do início e fim
                .replace(/\s+/g, ' ')            // Substitui múltiplos espaços por um único
                .split(' ')                       // Divide em palavras
                .filter(word => word.length > 0); // Remove strings vazias
            
            const truncatedDescription = words.length > 12 
                ? words.slice(0, 12).join(' ') + '...' 
                : description.trim();
            
            // Debug: log se descrição foi truncada
            if (words.length > 12) {
                console.log(`Descrição truncada: ${words.length} palavras -> 12 palavras (ID: ${id})`);
            }

            // System Badge Class - normalized comparison
            let systemClass = '';
            const systemNormalized = system.toLowerCase().trim();
            if (systemNormalized === 'cp' || systemNormalized.includes('cp')) {
                systemClass = 'system-cp';
            } else if (systemNormalized === 'am' || systemNormalized.includes('am')) {
                systemClass = 'system-am';
            } else if (systemNormalized.includes('transparencia') || systemNormalized.includes('transparência')) {
                systemClass = 'system-transparencia';
            }

            const card = document.createElement('div');
            card.className = `card ${statusClass} visible`;
            card.dataset.id = id;
            card.dataset.system = system ? system.toLowerCase().trim() : '';
            card.dataset.title = title.toLowerCase();
            card.dataset.description = description.toLowerCase();

            const timeDisplay = timestamp ? `Aberto em: ${timestamp}` : '';

            card.innerHTML = `
                <div class="card-header">
                    <span class="ticket-id">#${id}</span>
                    <span class="status-badge">${statusLabel}</span>
                    ${system ? `<span class="system-badge ${systemClass}">${system}</span>` : ''}
                </div>
                <h3>${title}</h3>
                <div class="card-requester">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor"/>
                        <path d="M8 10C4.13401 10 1 11.567 1 13.5V16H15V13.5C15 11.567 11.866 10 8 10Z" fill="currentColor"/>
                    </svg>
                    <span>${requester}</span>
                </div>
                <p title="${description}">${truncatedDescription}</p>
                <div class="card-footer">
                    <span>${timeDisplay}</span>
                    <a href="detalhes.html?id=${encodeURIComponent(id)}" class="btn-details">Ver Detalhes</a>
                </div>
            `;

            const container = document.querySelector(`#${targetSectionId} .cards-container`);
            if (container) {
                container.appendChild(card);
            } else {
                console.error('Container not found for section:', targetSectionId);
            }
        });

        console.log('Cards renderizados. Verificando conversão para Swiper...');
        console.log('Total de cards em #abertos:', document.querySelectorAll('#abertos .card').length);
        console.log('Total de cards em #andamento:', document.querySelectorAll('#andamento .card').length);
        console.log('Total de cards em #resolvidos:', document.querySelectorAll('#resolvidos .card').length);

        // Show "no results" message if needed
        updateNoResultsMessage();
        
        // Converter para Swiper apenas no desktop
        if (!isMobile) {
            console.log('Desktop detectado - convertendo para Swiper...');
            convertToSwiper();
        } else {
            console.log('Mobile detectado - mantendo grid normal');
        }
    }

    // Converter containers para Swiper
    function convertToSwiper() {
        ['abertos', 'andamento', 'resolvidos'].forEach(sectionId => {
            const section = document.getElementById(sectionId);
            const container = section.querySelector('.cards-container');
            const cards = Array.from(container.querySelectorAll('.card'));
            
            if (cards.length === 0) return;
            
            // Criar estrutura Swiper
            const swiperWrapper = document.createElement('div');
            swiperWrapper.className = 'swiper cards-swiper';
            
            const swiperContainer = document.createElement('div');
            swiperContainer.className = 'swiper-wrapper';
            
            // Mover cards para swiper-wrapper e adicionar classe swiper-slide
            cards.forEach(card => {
                card.classList.add('swiper-slide');
                swiperContainer.appendChild(card);
            });
            
            swiperWrapper.appendChild(swiperContainer);
            
            // Adicionar navegação
            const nextBtn = document.createElement('div');
            nextBtn.className = 'swiper-button-next';
            const prevBtn = document.createElement('div');
            prevBtn.className = 'swiper-button-prev';
            const pagination = document.createElement('div');
            pagination.className = 'swiper-pagination';
            
            swiperWrapper.appendChild(nextBtn);
            swiperWrapper.appendChild(prevBtn);
            swiperWrapper.appendChild(pagination);
            
            // Substituir container original
            container.parentNode.replaceChild(swiperWrapper, container);
        });
        
        // Inicializar Swipers
        setTimeout(() => {
            initSwipers();
        }, 100);
    }

    // Inicializar Swipers
    function initSwipers() {
        // Destruir swipers existentes
        Object.values(swiperInstances).forEach(swiper => {
            if (swiper) swiper.destroy(true, true);
        });
        swiperInstances = {};
        
        // Criar Swiper para cada seção
        ['abertos', 'andamento', 'resolvidos'].forEach(sectionId => {
            const swiperEl = document.querySelector(`#${sectionId} .cards-swiper`);
            if (swiperEl) {
                swiperInstances[sectionId] = new Swiper(swiperEl, {
                    slidesPerView: 1,
                    spaceBetween: 24,
                    navigation: {
                        nextEl: `#${sectionId} .swiper-button-next`,
                        prevEl: `#${sectionId} .swiper-button-prev`,
                    },
                    pagination: {
                        el: `#${sectionId} .swiper-pagination`,
                        clickable: true,
                        dynamicBullets: true,
                    },
                    breakpoints: {
                        640: {
                            slidesPerView: 1,
                            spaceBetween: 20,
                        },
                        768: {
                            slidesPerView: 2,
                            spaceBetween: 24,
                        },
                        1024: {
                            slidesPerView: 3,
                            spaceBetween: 24,
                        },
                    },
                    autoplay: {
                        delay: 3000,
                        disableOnInteraction: false,
                        pauseOnMouseEnter: true,
                    },
                    loop: false,
                    grabCursor: true,
                    keyboard: {
                        enabled: true,
                    },
                    mousewheel: {
                        forceToAxis: true,
                    },
                });
            }
        });
    }

    function filterTickets(tickets) {
        return tickets.filter(ticket => {
            const system = ticket['Sistema'] ? ticket['Sistema'].toLowerCase().trim() : '';
            const title = ticket['Titulo'] ? ticket['Titulo'].toLowerCase() : '';
            const description = ticket['Assunto'] ? ticket['Assunto'].toLowerCase() : '';
            const id = ticket['Numero do Chamado'] ? ticket['Numero do Chamado'].toString() : '';

            // Filter by system - more flexible matching
            let systemMatch = false;
            if (currentFilter === 'all') {
                systemMatch = true;
            } else if (currentFilter === 'cp') {
                systemMatch = system === 'cp' || system.includes('cp');
            } else if (currentFilter === 'am') {
                systemMatch = system === 'am' || system.includes('am');
            } else if (currentFilter === 'transparencia') {
                systemMatch = system.includes('transparencia') || system.includes('transparência');
            }

            // Filter by search term
            const searchMatch = !currentSearchTerm || 
                title.includes(currentSearchTerm) ||
                description.includes(currentSearchTerm) ||
                id.includes(currentSearchTerm);

            return systemMatch && searchMatch;
        });
    }

    function updateCounts() {
        const counts = {
            abertos: 0,
            andamento: 0,
            resolvidos: 0
        };

        const filteredTickets = filterTickets(allTickets);

        filteredTickets.forEach(ticket => {
            const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
            if (statusRaw.includes('aberto')) counts.abertos++;
            else if (statusRaw.includes('andamento') || statusRaw.includes('em andamento')) counts.andamento++;
            else if (statusRaw.includes('resolvido')) counts.resolvidos++;
        });

        document.querySelectorAll('.badge-count').forEach(badge => {
            const section = badge.dataset.section;
            badge.textContent = counts[section] || 0;
        });
    }

    function updateNoResultsMessage() {
        sections.forEach(section => {
            const container = section.querySelector('.cards-container');
            const noResults = section.querySelector('.no-results');
            const hasCards = container.querySelectorAll('.card').length > 0;
            
            if (noResults) {
                noResults.style.display = hasCards ? 'none' : 'block';
            }
        });
    }

    function showError(message) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.cssText = 'color: #dc2626; text-align: center; padding: 40px; background: #fef2f2; border-radius: 12px; border: 2px solid #fecaca;';
        errorMsg.innerHTML = `
            <p style="font-weight: 600; margin-bottom: 8px;">Erro ao carregar dados: ${message}</p>
            <p style="font-size: 0.9rem;">Verifique se a planilha está publicada na web.</p>
        `;

        document.querySelectorAll('.cards-container').forEach(container => {
            container.innerHTML = '';
            container.appendChild(errorMsg.cloneNode(true));
        });
    }

    function switchTab(targetId) {
        navLinks.forEach(nav => nav.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));

        const activeLink = document.querySelector(`nav a[data-target="${targetId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase().trim();
        renderTickets(allTickets);
        updateCounts();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchTerm = '';
        renderTickets(allTickets);
        updateCounts();
    });

    // Filter functionality
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.dataset.filter;
            console.log('Filter changed to:', currentFilter);
            console.log('Available systems in data:', [...new Set(allTickets.map(t => t['Sistema']))]);
            renderTickets(allTickets);
            updateCounts();
        });
    });

    // Rotation control
    toggleRotationBtn.addEventListener('click', () => {
        isRotationActive = !isRotationActive;
        
        if (isRotationActive) {
            toggleRotationBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="2" y="2" width="3" height="8"/>
                    <rect x="7" y="2" width="3" height="8"/>
                </svg>
            `;
            toggleRotationBtn.setAttribute('aria-label', 'Pausar rotação');
            rotationIndicator.classList.remove('paused');
            rotationIndicator.querySelector('span').textContent = 'Rotação automática ativa';
            startRotation();
        } else {
            toggleRotationBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <polygon points="3,2 3,10 10,6"/>
                </svg>
            `;
            toggleRotationBtn.setAttribute('aria-label', 'Retomar rotação');
            rotationIndicator.classList.add('paused');
            rotationIndicator.querySelector('span').textContent = 'Rotação pausada';
            if (rotationInterval) clearInterval(rotationInterval);
        }
    });

    // Manual click handling
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            currentIndex = rotationOrder.indexOf(targetId);
            switchTab(targetId);

            // Reset interval on manual click
            if (isRotationActive) {
                if (rotationInterval) clearInterval(rotationInterval);
                rotationInterval = setInterval(rotateView, rotationIntervalTime);
            }
        });
    });

    // Auto rotation
    function rotateView() {
        if (!isRotationActive) return;
        currentIndex = (currentIndex + 1) % rotationOrder.length;
        const nextId = rotationOrder[currentIndex];
        switchTab(nextId);
    }

    function startRotation() {
        if (!isRotationActive) return;
        if (rotationInterval) clearInterval(rotationInterval);
        rotationInterval = setInterval(rotateView, rotationIntervalTime);
    }

    // Função para mostrar toast de notificação
    function showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Auto-scroll functions
    function startAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
        }
        
        isAutoScrolling = true;
        scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        let direction = 'down';
        let isPaused = false;
        
        console.log('Auto-scroll iniciado. Posição inicial:', scrollPosition);
        
        autoScrollInterval = setInterval(() => {
            if (!isAutoScrolling || isPaused || document.hidden) return;
            
            // Calcular altura máxima de scroll
            const documentHeight = Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
            const windowHeight = window.innerHeight;
            const maxScroll = documentHeight - windowHeight;
            
            if (maxScroll <= 100) {
                console.log('Conteúdo insuficiente para scroll. Max:', maxScroll);
                return;
            }
            
            if (direction === 'down') {
                scrollPosition += SCROLL_SPEED;
                
                if (scrollPosition >= maxScroll) {
                    scrollPosition = maxScroll;
                    direction = 'up';
                    isPaused = true;
                    console.log('Chegou ao fundo, pausando...');
                    
                    // Pausa no fundo
                    setTimeout(() => {
                        isPaused = false;
                        console.log('Retomando scroll para cima');
                    }, SCROLL_PAUSE_BOTTOM);
                }
            } else {
                scrollPosition -= SCROLL_SPEED;
                
                if (scrollPosition <= 0) {
                    scrollPosition = 0;
                    direction = 'down';
                    isPaused = true;
                    console.log('Chegou ao topo, pausando...');
                    
                    // Pausa no topo
                    setTimeout(() => {
                        isPaused = false;
                        console.log('Retomando scroll para baixo');
                    }, SCROLL_PAUSE_TOP);
                }
            }
            
            window.scrollTo(0, scrollPosition);
        }, 16); // ~60fps
    }
    
    function stopAutoScroll() {
        isAutoScrolling = false;
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
        }
    }
    
    // Pausar auto-scroll quando usuário interage
    let userInteractionTimeout;
    
    ['mousedown', 'wheel', 'touchstart', 'keydown'].forEach(event => {
        document.addEventListener(event, () => {
            if (isAutoScrolling) {
                stopAutoScroll();
                
                // Retomar após 5 segundos de inatividade
                clearTimeout(userInteractionTimeout);
                userInteractionTimeout = setTimeout(() => {
                    // Resetar posição para posição atual da janela
                    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                    startAutoScroll();
                }, 5000);
            }
        }, { passive: true });
    });
    
    // Pausar auto-scroll quando muda de aba
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Reset scroll position ao mudar de aba
            setTimeout(() => {
                scrollPosition = 0;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (isAutoScrolling) {
                    setTimeout(() => {
                        startAutoScroll();
                    }, 500);
                }
            }, 100);
        });
    });
});
