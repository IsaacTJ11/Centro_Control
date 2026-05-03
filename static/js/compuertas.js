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

        /* ----------------------------
           2.1 Valores actuales
           ---------------------------- */
        const f = (val) => (val != null) ? parseFloat(val).toFixed(2) : "0.00";

        if (actual) {
            document.getElementById('val-apertura').value   = f(actual.apertura)       + " %";
            document.getElementById('val-caudal-comp').value = f(actual.caudal)        + " m³/s";
            document.getElementById('val-nivel-ref').value  = f(actual.nivel_embalse)  + " msnm";

            const fecha = new Date(actual.fecha);
            document.getElementById('hora-actuales').textContent =
                `(${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')})`;
        }

        /* ----------------------------
           2.2 Configuración y render ApexCharts
           ---------------------------- */

        // stroke: 'step' representa cambios discretos de apertura de compuerta
        const options = {
            series: [
                {
                    name: 'Apertura (%)',
                    data: historico.map(d => ({
                        x: new Date(d.fecha).getTime(),
                        y: d.apertura
                    }))
                },
                {
                    name: 'Caudal (m³/s)',
                    data: historico.map(d => ({
                        x: new Date(d.fecha).getTime(),
                        y: d.caudal
                    }))
                }
            ],
            chart: {
                type: 'area',
                height: 350,
                toolbar: { show: true }
            },
            colors: ['#ff6b35', '#20c997'],
            dataLabels: { enabled: false },
            stroke: { curve: 'step' },
            xaxis: { type: 'datetime' },
            yaxis: [
                {
                    title: { text: "Apertura %" },
                    min: 0,
                    max: 100
                },
                {
                    opposite: true,
                    title: { text: "Caudal m³/s" }
                }
            ],
            tooltip: { x: { format: 'dd MMM HH:mm' } }
        };

        const container = document.querySelector("#chart-compuerta-fondo");
        if (container) {
            container.innerHTML = "";
            new ApexCharts(container, options).render();
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

    /* ----------------------------
        Config compuertas — listener del ícono
        ---------------------------- */
    document.addEventListener('click', function _configClick(e) {
        if (e.target && e.target.id === 'btn-config-compuertas') {
            abrirConfigCompuertas();
        }
    });

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

            <div class="edit-form-group">
                <label class="edit-form-label">Compuerta fondo 1:</label>
                <div class="edit-tipo-select-wrapper" style="display:flex;align-items:center;gap:8px;">
                    <span class="status-indicator-comp" id="indicator-comp1"></span>
                    <span class="edit-tipo-text" id="text-comp1" style="flex:1;">HABILITADA</span>
                    <label style="font-size:12px;color:#555;white-space:nowrap;">Estado</label>
                    <select class="edit-tipo-select-inline" id="select-comp1">
                        <option value="HABILITADA">HABILITADA</option>
                        <option value="DESHABILITADA">DESHABILITADA</option>
                    </select>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                    <label style="font-size:12px;color:#555;white-space:nowrap;font-weight:600;">Nivel 0</label>
                    <div style="display:flex;align-items:center;gap:4px;flex:1;">
                        <input type="number" id="nivel0-comp1" step="0.1"
                               style="width:90px;padding:6px 8px;border:2px solid #e0e0e0;border-radius:6px;font-size:13px;text-align:right;"
                               value="-8">
                        <span style="font-size:12px;color:#666;">cm</span>
                    </div>
                </div>
            </div>

            <div class="edit-form-group">
                <label class="edit-form-label">Compuerta fondo 2:</label>
                <div class="edit-tipo-select-wrapper" style="display:flex;align-items:center;gap:8px;">
                    <span class="status-indicator-comp" id="indicator-comp2"></span>
                    <span class="edit-tipo-text" id="text-comp2" style="flex:1;">HABILITADA</span>
                    <label style="font-size:12px;color:#555;white-space:nowrap;">Estado</label>
                    <select class="edit-tipo-select-inline" id="select-comp2">
                        <option value="HABILITADA">HABILITADA</option>
                        <option value="DESHABILITADA">DESHABILITADA</option>
                    </select>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                    <label style="font-size:12px;color:#555;white-space:nowrap;font-weight:600;">Nivel 0</label>
                    <div style="display:flex;align-items:center;gap:4px;flex:1;">
                        <input type="number" id="nivel0-comp2" step="0.1"
                               style="width:90px;padding:6px 8px;border:2px solid #e0e0e0;border-radius:6px;font-size:13px;text-align:right;"
                               value="-8">
                        <span style="font-size:12px;color:#666;">cm</span>
                    </div>
                </div>
            </div>

            <div class="edit-buttons">
                <button class="btn btn-primary" id="btn-actualizar-config">
                    <i class="fas fa-check"></i> Actualizar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    function actualizarEstadoComp(select, text, indicator) {
        const val = select.value;
        text.textContent = val;
        text.className = val === 'HABILITADA'
            ? 'edit-tipo-text comp-habilitada'
            : 'edit-tipo-text comp-deshabilitada';
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
            select1.value   = data.compuerta1  || 'HABILITADA';
            select2.value   = data.compuerta2  || 'HABILITADA';
            nivel0_1.value  = data.nivel0_comp1 !== undefined ? data.nivel0_comp1 : -8;
            nivel0_2.value  = data.nivel0_comp2 !== undefined ? data.nivel0_comp2 : -8;
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
