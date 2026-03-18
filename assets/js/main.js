document.addEventListener('DOMContentLoaded', () => {
    // Reveal Observer for soft entrance animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger the animation a bit
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply to elements with the 'reveal' class
    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });

    // Visitor Counter Logic
    async function initVisitorCounter() {
        const countEl = document.getElementById('visit-count');
        try {
            // Using a different public counter API (counterapi.dev) to resolve CORS issues
            const response = await fetch('https://api.counterapi.dev/v1/uchoten-landmark/visits/up');
            const data = await response.json();
            if (data && data.count) {
                countEl.textContent = data.count.toLocaleString();
            }
        } catch (error) {
            console.warn('Visitor counter failed to load:', error);
            countEl.textContent = '---';
        }
    }

    initVisitorCounter();

    // Gentle hover logs for accessibility check or future features
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            console.log(`Interaction: Navigating ${card.id}`);
        });
    });

    console.log('Uchoten Landmark: Minimalist personal space initialized.');
});
