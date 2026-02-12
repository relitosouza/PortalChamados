document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const toggleRotationBtn = document.getElementById('toggleRotation');
    const rotationIndicator = document.querySelector('.rotation-indicator');
    const refreshButton = document.getElementById('refreshButton');
    const toggleScrollBtn = document.getElementById('toggleScroll');
    
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';

    const rotationOrder = ['abertos', 'andamento', 'resolvidos'];
    let currentIndex = 0;
    const rotationIntervalTime = 20000; // 5 seconds
    let rotationInterval;
    let isRotationActive = true;
    
    let allTickets = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    
    // Auto-scroll configuration
    let autoScrollInterval;
    let isAutoScrolling = false;
    let scrollPosition = 0;
    const SCROLL_SPEED = 1; // pixels por frame
    const SCROLL_PAUSE_TOP = 2000; // pausa no topo (ms)
    const SCROLL_PAUSE_BOTTOM = 3000; // pausa no fundo (ms)

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

    // Botão de refresh manual
    refreshButton.addEventListener('click', () => {
        console.log('Refresh manual acionado');
        refreshButton.classList.add('refreshing');
        
        fetchTickets();
        lastFetchTime = Date.now();
        
        // Remover classe de animação após 600ms
        setTimeout(() => {
            refreshButton.classList.remove('refreshing');
        }, 600);
    });

    // Botão de toggle auto-scroll
    toggleScrollBtn.addEventListener('click', () => {
        if (isAutoScrolling) {
            stopAutoScroll();
            toggleScrollBtn.classList.remove('active');
            toggleScrollBtn.title = 'Auto-scroll desativado';
            showToast('Auto-scroll desativado');
        } else {
            startAutoScroll();
            toggleScrollBtn.classList.add('active');
            toggleScrollBtn.title = 'Auto-scroll ativo';
            showToast('Auto-scroll ativado');
        }
    });

    function fetchTickets() {
        console.log('Fetching tickets...');

        fetch(SHEET_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(csvText => {
                if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
                    throw new Error('Received HTML instead of CSV. Check sheet permissions.');
                }

                const tickets = parseCSV(csvText);
                console.log('Parsed tickets:', tickets);
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
                
                // Iniciar auto-scroll após carregar os dados
                startAutoScroll();
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
        // Clear all containers
        document.querySelector('#abertos .cards-container').innerHTML = '';
        document.querySelector('#andamento .cards-container').innerHTML = '';
        document.querySelector('#resolvidos .cards-container').innerHTML = '';

        const filteredTickets = filterTickets(tickets);

        filteredTickets.forEach(ticket => {
            const id = ticket['Numero do Chamado'];
            const title = ticket['Titulo'];
            const description = ticket['Assunto'];
            const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
            const timestamp = ticket['Carimbo de data/hora'];
            const system = ticket['Sistema'] ? ticket['Sistema'].trim() : '';

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

            // Truncate description
            const words = description.split(/\s+/);
            const truncatedDescription = words.length > 12 ? words.slice(0, 12).join(' ') + '...' : description;

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
                <p title="${description}">${truncatedDescription}</p>
                <div class="card-footer">
                    <span>${timeDisplay}</span>
                    <a href="detalhes.html?id=${encodeURIComponent(id)}" class="btn-details">Ver Detalhes</a>
                </div>
            `;

            const container = document.querySelector(`#${targetSectionId} .cards-container`);
            if (container) {
                container.appendChild(card);
            }
        });

        // Show "no results" message if needed
        updateNoResultsMessage();
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
        let direction = 'down'; // 'down' or 'up'
        let isPaused = false;
        
        autoScrollInterval = setInterval(() => {
            if (!isAutoScrolling || isPaused || document.hidden) return;
            
            const currentSection = document.querySelector('section.active');
            if (!currentSection) return;
            
            const container = currentSection.querySelector('.cards-container');
            if (!container) return;
            
            const maxScroll = container.scrollHeight - container.clientHeight;
            
            if (maxScroll <= 0) return; // Não há conteúdo suficiente para scroll
            
            if (direction === 'down') {
                scrollPosition += SCROLL_SPEED;
                
                if (scrollPosition >= maxScroll) {
                    scrollPosition = maxScroll;
                    direction = 'up';
                    isPaused = true;
                    
                    // Pausa no fundo
                    setTimeout(() => {
                        isPaused = false;
                    }, SCROLL_PAUSE_BOTTOM);
                }
            } else {
                scrollPosition -= SCROLL_SPEED;
                
                if (scrollPosition <= 0) {
                    scrollPosition = 0;
                    direction = 'down';
                    isPaused = true;
                    
                    // Pausa no topo
                    setTimeout(() => {
                        isPaused = false;
                    }, SCROLL_PAUSE_TOP);
                }
            }
            
            window.scrollTo({
                top: scrollPosition,
                behavior: 'auto'
            });
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
            stopAutoScroll();
            
            // Retomar após 5 segundos de inatividade
            clearTimeout(userInteractionTimeout);
            userInteractionTimeout = setTimeout(() => {
                startAutoScroll();
            }, 5000);
        }, { passive: true });
    });
    
    // Pausar auto-scroll quando muda de aba
    navLinks.forEach(link => {
        const originalClickHandler = link.onclick;
        link.addEventListener('click', (e) => {
            scrollPosition = 0; // Reset scroll position ao mudar de aba
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
});
