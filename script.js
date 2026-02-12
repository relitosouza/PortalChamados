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
    const rotationIntervalTime = 20000; 
    let rotationInterval;
    let isRotationActive = true;
    
    let allTickets = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    
    let autoScrollInterval;
    let isAutoScrolling = false;
    let scrollPosition = 0;
    const SCROLL_SPEED = 2; 
    const SCROLL_PAUSE_TOP = 2000; 
    const SCROLL_PAUSE_BOTTOM = 3000; 

    fetchTickets();

    let lastFetchTime = Date.now();
    const AUTO_REFRESH_INTERVAL = 10000; 

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const timeSinceLastFetch = Date.now() - lastFetchTime;
            if (timeSinceLastFetch > AUTO_REFRESH_INTERVAL) {
                fetchTickets();
                lastFetchTime = Date.now();
            }
        }
    });

    setInterval(() => {
        if (!document.hidden) {
            fetchTickets();
            lastFetchTime = Date.now();
        }
    }, 120000); 

    refreshButton.addEventListener('click', () => {
        refreshButton.classList.add('refreshing');
        fetchTickets();
        lastFetchTime = Date.now();
        setTimeout(() => {
            refreshButton.classList.remove('refreshing');
        }, 600);
    });

    toggleScrollBtn.addEventListener('click', () => {
        if (isAutoScrolling) {
            stopAutoScroll();
            toggleScrollBtn.classList.remove('active');
            showToast('Auto-scroll desativado');
        } else {
            scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
            startAutoScroll();
            toggleScrollBtn.classList.add('active');
            showToast('Auto-scroll ativado');
        }
    });

    function fetchTickets() {
        fetch(SHEET_URL)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.text();
            })
            .then(csvText => {
                const tickets = parseCSV(csvText);
                allTickets = tickets;
                renderTickets(tickets);
                updateCounts();
                if (lastFetchTime > 0) showToast('Chamados atualizados!');
                if (!rotationInterval) startRotation();
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
                if (inQuotes && nextChar === '"') { currentVal += '"'; i++; } 
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentVal);
                currentVal = '';
            } else if (char === '\n' && !inQuotes) {
                currentRow.push(currentVal);
                if (currentRow.length > 0) rows.push(currentRow);
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
        return rows.slice(1).map(values => {
            const ticket = {};
            headers.forEach((header, index) => {
                const val = values[index] !== undefined ? values[index] : '';
                ticket[header] = val.trim();
            });
            return ticket;
        });
    }

    function renderTickets(tickets) {
        document.querySelector('#abertos .cards-container').innerHTML = '';
        document.querySelector('#andamento .cards-container').innerHTML = '';
        document.querySelector('#resolvidos .cards-container').innerHTML = '';

        const filteredTickets = filterTickets(tickets);

        filteredTickets.forEach(ticket => {
            const id = ticket['Numero do Chamado'];
            const title = ticket['Titulo'];
            const description = ticket['Assunto'];
            // Tenta pegar o nome da pessoa de diferentes possíveis colunas
            const person = ticket['Nome'] || ticket['Solicitante'] || ticket['Pessoa'] || 'Não informado';
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
            } else { return; }

            const words = description.split(/\s+/);
            const truncatedDescription = words.length > 12 ? words.slice(0, 12).join(' ') + '...' : description;

            let systemClass = '';
            const systemNormalized = system.toLowerCase().trim();
            if (systemNormalized.includes('cp')) systemClass = 'system-cp';
            else if (systemNormalized.includes('am')) systemClass = 'system-am';
            else if (systemNormalized.includes('transpar')) systemClass = 'system-transparencia';

            const card = document.createElement('div');
            card.className = `card ${statusClass} visible`;
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="ticket-id">#${id}</span>
                    <span class="status-badge">${statusLabel}</span>
                    ${system ? `<span class="system-badge ${systemClass}">${system}</span>` : ''}
                </div>
                <h3>${title}</h3>
                <div class="card-requester">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>${person}</span>
                </div>
                <p title="${description}">${truncatedDescription}</p>
                <div class="card-footer">
                    <span>${timestamp || ''}</span>
                    <a href="detalhes.html?id=${encodeURIComponent(id)}" class="btn-details">Ver Detalhes</a>
                </div>
            `;

            const container = document.querySelector(`#${targetSectionId} .cards-container`);
            if (container) container.appendChild(card);
        });
        updateNoResultsMessage();
    }

    function filterTickets(tickets) {
        return tickets.filter(ticket => {
            const system = ticket['Sistema'] ? ticket['Sistema'].toLowerCase().trim() : '';
            const title = ticket['Titulo'] ? ticket['Titulo'].toLowerCase() : '';
            const description = ticket['Assunto'] ? ticket['Assunto'].toLowerCase() : '';
            const person = (ticket['Nome'] || ticket['Solicitante'] || ticket['Pessoa'] || '').toLowerCase();
            const id = ticket['Numero do Chamado'] ? ticket['Numero do Chamado'].toString() : '';

            let systemMatch = (currentFilter === 'all') || 
                             (currentFilter === 'cp' && system.includes('cp')) ||
                             (currentFilter === 'am' && system.includes('am')) ||
                             (currentFilter === 'transparencia' && system.includes('transpar'));

            const searchMatch = !currentSearchTerm || 
                title.includes(currentSearchTerm) ||
                description.includes(currentSearchTerm) ||
                person.includes(currentSearchTerm) || // Pesquisa pelo nome adicionada aqui
                id.includes(currentSearchTerm);

            return systemMatch && searchMatch;
        });
    }
// ... (mantenha a lógica de busca igual, altere apenas a displayTicket)

function displayTicket(ticket) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('detailsContent').style.display = 'block';

    const id = ticket['Numero do Chamado'];
    const title = ticket['Titulo'];
    const description = ticket['Assunto'];
    const person = ticket['Nome'] || ticket['Solicitante'] || ticket['Pessoa'] || 'Não informado';
    const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
    const timestamp = ticket['Carimbo de data/hora'];
    const system = ticket['Sistema'] ? ticket['Sistema'].trim() : '';

    // Lógica de Status (mesma que você já tinha)
    let statusClass = statusRaw.includes('aberto') ? 'aberto' : (statusRaw.includes('andamento') ? 'andamento' : 'resolvido');
    let statusLabel = statusClass === 'aberto' ? 'Aberto' : (statusClass === 'andamento' ? 'Em Andamento' : 'Resolvido');

    document.getElementById('ticketId').textContent = `#${id}`;
    document.getElementById('ticketTitle').textContent = title;
    document.getElementById('timestamp').textContent = timestamp || 'Não informado';
    document.getElementById('statusText').textContent = statusLabel;
    document.getElementById('description').textContent = description;

    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = statusLabel;
    statusBadge.className = `status-badge ${statusClass}`;

    // Adicionar o solicitante nos campos adicionais ou criar um novo card se desejar
    const additionalFields = document.getElementById('additionalFields');
    const additionalInfo = document.getElementById('additionalInfo');
    
    // Inserir o Solicitante como primeiro item das informações adicionais
    const requesterItem = document.createElement('div');
    requesterItem.className = 'info-item';
    requesterItem.innerHTML = `<label>Solicitante</label><span>${person}</span>`;
    additionalFields.appendChild(requesterItem);

    // ... (restante da sua lógica de campos dinâmicos e timeline)
    additionalInfo.style.display = 'block';
}
    function updateCounts() {
        const counts = { abertos: 0, andamento: 0, resolvidos: 0 };
        const filteredTickets = filterTickets(allTickets);
        filteredTickets.forEach(ticket => {
            const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
            if (statusRaw.includes('aberto')) counts.abertos++;
            else if (statusRaw.includes('andamento')) counts.andamento++;
            else if (statusRaw.includes('resolvido')) counts.resolvidos++;
        });
        document.querySelectorAll('.badge-count').forEach(badge => {
            badge.textContent = counts[badge.dataset.section] || 0;
        });
    }

    function updateNoResultsMessage() {
        sections.forEach(section => {
            const container = section.querySelector('.cards-container');
            const noResults = section.querySelector('.no-results');
            const hasCards = container.querySelectorAll('.card').length > 0;
            if (noResults) noResults.style.display = hasCards ? 'none' : 'block';
        });
    }

    function showError(message) {
        document.querySelectorAll('.cards-container').forEach(container => {
            container.innerHTML = `<div class="error-message">Erro ao carregar dados: ${message}</div>`;
        });
    }

    function switchTab(targetId) {
        navLinks.forEach(nav => nav.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));
        const activeLink = document.querySelector(`nav a[data-target="${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');
    }

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

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTickets(allTickets);
            updateCounts();
        });
    });

    toggleRotationBtn.addEventListener('click', () => {
        isRotationActive = !isRotationActive;
        if (isRotationActive) {
            rotationIndicator.classList.remove('paused');
            startRotation();
        } else {
            rotationIndicator.classList.add('paused');
            if (rotationInterval) clearInterval(rotationInterval);
        }
    });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            currentIndex = rotationOrder.indexOf(targetId);
            switchTab(targetId);
            if (isRotationActive) {
                if (rotationInterval) clearInterval(rotationInterval);
                rotationInterval = setInterval(rotateView, rotationIntervalTime);
            }
        });
    });

    function rotateView() {
        if (!isRotationActive) return;
        currentIndex = (currentIndex + 1) % rotationOrder.length;
        switchTab(rotationOrder[currentIndex]);
    }

    function startRotation() {
        if (!isRotationActive) return;
        if (rotationInterval) clearInterval(rotationInterval);
        rotationInterval = setInterval(rotateView, rotationIntervalTime);
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toastMessage').textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function startAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval);
        isAutoScrolling = true;
        let direction = 'down';
        let isPaused = false;
        autoScrollInterval = setInterval(() => {
            if (!isAutoScrolling || isPaused || document.hidden) return;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (maxScroll <= 100) return;
            if (direction === 'down') {
                scrollPosition += SCROLL_SPEED;
                if (scrollPosition >= maxScroll) {
                    scrollPosition = maxScroll; direction = 'up'; isPaused = true;
                    setTimeout(() => isPaused = false, SCROLL_PAUSE_BOTTOM);
                }
            } else {
                scrollPosition -= SCROLL_SPEED;
                if (scrollPosition <= 0) {
                    scrollPosition = 0; direction = 'down'; isPaused = true;
                    setTimeout(() => isPaused = false, SCROLL_PAUSE_TOP);
                }
            }
            window.scrollTo(0, scrollPosition);
        }, 16);
    }
    
    function stopAutoScroll() {
        isAutoScrolling = false;
        if (autoScrollInterval) clearInterval(autoScrollInterval);
    }
});
