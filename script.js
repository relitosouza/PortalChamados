document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all links and sections
            navLinks.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));

            // Add active class to clicked link
            link.classList.add('active');

            // Show target section
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Timer Logic for Auto-transition
    const transitionTime = 10; // seconds for demo

    function startTimer(card, duration) {
        let timer = duration;
        const timerDisplay = card.querySelector('.timer');

        // Prevent multiple intervals
        if (card.dataset.intervalId) {
            clearInterval(Number(card.dataset.intervalId));
        }

        const intervalId = setInterval(() => {
            if (timerDisplay) {
                timerDisplay.textContent = `${timer}s`;
            }

            if (--timer < 0) {
                clearInterval(intervalId);
                moveCardToNextStatus(card);
            }
        }, 1000);

        card.dataset.intervalId = String(intervalId);
    }

    function moveCardToNextStatus(card) {
        const currentStatus = getCardStatus(card);
        let nextStatus = '';
        let nextSectionId = '';
        let validTransition = false;

        if (currentStatus === 'aberto') {
            nextStatus = 'andamento';
            nextSectionId = 'andamento';
            validTransition = true;
        } else if (currentStatus === 'andamento') {
            nextStatus = 'resolvido';
            nextSectionId = 'resolvidos';
            validTransition = true;
        }

        if (validTransition) {
            // Update Card Styles and Badge
            card.classList.remove(`status-${currentStatus}`);
            card.classList.add(`status-${nextStatus}`);

            const badge = card.querySelector('.status-badge');
            if (badge) {
                badge.textContent = getStatusLabel(nextStatus);
            }

            // Move card to next section
            const nextSection = document.getElementById(nextSectionId);
            const container = nextSection.querySelector('.cards-container');

            // Animation for moving
            card.style.opacity = '0';
            setTimeout(() => {
                container.appendChild(card);
                card.style.opacity = '1';

                // Restart timer if moving to 'andamento'
                if (nextStatus === 'andamento') {
                    startTimer(card, transitionTime);
                } else {
                    // Start timer to remove from resolved (optional, but requested flow implies movement)
                    // For now, let's stop at resolved.
                    const timerDisplay = card.querySelector('.timer');
                    if (timerDisplay) timerDisplay.textContent = 'Concluído';
                }
            }, 500);
        }
    }

    function getCardStatus(card) {
        if (card.classList.contains('status-aberto')) return 'aberto';
        if (card.classList.contains('status-andamento')) return 'andamento';
        if (card.classList.contains('status-resolvido')) return 'resolvido';
        return '';
    }

    function getStatusLabel(status) {
        switch (status) {
            case 'aberto': return 'Aberto';
            case 'andamento': return 'Em Andamento';
            case 'resolvido': return 'Resolvido';
            default: return '';
        }
    }

    // Initialize timers for existing cards in 'aberto' and 'andamento'
    const cardsToTime = document.querySelectorAll('.status-aberto, .status-andamento');
    cardsToTime.forEach(card => {
        startTimer(card, transitionTime);
    });
});
