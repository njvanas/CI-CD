// Simple interactive functionality
function showMessage() {
    const messageEl = document.getElementById('message');
    const messages = [
        '🚀 CI/CD is working!',
        '✨ GitHub Actions deployed this!',
        '🎉 Your site is live!',
        '⚡ Automated deployment successful!'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    messageEl.textContent = randomMessage;
    messageEl.classList.remove('hidden');
    
    // Smooth scroll to message
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe sections for animation
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});
