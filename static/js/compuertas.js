/* ============================================================
   1. INICIALIZACIÓN
   ============================================================ */

window.initCompuertas = function () {
    const API_URL = '/api/data-fondo-huinco';

    /* ----------------------------
       1.1 Limpiar intervalo anterior
       ---------------------------- */
    if (window._compuertasInterval) {
        clearInterval(window._compuertasInterval);
        window._compuertasInterval = null;
    }


    /* ============================================================
       2. RENDER DEL DASHBOARD
       ============================================================ */

    /* renderDashboard es privada — solo se llama desde fetchData()
       Se define dentro de initCompuertas para evitar scope global */

    function renderDashboard(actual, historico) {

        /* 2.1 Valores actuales */
        if (actual) {
            const f = (val) => (val != null) ? parseFloat(val).toFixed(2) : "0.00";
            document.getElementById('val-apertura').value    = f(actual.apertura)      + " %";
            document.getElementById('val-caudal-comp').value = f(actual.caudal)        + " m³/s";
            document.getElementById('val-nivel-ref').value   = f(actual.nivel_embalse) + " msnm";

            const fecha = new Date(actual.fecha);
            document.getElementById('hora-actuales').textContent =
                `(${fecha.getHours().toString().padStart(2,'0')}:${fecha.getMinutes().toString().padStart(2,'0')})`;
        }

        /* 2.2 Series */
        const ahora = Date.now();
        const xMax = (() => {
            const d = new Date();
            const m = d.getMinutes() < 30 ? 0 : 30;
            d.setMinutes(m, 0, 0);
            return d.getTime();
        })();
        const xMin = xMax - 6 * 60 * 60 * 1000;

        const serieComp1 = historico.map(d => ({
            x: new Date(d.fecha).getTime(),
            y: d.comp_fondo_1 != null ? parseFloat(d.comp_fondo_1) : null
        }));
        const serieComp2 = historico.map(d => ({
            x: new Date(d.fecha).getTime(),
            y: d.comp_fondo_2 != null ? parseFloat(d.comp_fondo_2) : null
        }));
        const serieCaudal = historico.map(d => ({
            x: new Date(d.fecha).getTime(),
            y: d.caudal_descarga != null ? parseFloat(d.caudal_descarga) : null
        }));

        /* 2.3 Calcular escalas iniciales con todos los datos */
        const allComp = historico.flatMap(d => [
            d.comp_fondo_1 != null ? parseFloat(d.comp_fondo_1) : null,
            d.comp_fondo_2 != null ? parseFloat(d.comp_fondo_2) : null
        ]).filter(v => v != null);
        const allCaudal = historico
            .map(d => d.caudal_descarga != null ? parseFloat(d.caudal_descarga) : null)
            .filter(v => v != null);

        // Reemplazar calcCompScale:
        function calcCompScale(maxVal, minVal) {
            const yMax  = maxVal > 0 ? maxVal * 2 : 10;
            const step  = yMax <= 30 ? 5 : 10;
            return { min: minVal, max: Math.ceil(yMax / step) * step, tickAmount: Math.ceil((Math.ceil(yMax / step) * step - minVal) / step) };
        }
        function calcCaudalScale(maxVal, compYMax) {
            const yMax  = maxVal > 0 ? Math.ceil(maxVal / 5) * 5 + 5 : 10;
            const step  = compYMax <= 30 ? 5 : 10;
            return { min: 0, max: Math.ceil(yMax / step) * step, tickAmount: Math.ceil(yMax / step) };
        }

        const maxComp0   = allComp.length   ? Math.max(...allComp)   : 0;
        const maxCaudal0 = allCaudal.length ? Math.max(...allCaudal) : 0;
        const minComp0 = allComp.length ? Math.floor(Math.min(...allComp) / 5) * 5 : 0;
        const yMinComp = Math.floor(minComp0 / 5) * 5;
        const compScale0 = calcCompScale(maxComp0, minComp0);
        const caudalScale0 = calcCaudalScale(maxCaudal0, compScale0.max);

        /* 2.4 Formateo eje X — igual que embalse_huinco */
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        /* 2.5 Opciones */
        const options = {
            series: [
                { name: 'Comp. Fondo 1 (%)', type: 'line', data: serieComp1 },
                { name: 'Comp. Fondo 2 (%)', type: 'line', data: serieComp2 },
                { name: 'Q. al río (m³/s)',  type: 'area', data: serieCaudal }
            ],
            chart: {
                height: 350,
                type: 'line',
                animations: { enabled: false },
                toolbar: { show: true },
                zoom: { type: 'x', enabled: true, autoScaleYaxis: false },
                events: {
                    zoomed: function(chartCtx, { xaxis }) {
                        // Recalcular escalas con los datos visibles en el zoom
                        const x0 = xaxis.min;
                        const x1 = xaxis.max;
                        const visible = historico.filter(d => {
                            const t = new Date(d.fecha).getTime();
                            return t >= x0 && t <= x1;
                        });

                        const visComp = visible.flatMap(d => [
                            d.comp_fondo_1 != null ? parseFloat(d.comp_fondo_1) : null,
                            d.comp_fondo_2 != null ? parseFloat(d.comp_fondo_2) : null
                        ]).filter(v => v != null);
                        const visCaudal = visible
                            .map(d => d.caudal_descarga != null ? parseFloat(d.caudal_descarga) : null)
                            .filter(v => v != null);

                        const maxC  = visComp.length   ? Math.max(...visComp)   : maxComp0;
                        const maxQ  = visCaudal.length ? Math.max(...visCaudal) : maxCaudal0;
                        const minC  = visComp.length ? Math.floor(Math.min(...visComp) / 5) * 5 : minComp0;
                        const csNew = calcCompScale(maxC, minC);
                        const qsNew = calcCaudalScale(maxQ, csNew.max);

                        chartCtx.updateOptions({
                            yaxis: buildYAxis(csNew, qsNew)
                        }, false, false);
                    },
                    beforeResetZoom: function(chartCtx) {
                        const xMaxReset = (() => {
                            const d = new Date();
                            const m = d.getMinutes() < 30 ? 0 : 30;
                            d.setMinutes(m, 0, 0);
                            return d.getTime();
                        })();
                        const xMinReset = xMaxReset - 6 * 60 * 60 * 1000;

                        // Recalcular escalas Y con datos visibles en ventana default
                        const visible = historico.filter(d => {
                            const t = new Date(d.fecha).getTime();
                            return t >= xMinReset && t <= xMaxReset;
                        });
                        const visComp = visible.flatMap(d => [
                            d.comp_fondo_1 != null ? parseFloat(d.comp_fondo_1) : null,
                            d.comp_fondo_2 != null ? parseFloat(d.comp_fondo_2) : null
                        ]).filter(v => v != null);
                        const visCaudal = visible
                            .map(d => d.caudal_descarga != null ? parseFloat(d.caudal_descarga) : null)
                            .filter(v => v != null);

                        const maxC  = visComp.length   ? Math.max(...visComp)   : maxComp0;
                        const maxQ  = visCaudal.length ? Math.max(...visCaudal) : maxCaudal0;
                        const minC  = visComp.length   ? Math.floor(Math.min(...visComp) / 5) * 5 : minComp0;
                        const csNew = calcCompScale(maxC, minC);
                        const qsNew = calcCaudalScale(maxQ, csNew.max);

                        setTimeout(() => {
                            chartCtx.updateOptions({ yaxis: buildYAxis(csNew, qsNew) }, false, false);
                        }, 50);

                        return { xaxis: { min: xMinReset, max: xMaxReset } };
                    },
                    scrolled: function(chartCtx, { xaxis }) {
                        // mismo recálculo al hacer scroll
                        const x0 = xaxis.min;
                        const x1 = xaxis.max;
                        const visible = historico.filter(d => {
                            const t = new Date(d.fecha).getTime();
                            return t >= x0 && t <= x1;
                        });

                        const visComp = visible.flatMap(d => [
                            d.comp_fondo_1 != null ? parseFloat(d.comp_fondo_1) : null,
                            d.comp_fondo_2 != null ? parseFloat(d.comp_fondo_2) : null
                        ]).filter(v => v != null);
                        const visCaudal = visible
                            .map(d => d.caudal_descarga != null ? parseFloat(d.caudal_descarga) : null)
                            .filter(v => v != null);

                        const maxC  = visComp.length   ? Math.max(...visComp)   : maxComp0;
                        const maxQ  = visCaudal.length ? Math.max(...visCaudal) : maxCaudal0;
                        const minC  = visComp.length ? Math.floor(Math.min(...visComp) / 5) * 5 : yMinComp;
                        const csNew = calcCompScale(maxC, minC);
                        const qsNew = calcCaudalScale(maxQ, csNew.max);

                        chartCtx.updateOptions({
                            yaxis: buildYAxis(csNew, qsNew)
                        }, false, false);
                    }
                }
            },
            colors: ['#ff6b35', '#764ba2', '#20c997'],
            dataLabels: { enabled: false },
            stroke: {
                curve: ['stepline', 'stepline', 'smooth'],
                width: [2, 2, 2]
            },
            fill: {
                type: ['solid', 'solid', 'gradient'],
                gradient: {
                    shade: 'light',
                    type: 'vertical',
                    shadeIntensity: 1,
                    colorStops: [
                        [],
                        [],
                        [
                            { offset: 0,   color: '#20c997', opacity: 0.5  },
                            { offset: 100, color: '#20c997', opacity: 0.05 }
                        ]
                    ]
                }
            },
            xaxis: {
                type: 'datetime',
                min: xMin,
                max: xMax,
                labels: {
                    datetimeUTC: false,
                    formatter: function(val) {
                        const d = new Date(val);
                        const h = d.getHours().toString().padStart(2, '0');
                        const m = d.getMinutes().toString().padStart(2, '0');
                        if (h === '00' && m === '00') {
                            return `${d.getDate()} ${meses[d.getMonth()]}`;
                        }
                        return `${h}:${m}`;
                    }
                },
                tickAmount: Math.round((xMax - xMin) / (2 * 60 * 60 * 1000))
            },
            yaxis: buildYAxis(compScale0, caudalScale0),
            tooltip: {
                shared: true,
                custom: function({ series, seriesIndex, dataPointIndex, w }) {
                    const row = historico[dataPointIndex];
                    if (!row) return '';

                    const fecha    = new Date(row.fecha);
                    const fechaFmt = `${fecha.getDate().toString().padStart(2,'0')} ${meses[fecha.getMonth()]} `
                                + `${fecha.getHours().toString().padStart(2,'0')}:${fecha.getMinutes().toString().padStart(2,'0')}`;

                    const fv = (val) => (val != null && !isNaN(val))
                        ? parseFloat(val).toFixed(2) : '--';

                    return `
                        <div style="padding:10px;border-radius:5px;background:#fff;border:1px solid #ccc;font-size:13px;line-height:1.6;">
                            <div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #eee;">${fechaFmt}</div>
                            <div><span style="color:#20c997;">●</span> <b>Q. al río:</b> ${fv(row.real_caudal)} m³/s</div>
                            <div><span style="color:#ff6b35;">●</span> <b>Apert. Comp. 1:</b> ${fv(row.real_comp1)} cm</div>
                            <div><span style="color:#764ba2;">●</span> <b>Apert. Comp. 2:</b> ${fv(row.real_comp2)} cm</div>
                        </div>
                    `;
                }
            },
            noData: { text: 'Sin datos disponibles' }
        };

        const container = document.querySelector('#chart-compuerta-fondo');
        if (container) {
            container.innerHTML = '';
            new ApexCharts(container, options).render();
        }

        /* --- helper buildYAxis --- */
        function buildYAxis(cs, qs) {
            return [
                {
                    seriesName: 'Comp. Fondo 1 (%)',
                    title: { text: 'Apertura (cm)' },
                    min: cs.min,
                    max: cs.max,
                    tickAmount: cs.tickAmount,
                    forceNiceScale: false,
                    labels: { formatter: val => val != null ? val.toFixed(0) : '' }
                },
                {
                    seriesName: 'Comp. Fondo 2 (%)',
                    min: cs.min,
                    max: cs.max,
                    show: false
                },
                {
                    seriesName: 'Q. al río (m³/s)',
                    opposite: true,
                    title: { text: 'Caudal (m³/s)' },
                    min: 0,
                    max: qs.max,
                    tickAmount: qs.tickAmount,
                    forceNiceScale: false,
                    labels: { formatter: val => val != null ? val.toFixed(0) : '' }
                }
            ];
        }
    }


    /* ============================================================
       3. FETCH Y POLLING
       ============================================================ */

    function fetchData() {
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    console.error('API /api/data-fondo-huinco respondió con error:', response.status);
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.status === 'success') {
                    renderDashboard(data.actual, data.grafico);
                } else if (data && data.status === 'error') {
                    console.error('Error del servidor:', data.message);
                }
            })
            .catch(e => {
                console.error('Error de red al obtener datos de compuerta:', e);
            });
    }

    /* ----------------------------
       3.1 Carga inicial y polling cada 5 min
       ---------------------------- */
    fetchData();
    window._compuertasInterval = setInterval(fetchData, 5 * 60 * 1000);

};

/* ============================================================
   CONFIG COMPUERTAS — POPUP (movido desde embalses.js)
   ============================================================ */

function abrirConfigCompuertas() {
    if (document.querySelector('.config-compuertas-dialog')) return;

    const dialog = document.createElement('div');
    dialog.className = 'edit-dialog config-compuertas-dialog';
    dialog.innerHTML = `
        <div class="edit-dialog-content">
            <button class="dialog-close-btn" onclick="cerrarConfigCompuertas()">&times;</button>
            <div class="edit-dialog-header">
                <i class="fa-solid fa-gear"></i>
                <h3>Compuertas de fondo</h3>
            </div>

            <div class="comp-config-group">
                <div class="comp-config-title">
                    <span class="edit-form-label">Compuerta fondo 1:</span>
                    <span class="status-indicator-comp" id="indicator-comp1"></span>
                    <span class="comp-estado-text" id="text-comp1"></span>
                </div>
                <div class="comp-config-row">
                    <label class="comp-row-label">Estado</label>
                    <select class="comp-select" id="select-comp1">
                        <option value="HABILITADA">HABILITADA</option>
                        <option value="DESHABILITADA">DESHABILITADA</option>
                    </select>
                </div>
                <div class="comp-config-row">
                    <label class="comp-row-label">Nivel 0</label>
                    <input type="number" id="nivel0-comp1" class="comp-nivel-input" step="0.1" value="-8">
                    <span class="comp-unidad">cm</span>
                </div>
            </div>

            <div class="comp-config-group">
                <div class="comp-config-title">
                    <span class="edit-form-label">Compuerta fondo 2:</span>
                    <span class="status-indicator-comp" id="indicator-comp2"></span>
                    <span class="comp-estado-text" id="text-comp2"></span>
                </div>
                <div class="comp-config-row">
                    <label class="comp-row-label">Estado</label>
                    <select class="comp-select" id="select-comp2">
                        <option value="HABILITADA">HABILITADA</option>
                        <option value="DESHABILITADA">DESHABILITADA</option>
                    </select>
                </div>
                <div class="comp-config-row">
                    <label class="comp-row-label">Nivel 0</label>
                    <input type="number" id="nivel0-comp2" class="comp-nivel-input" step="0.1" value="-8">
                    <span class="comp-unidad">cm</span>
                </div>
            </div>

            <div class="edit-buttons">
                <button class="btn btn-primary comp-btn-actualizar" id="btn-actualizar-config">
                    <i class="fas fa-check"></i> Actualizar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    function actualizarEstadoComp(select, text, indicator) {
        const val = select.value;
        text.textContent = val;
        text.className   = val === 'HABILITADA' ? 'comp-estado-text comp-habilitada' : 'comp-estado-text comp-deshabilitada';
        indicator.className = val === 'HABILITADA'
            ? 'status-indicator-comp comp-indicator-habilitada'
            : 'status-indicator-comp comp-indicator-deshabilitada';
    }

    const select1    = dialog.querySelector('#select-comp1');
    const select2    = dialog.querySelector('#select-comp2');
    const text1      = dialog.querySelector('#text-comp1');
    const text2      = dialog.querySelector('#text-comp2');
    const indicator1 = dialog.querySelector('#indicator-comp1');
    const indicator2 = dialog.querySelector('#indicator-comp2');
    const nivel0_1   = dialog.querySelector('#nivel0-comp1');
    const nivel0_2   = dialog.querySelector('#nivel0-comp2');

    select1.addEventListener('change', () => actualizarEstadoComp(select1, text1, indicator1));
    select2.addEventListener('change', () => actualizarEstadoComp(select2, text2, indicator2));

    fetch('/cargar_config_compuertas')
        .then(r => r.json())
        .then(data => {
            select1.value  = data.compuerta1   || 'HABILITADA';
            select2.value  = data.compuerta2   || 'HABILITADA';
            nivel0_1.value = data.nivel0_comp1 !== undefined ? data.nivel0_comp1 : -8;
            nivel0_2.value = data.nivel0_comp2 !== undefined ? data.nivel0_comp2 : -8;
            actualizarEstadoComp(select1, text1, indicator1);
            actualizarEstadoComp(select2, text2, indicator2);
        })
        .catch(() => {
            actualizarEstadoComp(select1, text1, indicator1);
            actualizarEstadoComp(select2, text2, indicator2);
        });

    dialog.querySelector('#btn-actualizar-config').addEventListener('click', () => {
        guardarConfigCompuertas(
            select1.value, select2.value,
            parseFloat(nivel0_1.value), parseFloat(nivel0_2.value)
        );
    });

    const handleEscape = (e) => {
        if (e.key === 'Escape') { cerrarConfigCompuertas(); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) cerrarConfigCompuertas(); });
}

function cerrarConfigCompuertas() {
    const dialog = document.querySelector('.config-compuertas-dialog');
    if (dialog) dialog.remove();
}

function guardarConfigCompuertas(comp1, comp2, nivel0_1, nivel0_2) {
    fetch('/guardar_config_compuertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            compuerta1:   comp1,
            compuerta2:   comp2,
            nivel0_comp1: nivel0_1,
            nivel0_comp2: nivel0_2,
            timestamp:    new Date().toISOString()
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Configuración guardada correctamente', 'success');
                cerrarConfigCompuertas();
            } else {
                showNotification('Error al guardar: ' + data.mensaje, 'error');
            }
        })
        .catch(() => showNotification('Error de conexión al guardar', 'error'));
}

/* Listener único — se registra una sola vez aunque initCompuertas corra varias veces */
if (!window._configCompuertasListenerRegistered) {
    document.addEventListener('click', function (e) {
        if (e.target && e.target.closest('#btn-config-compuertas')) {
            abrirConfigCompuertas();
        }
    });
    window._configCompuertasListenerRegistered = true;
}