/* ============================================================
   1. INICIALIZACIÓN
   ============================================================ */

window.initEmbalse = function () {

    /* ----------------------------
       1.1 Limpiar intervalo anterior
       ---------------------------- */
    if (window._embalseInterval) {
        clearInterval(window._embalseInterval);
        window._embalseInterval = null;
    }

    /* ----------------------------
       1.2 Carga inicial y polling cada 5 min
       ---------------------------- */
    const cargarDatos = () => {
        fetch('/api/data-huinco')
            .then(response => {
                if (!response.ok) {
                    console.warn('API Huinco respondió con error:', response.status);
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.status === 'success') {
                    renderizarDashboard(data.actual, data.grafico);
                } else if (data && data.status === 'error') {
                    console.error('Error del servidor Huinco:', data.message);
                }
            })
            .catch(error => {
                console.error('Error de red al cargar datos Huinco:', error);
            });
    };

    cargarDatos();
    window._embalseInterval = setInterval(cargarDatos, 5 * 60 * 1000);
};


/* ============================================================
   2. RENDER DEL DASHBOARD
   ============================================================ */

function renderizarDashboard(actual, resultado) {
    const grafico     = resultado.datos;
    const anotaciones = resultado.anotaciones;

    const f = (val) => (val !== null && val !== undefined && !isNaN(val))
        ? parseFloat(val).toFixed(2)
        : "0.00";

    if (actual) {
        const fv = (val, unidad) => (val !== null && val !== undefined && !isNaN(parseFloat(val)))
            ? parseFloat(val).toFixed(2) + ' ' + unidad
            : '-- ' + unidad;

        document.getElementById('val-rio').value   = fv(actual.caudal_entrada,     'm³/s');
        document.getElementById('val-calla').value = fv(actual.caudal_callahuanca, 'm³/s');
        document.getElementById('val-desc').value  = fv(actual.caudal_descarga,    'm³/s');

        const fechaActual    = new Date(actual.fecha);
        const horaFormateada =
            fechaActual.getHours().toString().padStart(2, '0') + ':' +
            fechaActual.getMinutes().toString().padStart(2, '0');

        document.getElementById('hora-actuales').textContent = `(${horaFormateada})`;
    }

    const datosLimpios = grafico.map(d => ({
        x: new Date(d.fecha).getTime(),
        y: (d.nivel_presa === null || isNaN(d.nivel_presa))
            ? null
            : parseFloat(d.nivel_presa),
        caudal_entrada:  d.caudal_entrada,
        caudal_descarga: d.caudal_descarga,
        volumen_presa:   d.volumen_presa
    })).filter(p => !isNaN(p.x));

    // Calcular rango X basado en el último dato real disponible
    let xMin = undefined;
    let xMax = undefined;
    const seisHoras = 6 * 60 * 60 * 1000;

    const ultimoConEntrada = datosLimpios
        .slice()
        .reverse()
        .find(d => d.caudal_entrada !== null && d.caudal_entrada !== undefined);

    const ahoraMs = ultimoConEntrada
        ? Math.min(Date.now(), ultimoConEntrada.x)
        : Date.now();

    // Calcular tiempo hasta las 00:00 de mañana
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    const msHastaManana = manana.getTime() - Date.now();
    const doceHoras = 12 * 60 * 60 * 1000;
    const tiempoFuturo = msHastaManana < doceHoras ? msHastaManana : doceHoras;

    xMin = ahoraMs - seisHoras;
    xMax = msHastaManana < doceHoras ? manana.getTime() : ahoraMs + doceHoras;

    // Inicio zona predicción: último dato real redondeado a 30 min
    const basePrediccion = ultimoConEntrada ? new Date(ultimoConEntrada.x) : new Date(ahoraMs);
    const inicioPrediccion = new Date(basePrediccion);
    if (basePrediccion.getMinutes() < 30) {
        inicioPrediccion.setMinutes(0, 0, 0);
    } else {
        inicioPrediccion.setMinutes(30, 0, 0);
    }
    console.log('anotaciones recibidas:', JSON.stringify(anotaciones));
    const annotations = {
        yaxis: anotaciones.yaxis.map(a => ({
            y: a.y,
            borderColor: '#FF6B35',
            label: {
                borderColor: '#FF6B35',
                style: { color: '#fff', background: '#FF6B35' },
                text: a.label,
                position: 'right',
                offsetX: -9,
                offsetY: -5
            }
        })),
        xaxis: anotaciones.xaxis.length > 0 ? [{
            x:  inicioPrediccion.getTime(),
            x2: xMax,
            fillColor: '#D7B3F7',
            opacity: 0.4,
            label: {
                borderColor: '#D7B3F7',
                style: { fontSize: '10px', color: '#fff', background: '#7200E3' },
                offsetY: -10,
                text: anotaciones.xaxis[0]?.label ?? 'Proyección'
            }
        }] : [],
        points: anotaciones.points.map(p => {
            const sinEtiqueta = p.y < 1858;
            const punto = {
                x: new Date(p.fecha).getTime(),
                y: p.y,
                marker: {
                    size: 7,
                    fillColor: '#fff',
                    strokeColor: '#5AFA93',
                    strokeWidth: 2,
                    radius: 2
                }
            };
            if (!sinEtiqueta) {
                punto.label = {
                    borderColor: '#5AFA93',
                    offsetY: p.position === 'bottom' ? 40 : -5,
                    offsetX: p.position === 'bottom' ? -20 : 20,
                    style: {
                        color: '#fff',
                        background: '#5AFA93',
                        fontSize: '10px',
                        padding: { left: 4, right: 4, top: 2, bottom: 2 }
                    },
                    text: `Qrío: ${p.caudal}`,
                    textAnchor: p.position === 'bottom' ? 'start' : 'end'
                };
            }
            return punto;
        })
    };

    const options = {
        series: [{ name: 'Nivel Presa', data: datosLimpios }],
        chart: {
            type: 'line',
            height: 350,
            animations: { enabled: false },
            toolbar: { show: true },
            zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
            events: {
                mounted: function(chartCtx) {
                    if (xMin !== undefined && xMax !== undefined) {
                        chartCtx.zoomX(xMin, xMax);
                    }
                },
                beforeResetZoom: function(chartCtx) {
                    return {
                        xaxis: {
                            min: xMin,
                            max: xMax
                        }
                    };
                }
            }
        },
        annotations: annotations,
        stroke: { curve: 'smooth', width: 3 },
        xaxis: {
            type: 'datetime',
            labels: { datetimeUTC: false },
        },
        yaxis: {
            min: 1855,
            max: 1870,
            forceNiceScale: true,
            labels: { formatter: (val) => val.toFixed(1) }
        },
        tooltip: {
            shared: true,
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const d = w.config.series[seriesIndex].data[dataPointIndex];

                const fecha   = new Date(d.x);
                const meses   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                const fechaFmt = `${fecha.getDate().toString().padStart(2,'0')} ${meses[fecha.getMonth()]} `
                              + `${fecha.getHours().toString().padStart(2,'0')}:${fecha.getMinutes().toString().padStart(2,'0')}`;

                const fv = (val, unidad = '') => (val !== null && val !== undefined && !isNaN(val))
                    ? parseFloat(val).toFixed(2) + (unidad ? ' ' + unidad : '')
                    : '--' + (unidad ? ' ' + unidad : '');

                const toKm3 = (val) => {
                    if (val === null || val === undefined || isNaN(val)) return '-- km³';
                    return (parseFloat(val) / 1000).toFixed(2) + ' km³';
                };

                return `
                    <div style="padding:10px;border-radius:5px;background:#fff;border:1px solid #ccc;font-size:13px;line-height:1.6;">
                        <div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #eee;">${fechaFmt}</div>
                        <div><span style="color:#008FFB;">●</span> <b>Nivel Presa:</b> ${fv(d.y, 'msnm')}</div>
                        <div><span style="color:#008FFB;">●</span> <b>Vol. Presa:</b> ${toKm3(d.volumen_presa)}</div>
                        <div><span style="color:#008FFB;">●</span> <b>Q. entrada:</b> ${fv(d.caudal_entrada, 'm³/s')}</div>
                        <div><span style="color:#008FFB;">●</span> <b>Q. al río:</b> ${fv(d.caudal_descarga, 'm³/s')}</div>
                    </div>
                `;
            }
        },
        noData: {
            text: 'Cargando datos o sin registros disponibles...'
        }
    };

    const contenedor = document.querySelector("#chart-nivel-huinco");
    if (contenedor) {
        contenedor.innerHTML = "";
        new ApexCharts(contenedor, options).render();
    } else {
        console.error("No se encontró el elemento #chart-nivel-huinco");
    }

    // Texto de presa vacía
    const textoExistente = document.getElementById('aviso-presa-vacia');
    if (textoExistente) textoExistente.remove();

    const ultimoNivel = datosLimpios
        .filter(d => d.y !== null && !isNaN(d.y))
        .slice(-1)[0]?.y;

    if (ultimoNivel !== undefined && ultimoNivel < 1855) {
        const aviso = document.createElement('div');
        aviso.id = 'aviso-presa-vacia';
        aviso.textContent = 'Presa vacía (F/S)';
        aviso.style.cssText = 'color:#dc3545;font-weight:600;font-size:13px;text-align:center;margin-top:8px;';
        contenedor.parentElement.appendChild(aviso);
    }
}