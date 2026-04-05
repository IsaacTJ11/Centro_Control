/* ============================================================
   1. INICIALIZACIÓN
   ============================================================ */

window.initCoes = function () {
    const API_URL = '/api/data-cmg';

    /* ----------------------------
       1.1 Limpiar intervalo anterior
       ---------------------------- */
    if (window._coesInterval) {
        clearInterval(window._coesInterval);
        window._coesInterval = null;
    }

    /* ============================================================
       2. RENDER DEL GRÁFICO CMG
       ============================================================ */

    function renderGraficoCmg(datos) {
        const hoy   = new Date();
        const xMin  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(),     0, 0, 0).getTime();
        const xMax  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 0, 0, 0).getTime();
        const ahora = Date.now();

        // Serie única con todos los puntos
        const serie = datos
            .filter(d => d.cmg_santa_rosa !== null && d.cmg_santa_rosa !== undefined)
            .map(d => [new Date(d.fecha).getTime(), parseFloat(d.cmg_santa_rosa)]);

        const options = {
            series: [{ name: 'CMg Santa Rosa', data: serie }],
            chart: {
                id: 'cmg-chart',
                type: 'area',
                height: 350,
                animations: { enabled: false },
                toolbar: { show: true },
                zoom: { type: 'x', enabled: true, autoScaleYaxis: true }
            },
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2 },
            colors: ['#28a745'],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.5,
                    opacityTo: 0.05,
                    stops: [0, 100]
                }
            },
            annotations: {
                xaxis: [{
                    x: ahora,
                    borderColor: '#ff6b35',
                    strokeDashArray: 4,
                    label: {
                        borderColor: '#ff6b35',
                        style: { color: '#fff', background: '#ff6b35', fontSize: '11px' },
                        text: 'Ahora'
                    }
                }]
            },
            xaxis: {
                type: 'datetime',
                min: xMin,
                max: xMax,
                labels: { datetimeUTC: false, format: 'HH:mm' },
                tickAmount: 12
            },
            yaxis: {
                title: { text: '$ / MWh' },
                labels: { formatter: val => val.toFixed(1) }
            },
            tooltip: {
                x: { format: 'dd MMM HH:mm' },
                y: { formatter: val => `$ ${val.toFixed(2)} / MWh` }
            },
            noData: { text: 'Sin datos disponibles para hoy' }
        };

        const contenedor = document.querySelector('#chart-cmg-santa-rosa');
        if (contenedor) {
            contenedor.innerHTML = '';
            new ApexCharts(contenedor, options).render();
        }

        // Hora del último dato
        const ultimo = datos.filter(d => d.cmg_santa_rosa !== null).slice(-1)[0];
        const span   = document.getElementById('hora-actuales-cmg');
        if (span && ultimo) {
            const f = new Date(ultimo.fecha);
            span.textContent = `(${f.getHours().toString().padStart(2,'0')}:${f.getMinutes().toString().padStart(2,'0')})`;
        }
    }


    /* ============================================================
       3. FETCH Y POLLING
       ============================================================ */

    function fetchData() {
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    console.error('API CMg respondió con error:', response.status);
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.status === 'success') {
                    renderGraficoCmg(data.datos);
                } else if (data) {
                    console.error('Error del servidor CMg:', data.message);
                }
            })
            .catch(e => {
                console.error('Error de red al obtener datos CMg:', e);
            });
    }

    /* ----------------------------
       3.1 Carga inicial y polling cada 5 min
       ---------------------------- */
    fetchData();
    window._coesInterval = setInterval(fetchData, 5 * 60 * 1000);
};