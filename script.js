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

// CI/CD Pipeline Animation
function animatePipeline() {
    const steps = document.querySelectorAll('.pipeline-step');
    let delay = 0;
    
    steps.forEach((step, index) => {
        setTimeout(() => {
            step.style.opacity = '0';
            step.style.transform = 'scale(0.8)';
            step.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                step.style.opacity = '1';
                step.style.transform = 'scale(1)';
                
                // Add completion effect
                if (index === steps.length - 1) {
                    step.style.borderColor = '#28a745';
                    step.style.boxShadow = '0 0 20px rgba(40,167,69,0.3)';
                }
            }, 100);
        }, delay);
        
        delay += 800;
    });
}

// Animate pipeline on page load
window.addEventListener('load', () => {
    setTimeout(animatePipeline, 500);
});

// Update deployment time
function updateDeploymentTime() {
    const deployTimeEl = document.getElementById('deploy-time');
    if (deployTimeEl) {
        const times = ['~1 minute', '~2 minutes', '~3 minutes'];
        let currentIndex = 0;
        
        setInterval(() => {
            deployTimeEl.textContent = times[currentIndex];
            currentIndex = (currentIndex + 1) % times.length;
        }, 3000);
    }
}

updateDeploymentTime();

// Simulate pipeline status updates
function simulatePipelineStatus() {
    const statusElements = document.querySelectorAll('.step-status');
    const statuses = [
        { class: 'active', text: 'Running' },
        { class: 'active', text: 'Processing' },
        { class: 'success', text: 'Completed' }
    ];
    
    statusElements.forEach((el, index) => {
        if (index < statusElements.length - 1) {
            // Keep first 3 steps as active
            el.className = 'step-status active';
        } else {
            // Last step is success
            el.className = 'step-status success';
        }
    });
}

// Run simulation on load
setTimeout(simulatePipelineStatus, 2000);

// Add click interaction to pipeline steps
document.querySelectorAll('.pipeline-step').forEach((step, index) => {
    step.addEventListener('click', () => {
        const stepNames = ['Code Commit', 'GitHub Actions', 'Build & Test', 'Deploy'];
        alert(`Step ${index + 1}: ${stepNames[index]}\n\nThis step is part of the automated CI/CD pipeline that runs whenever code is pushed to the repository.`);
    });
    
    step.style.cursor = 'pointer';
});
