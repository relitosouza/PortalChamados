document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');

    // Order of rotation: Abertos -> Andamento -> Resolvidos
    const rotationOrder = ['abertos', 'andamento', 'resolvidos'];
    let currentIndex = 0;
    const rotationIntervalTime = 5000; // 5 seconds per view

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

            // Reset interval on manual click (optional, but good UX)
            clearInterval(rotationInterval);
            rotationInterval = setInterval(rotateView, rotationIntervalTime);
        });
    });

    // Auto Rotation Logic
    function rotateView() {
        currentIndex = (currentIndex + 1) % rotationOrder.length;
        const nextId = rotationOrder[currentIndex];
        switchTab(nextId);
    }

    let rotationInterval = setInterval(rotateView, rotationIntervalTime);
});
