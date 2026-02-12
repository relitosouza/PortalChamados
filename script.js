document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');
    // Use the gviz endpoint which is more reliable for direct fetching
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';

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
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(csvText => {
                // Determine if we got an error HTML page instead of CSV (common with permission errors)
                if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
                    throw new Error('Received HTML instead of CSV. Check sheet permissions (must be "Anyone with the link").');
                }

                const tickets = parseCSV(csvText);
                console.log('Parsed tickets:', tickets);
                renderTickets(tickets);
                startRotation(); // Start rotation after data is loaded
            })
            .catch(error => {
                console.error('Error fetching tickets:', error);

                // Show error on the page
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.style.color = 'red';
                errorMsg.style.textAlign = 'center';
                errorMsg.style.padding = '20px';
                errorMsg.innerHTML = `
                    <p>Erro ao carregar dados: ${error.message}</p>
                    <p>Verifique se a planilha está publicada na web (Arquivo > Compartilhar > Publicar na web).</p>
                `;

                document.querySelectorAll('.cards-container').forEach(container => {
                    container.innerHTML = '';
                    container.appendChild(errorMsg.cloneNode(true));
                });
            });
    }

    function parseCSV(csvText) {
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let inQuotes = false;

        // Remove strictly completely empty lines if necessary, but keep the main loop robust
        // We'll iterate manually to handle quoted newlines
        // Normalize line endings to \n just in case
        const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote ("") -> become a single quote
                    currentVal += '"';
                    i++; // Skip the next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of cell
                currentRow.push(currentVal);
                currentVal = '';
            } else if (char === '\n' && !inQuotes) {
                // End of row
                currentRow.push(currentVal);
                if (currentRow.length > 0) { // Avoid pushing empty rows if any
                    rows.push(currentRow);
                }
                currentRow = [];
                currentVal = '';
            } else {
                currentVal += char;
            }
        }

        // Handle the very last value/row if file doesn't end with \n
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal);
            rows.push(currentRow);
        }

        // Now map to objects
        if (rows.length === 0) return [];

        const headers = rows[0].map(h => h.trim());
        const data = rows.slice(1).map(values => {
            const ticket = {};
            headers.forEach((header, index) => {
                // Handle potential missing values at end of row
                const val = values[index] !== undefined ? values[index] : '';
                ticket[header] = val.trim(); // Trim values just in case
            });
            return ticket;
        });

        return data;
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
