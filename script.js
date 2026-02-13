document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const refreshButton = document.getElementById('refreshButton');
    const toggleScrollBtn = document.getElementById('toggleScroll');
    
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';
    
    let allTickets = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    let swiperInstances = {};

    const isMobile = () => window.innerWidth <= 768;

    // --- AUTO SCROLL CONFIG ---
    let autoScrollInterval, isAutoScrolling = false, scrollPosition = 0;
    const SCROLL_SPEED = 1, SCROLL_PAUSE = 3000;

    function initSwipers() {
        // Destruir instâncias anteriores
        Object.values(swiperInstances).forEach(s => s.destroy && s.destroy());

        const swiperOptions = {
            slidesPerView: 1,
            spaceBetween: 20,
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            breakpoints: {
                768: { slidesPerView: 2 },
                1200: { slidesPerView: 3 }
            }
        };

        swiperInstances.abertos = new Swiper('.abertos-swiper', swiperOptions);
        swiperInstances.andamento = new Swiper('.andamento-swiper', swiperOptions);
        swiperInstances.resolvidos = new Swiper('.resolvidos-swiper', swiperOptions);
    }

    function fetchTickets() {
        fetch(SHEET_URL)
            .then(res => res.text())
            .then(csvText => {
                allTickets = parseCSV(csvText);
                renderTickets(allTickets);
                if (!isMobile() && isAutoScrolling) startAutoScroll();
            });
    }

    function parseCSV(csvText) {
        const rows = csvText.split('\n').map(row => row.split(',').map(cell => cell.replace(/"/g, '').trim()));
        const headers = rows[0];
        return rows.slice(1).map(row => {
            let obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            obj._rawHeaders = headers; 
            return obj;
        });
    }

    function getPerson(ticket) {
        // Coluna G é índice 6
        const headerG = ticket._rawHeaders ? ticket._rawHeaders[6] : null;
        return ticket[headerG] || ticket['Solicitante'] || 'Não Informado';
    }

    function renderTickets(tickets) {
        // Limpar containers
        document.querySelectorAll('.cards-container').forEach(c => c.innerHTML = '');

        const filtered = tickets.filter(t => {
            const person = getPerson(t).toLowerCase();
            const title = (t['Titulo'] || '').toLowerCase();
            const search = currentSearchTerm.toLowerCase();
            const sys = (t['Sistema'] || '').toLowerCase();

            const sysMatch = currentFilter === 'all' || sys.includes(currentFilter);
            const searchMatch = !search || title.includes(search) || person.includes(search);
            return sysMatch && searchMatch;
        });

        filtered.forEach(t => {
            const status = (t['Status'] || '').toLowerCase();
            const person = getPerson(t);
            const descRaw = (t['Assunto'] || '').trim();
            const words = descRaw.split(/\s+/).filter(w => w.length > 0);
            const truncated = words.length > 12 ? words.slice(0, 12).join(' ') + '...' : descRaw;

            let target = '';
            if (status.includes('aberto')) target = 'abertos';
            else if (status.includes('andamento')) target = 'andamento';
            else if (status.includes('resolvido')) target = 'resolvidos';

            if (target) {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.innerHTML = `
                    <div class="card status-${target}">
                        <div class="card-header">
                            <span class="ticket-id">#${t['Numero do Chamado']}</span>
                            <span class="system-badge">${t['Sistema'] || ''}</span>
                        </div>
                        <h3>${t['Titulo']}</h3>
                        <div class="card-requester">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>${person}</span>
                        </div>
                        <p class="ticket-desc">${truncated}</p>
                        <div class="card-footer">
                            <a href="detalhes.html?id=${t['Numero do Chamado']}" class="btn-details">Ver Detalhes</a>
                        </div>
                    </div>
                `;
                document.querySelector(`#${target} .cards-container`).appendChild(slide);
            }
        });

        setTimeout(initSwipers, 100);
        updateCounts(filtered);
    }

    function updateCounts(tickets) {
        const counts = { abertos: 0, andamento: 0, resolvidos: 0 };
        tickets.forEach(t => {
            const s = (t['Status'] || '').toLowerCase();
            if (s.includes('aberto')) counts.abertos++;
            else if (s.includes('andamento')) counts.andamento++;
            else if (s.includes('resolvido')) counts.resolvidos++;
        });
        document.querySelectorAll('.badge-count').forEach(b => b.textContent = counts[b.dataset.section]);
    }

    // --- EVENTOS ---
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        renderTickets(allTickets);
    });

    toggleScrollBtn.addEventListener('click', () => {
        if (isMobile()) return alert("Auto-scroll desativado para mobile.");
        isAutoScrolling = !isAutoScrolling;
        toggleScrollBtn.classList.toggle('active', isAutoScrolling);
        isAutoScrolling ? startAutoScroll() : clearInterval(autoScrollInterval);
    });

    function startAutoScroll() {
        clearInterval(autoScrollInterval);
        autoScrollInterval = setInterval(() => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            scrollPosition = (window.scrollY >= max) ? 0 : window.scrollY + SCROLL_SPEED;
            window.scrollTo(0, scrollPosition);
        }, 30);
    }

    fetchTickets();
    setInterval(fetchTickets, 60000); // Atualiza a cada 1 min
});
