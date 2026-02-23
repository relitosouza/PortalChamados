document.addEventListener('DOMContentLoaded', () => {
    // Pegar o ID do chamado da URL
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');

    if (!ticketId) {
        showError();
        return;
    }

    // Buscar dados
    fetchTicketDetails(ticketId);

    function fetchTicketDetails(id) {
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
                const ticket = tickets.find(t => t['Numero do Chamado'] === id);

                if (ticket) {
                    displayTicket(ticket);
                } else {
                    showError();
                }
            })
            .catch(error => {
                console.error('Error fetching ticket:', error);
                showError();
            });
    }

    function displayTicket(ticket) {
        // Esconder loading e mostrar conteúdo
        document.getElementById('loading').style.display = 'none';
        document.getElementById('detailsContent').style.display = 'block';

        // Dados básicos
        const id = ticket['Numero do Chamado'];
        const title = ticket['Titulo'];
        const description = ticket['Assunto'];
        const statusRaw = ticket['Status'] ? ticket['Status'].toLowerCase() : '';
        const timestamp = ticket['Carimbo de data/hora'];
        const system = ticket['Sistema'] ? ticket['Sistema'].trim() : '';

        // Determinar status
        let statusClass = '';
        let statusLabel = '';

        if (statusRaw.includes('aberto')) {
            statusClass = 'aberto';
            statusLabel = 'Aberto';
        } else if (statusRaw.includes('andamento') || statusRaw.includes('em andamento')) {
            statusClass = 'andamento';
            statusLabel = 'Em Andamento';
        } else if (statusRaw.includes('resolvido')) {
            statusClass = 'resolvido';
            statusLabel = 'Resolvido';
        }

        // Preencher informações principais
        document.getElementById('ticketId').textContent = `#${id}`;
        document.getElementById('ticketTitle').textContent = title;
        document.getElementById('timestamp').textContent = timestamp || 'Não informado';
        document.getElementById('statusText').textContent = statusLabel;
        document.getElementById('description').textContent = description;

        // Status badge
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = statusLabel;
        statusBadge.className = `status-badge ${statusClass}`;

        // System badge (se houver)
        if (system) {
            const systemBadge = document.getElementById('systemBadge');
            const systemCard = document.getElementById('systemCard');
            const systemText = document.getElementById('systemText');

            let systemClass = '';
            const systemNormalized = system.toLowerCase();

            if (systemNormalized === 'cp' || systemNormalized.includes('cp')) {
                systemClass = 'cp';
            } else if (systemNormalized === 'am' || systemNormalized.includes('am')) {
                systemClass = 'am';
            } else if (systemNormalized.includes('transparencia') || systemNormalized.includes('transparência')) {
                systemClass = 'transparencia';
            }

            systemBadge.textContent = system;
            systemBadge.className = `system-badge ${systemClass}`;
            systemBadge.style.display = 'inline-block';

            systemText.textContent = system;
            systemCard.style.display = 'block';
        }

        // Campos adicionais dinâmicos
        const additionalFields = document.getElementById('additionalFields');
        const additionalInfo = document.getElementById('additionalInfo');
        
        // Campos padrão que não mostraremos nas informações adicionais
        const standardFields = [
            'Carimbo de data/hora',
            'Numero do Chamado',
            'Titulo',
            'Assunto',
            'Status',
            'Sistema'
        ];

        let hasAdditionalFields = false;

        Object.keys(ticket).forEach(key => {
            if (!standardFields.includes(key) && ticket[key]) {
                hasAdditionalFields = true;
                const item = document.createElement('div');
                item.className = 'info-item';
                item.innerHTML = `
                    <label>${escapeHTML(key)}</label>
                    <span>${escapeHTML(ticket[key])}</span>
                `;
                additionalFields.appendChild(item);
            }
        });

        if (hasAdditionalFields) {
            additionalInfo.style.display = 'block';
        }

        // Atualizar título da página
        document.title = `Chamado #${id} - ${title} - Smarapd`;

        // Criar timeline simples baseada no status
        createTimeline(statusLabel, timestamp);
    }

    function createTimeline(currentStatus, timestamp) {
        const timeline = document.getElementById('timeline');
        const timelineSection = document.getElementById('timelineSection');

        const events = [];

        // Evento de abertura (sempre existe)
        events.push({
            title: 'Chamado Aberto',
            date: timestamp || 'Data não informada',
            description: 'O chamado foi registrado no sistema.'
        });

        // Evento de andamento (se aplicável)
        if (currentStatus === 'Em Andamento' || currentStatus === 'Resolvido') {
            events.push({
                title: 'Em Andamento',
                date: 'Data não registrada',
                description: 'O chamado está sendo processado pela equipe.'
            });
        }

        // Evento de resolução (se aplicável)
        if (currentStatus === 'Resolvido') {
            events.push({
                title: 'Chamado Resolvido',
                date: 'Data não registrada',
                description: 'O chamado foi finalizado com sucesso.'
            });
        }

        // Renderizar timeline se houver mais de um evento
        if (events.length > 1) {
            events.forEach(event => {
                const item = document.createElement('div');
                item.className = 'timeline-item';
                item.innerHTML = `
                    <div class="timeline-content">
                        <h4>${event.title}</h4>
                        <p>${event.description}</p>
                        <span class="timeline-date">${event.date}</span>
                    </div>
                `;
                timeline.appendChild(item);
            });
            timelineSection.style.display = 'block';
        }
    }

    function showError() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'flex';
    }
});

// Função para compartilhar o chamado
function shareTicket() {
    const url = window.location.href;
    const title = document.getElementById('ticketTitle').textContent;
    const id = document.getElementById('ticketId').textContent;

    if (navigator.share) {
        navigator.share({
            title: `${id} - ${title}`,
            text: `Confira os detalhes deste chamado: ${title}`,
            url: url
        }).catch(err => console.error('Erro ao compartilhar:', err));
    } else {
        // Fallback: copiar para clipboard
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copiado para a área de transferência!');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            // Fallback manual
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert('Link copiado para a área de transferência!');
            } catch (err) {
                alert('Não foi possível copiar o link. URL: ' + url);
            }
            document.body.removeChild(textArea);
        });
    }
}
