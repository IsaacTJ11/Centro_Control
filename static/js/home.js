document.addEventListener('DOMContentLoaded', function() {
    // Only run simulation if on a page that needs it (like Home or generic dashboards)
    if (document.querySelector('.grid-cards')) {
        simulateRealTimeUpdates();
    }
});

function simulateRealTimeUpdates() {
    // Simulate real-time data updates for demonstration
    setInterval(function() {
        // Update random values in forms and displays
        const numberInputs = document.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            if (Math.random() < 0.1) { // 10% chance to update
                const currentValue = parseFloat(input.value) || 0;
                const variation = (Math.random() - 0.5) * 2; // Random variation
                const newValue = Math.max(0, currentValue + variation);
                input.value = newValue.toFixed(1);
                
                // Add visual feedback
                input.style.backgroundColor = '#fff3f0';
                setTimeout(() => {
                    input.style.backgroundColor = '';
                }, 1000);
            }
        });

        // Update status values
        const statusValues = document.querySelectorAll('.status-value');
        statusValues.forEach(element => {
            if (Math.random() < 0.05) { // 5% chance to update
                const text = element.textContent;
                if (text.includes('MW')) {
                    const currentValue = parseFloat(text);
                    const variation = (Math.random() - 0.5) * 10;
                    const newValue = Math.max(0, currentValue + variation);
                    element.textContent = newValue.toFixed(0) + ' MW';
                } else if (text.includes('%')) {
                    const currentValue = parseFloat(text);
                    const variation = (Math.random() - 0.5) * 5;
                    const newValue = Math.max(0, Math.min(100, currentValue + variation));
                    element.textContent = newValue.toFixed(0) + '%';
                }
            }
        });
    }, 5000); // Update every 5 seconds
}
