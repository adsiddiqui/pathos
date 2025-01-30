document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    if (!header) return;

    // Hide header when scrolling down, show when scrolling up
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        // Scrolling down
        if (currentScroll > lastScroll && currentScroll > 50) {
            header.classList.add('hidden');
        }
        // At top or scrolling up
        else if (currentScroll < lastScroll) {
            header.classList.remove('hidden');
        }
        
        lastScroll = currentScroll;
    });

    // Hide header initially if not at top
    if (window.pageYOffset > 50) {
        header.classList.add('hidden');
    }
}); 