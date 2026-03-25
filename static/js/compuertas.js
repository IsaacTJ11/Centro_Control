window.initCompuertas = function() {
    const API_URL = '/api/data-fondo-huinco';

    function fetchData() {
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    // Si la API falla, forzamos recarga para que Flask 
                    // ejecute el try/except del punto anterior y salte el error 500
                    window.location.reload();
                    return;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.status === 'success') {
                    renderDashboard(data.actual, data.grafico);
                }
            })
            .catch(e => {
                console.error('Error:', e);
                // Si hay error de red persistente, recargar
                setTimeout(() => window.location.reload(), 2000);
            });
    }

    fetchData();
    setInterval(fetchData, 5 * 60 * 1000);
};

function renderDashboard(actual, historico) {
    // 1. Actualizar Inputs
    const f = (val) => (val != null) ? parseFloat(val).toFixed(2) : "0.00";
    
    if (actual) {
        document.getElementById('val-apertura').value = f(actual.apertura) + " %";
        document.getElementById('val-caudal-comp').value = f(actual.caudal) + " m³/s";
        document.getElementById('val-nivel-ref').value = f(actual.nivel_embalse) + " msnm";
        
        const fecha = new Date(actual.fecha);
        document.getElementById('hora-actuales').textContent = 
            `(${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')})`;
    }

    // 2. Gráfico
    const options = {
        series: [
            { name: 'Apertura (%)', data: historico.map(d => ({ x: new Date(d.fecha).getTime(), y: d.apertura })) },
            { name: 'Caudal (m³/s)', data: historico.map(d => ({ x: new Date(d.fecha).getTime(), y: d.caudal })) }
        ],
        chart: {
            type: 'area',
            height: 350,
            toolbar: { show: true }
        },
        colors: ['#ff6b35', '#20c997'],
        dataLabels: { enabled: false },
        stroke: { curve: 'step' }, // 'step' es mejor para representar cambios en compuertas
        xaxis: { type: 'datetime' },
        yaxis: [
            { title: { text: "Apertura %" }, min: 0, max: 100 },
            { opposite: true, title: { text: "Caudal m³/s" } }
        ],
        tooltip: { x: { format: 'dd MMM HH:mm' } }
    };

    const container = document.querySelector("#chart-compuerta-fondo");
    if (container) {
        container.innerHTML = "";
        new ApexCharts(container, options).render();
    }
}