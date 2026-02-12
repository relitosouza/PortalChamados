document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/export?format=csv&gid=330906161';

    // Order of rotation: Abertos -> Andamento -> Resolvidos
    const rotationOrder = ['abertos', 'andamento', 'resolvidos'];
    let currentIndex = 0;
    const rotationIntervalTime = 5000; // 5 seconds per view
    let rotationInterval;

    // Fetch and Render Tickets
    fetchTickets();

    function fetchTickets() {
        console.log('Fetching tickets...');
        fetch(SHEET_URL)
            .then(response => response.text())
            .then(csvText => {
                const tickets = parseCSV(csvText);
                console.log('Parsed tickets:', tickets);
                renderTickets(tickets);
                startRotation(); // Start rotation after data is loaded
            })
            .catch(error => console.error('Error fetching tickets:', error));
    }

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = parseCSVLine(lines[0]);

        return lines.slice(1).map(line => {
            const values = parseCSVLine(line);
            const ticket = {};
            headers.forEach((header, index) => {
                ticket[header.trim()] = values[index];
            });
            return ticket;
        });
    }

    // Handled quoted values correctly
    function parseCSVLine(text) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function renderTickets(tickets) {
        // Clear existing static content if any (though we will remove it from HTML too)
        document.querySelector('#abertos .cards-container').innerHTML = '';
        document.querySelector('#andamento .cards-container').innerHTML = '';
        document.querySelector('#resolvidos .cards-container').innerHTML = '';

        tickets.forEach(ticket => {
            // Map Sheet Columns: Carimbo de data/hora, Numero do Chamado, Titulo, Assunto, Status, Sistema
            const id = ticket['Numero do Chamado'];
            const title = ticket['Titulo'];
            const description = ticket['Assunto'];
            const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
            const timestamp = ticket['Carimbo de data/hora'];
            const system = ticket['Sistema'];

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
                return; // Skip if status is not recognized
            }

            const card = document.createElement('div');
            card.className = `card ${statusClass}`;
            card.dataset.id = id;

            // Calculate "Time Ago" (Basic implementation) -> You might want a library (e.g. date-fns) for better formatting, 
            // but simple diff works for now. 
            // Note: Sheet format logic might differ based on locale, assuming standard format or just displaying raw string if complex parsing needed.
            const timeDisplay = timestamp ? `Aberto em: ${timestamp}` : '';

            card.innerHTML = `
                <div class="card-header">
                    <span class="ticket-id">#${id}</span>
                    <span class="status-badge">${statusLabel}</span>
                    ${system ? `<span class="system-badge" style="font-size: 0.8em; background: #eee; padding: 2px 6px; border-radius: 4px; margin-left: auto;">${system}</span>` : ''}
                </div>
                <h3>${title}</h3>
                <p>${description}</p>
                <div class="card-footer">
                    <span>${timeDisplay}</span>
                    <button>Ver Detalhes</button>
                </div>
            `;

            const container = document.querySelector(`#${targetSectionId} .cards-container`);
            if (container) {
                container.appendChild(card);
            }
        });
    }

    function switchTab(targetId) {
        // Remove active class from all links and sections
        navLinks.forEach(nav => nav.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));

        // Find and activate the link corresponding to the targetId
        const activeLink = document.querySelector(`nav a[data-target="${targetId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Show target section
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    // Manual Click Handling
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Update currentIndex to match the clicked item so rotation continues correctly
            currentIndex = rotationOrder.indexOf(targetId);

            switchTab(targetId);

            // Reset interval on manual click
            if (rotationInterval) clearInterval(rotationInterval);
            rotationInterval = setInterval(rotateView, rotationIntervalTime);
        });
    });

    // Auto Rotation Logic
    function rotateView() {
        currentIndex = (currentIndex + 1) % rotationOrder.length;
        const nextId = rotationOrder[currentIndex];
        switchTab(nextId);
    }

    function startRotation() {
        if (rotationInterval) clearInterval(rotationInterval);
        rotationInterval = setInterval(rotateView, rotationIntervalTime);
    }
});
