/* ============================================================
   1. INICIALIZACIÓN
   ============================================================ */

window.initRpf = function () {
    const rpfInput = document.getElementById('val-rpf-actual');


    /* ============================================================
       2. CÁLCULO DE LÍMITES RPF
       ============================================================ */

    /* ----------------------------
       2.1 Lógica principal
       ---------------------------- */
    const calcularLímites = () => {
        const rpf        = (parseFloat(rpfInput.value) || 0) / 100;
        const celdasBase = document.querySelectorAll('.p-nom-val');

        celdasBase.forEach(celda => {
            const tipo   = celda.dataset.type;
            const unidad = celda.dataset.unit;

            /* Guardar valor original en data-valor-real al primer render
               para no perderlo si innerText es sobreescrito posteriormente */
            let valorReal = celda.getAttribute('data-valor-real');
            if (valorReal === null) {
                valorReal = parseFloat(celda.innerText) || 0;
                celda.setAttribute('data-valor-real', valorReal);
            } else {
                valorReal = parseFloat(valorReal);
            }

            // Mostrar valor nominal formateado — no afecta valorReal almacenado
            if (!isNaN(valorReal)) {
                celda.innerText = valorReal.toFixed(1);
            }

            // Calcular y mostrar límite según tipo de celda
            let resultado = 0;
            if (tipo === 'min') {
                resultado = valorReal + (rpf * valorReal);
                const target = document.getElementById(`calc-min-${unidad}`);
                if (target) target.innerText = resultado.toFixed(1);
            } else {
                resultado = valorReal - (rpf * valorReal);
                const target = document.getElementById(`calc-max-${unidad}`);
                if (target) target.innerText = resultado.toFixed(1);
            }
        });
    };


    /* ============================================================
       3. PERSISTENCIA DEL VALOR RPF
       ============================================================ */

    /* ----------------------------
       3.1 Cargar desde servidor
       ---------------------------- */
    const cargarRPF = async () => {
        try {
            const response = await fetch('/cargar_rpf');
            if (response.ok) {
                const data = await response.json();
                if (data.rpf_actual !== undefined) {
                    rpfInput.value = parseFloat(data.rpf_actual).toFixed(2);
                    calcularLímites();
                }
            }
        } catch (error) {
            console.error('Error al cargar RPF:', error);
            rpfInput.placeholder = 'Error al cargar';
        }
    };

    /* ----------------------------
       3.2 Guardar en servidor
       ---------------------------- */
    const guardarRPF = async () => {
        const rpfValue = parseFloat(rpfInput.value) || 0;
        try {
            const response = await fetch('/guardar_rpf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rpf_actual: parseFloat(rpfValue.toFixed(2)),
                    timestamp:  new Date().toISOString()
                })
            });
            if (!response.ok) throw new Error('Error al guardar RPF');
        } catch (error) {
            console.error('Error al guardar RPF:', error);
            // Feedback visual breve — borde rojo 2 segundos
            rpfInput.style.borderColor = '#dc3545';
            setTimeout(() => { rpfInput.style.borderColor = ''; }, 2000);
        }
    };


    /* ============================================================
       4. EVENTOS DEL INPUT RPF
       ============================================================ */

    rpfInput.addEventListener('input', () => {
        calcularLímites();
        guardarRPF();
    });

    rpfInput.addEventListener('blur', () => {
        const value = parseFloat(rpfInput.value) || 0;
        rpfInput.value = value.toFixed(2);
    });


    /* ============================================================
       5. HOVER EN CELDAS — RESALTADO DE ENCABEZADOS
       ============================================================ */

    /* Aplica a filas 3+ del tbody (Potencia RPF en adelante).
       El thead tiene 2 filas → rowIndex del tbody empieza en 2.
       nth-child(n+3) del tbody equivale a rowIndex=4 → bodyRowIndex=2.

       bodyRowIndex par  (2,4,6...) → fila de mínimos  (isMin = true)
       bodyRowIndex impar (3,5,7...) → fila de máximos (isMin = false)

       Para resaltar encabezados de columna se usa thead fila 2 (index 1),
       que contiene los nombres de unidades (U1, U2, U3...).             */

    document.querySelectorAll(
        '#rpf-table tbody tr:nth-child(n+3) td:not(.bg-orange-header)'
    ).forEach(celda => {

        celda.addEventListener('mouseenter', function () {
            this.classList.add('active-cell');

            const colIndex     = this.cellIndex;
            const table        = this.closest('table');
            const row          = this.closest('tr');
            const bodyRowIndex = row.rowIndex - 2;  // -2 por las 2 filas del thead

            if (bodyRowIndex >= 2) {
                const isMin     = bodyRowIndex % 2 === 0;
                const headerRow = table.rows[1];    // thead fila 2: encabezados de unidades

                if (isMin && headerRow) {
                    const targetCol = colIndex - 2;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.add('active-header');
                    }
                    row.cells[1]?.classList.add('active-header');   // encabezado lateral Mín
                } else if (!isMin && headerRow) {
                    const targetCol = colIndex - 1;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.add('active-header');
                    }
                    row.cells[0]?.classList.add('active-header');   // encabezado lateral Máx
                }
            }
        });

        celda.addEventListener('mouseleave', function () {
            this.classList.remove('active-cell');

            const colIndex     = this.cellIndex;
            const table        = this.closest('table');
            const row          = this.closest('tr');
            const bodyRowIndex = row.rowIndex - 2;

            if (bodyRowIndex >= 2) {
                const isMin     = bodyRowIndex % 2 === 0;
                const headerRow = table.rows[1];

                if (isMin && headerRow) {
                    const targetCol = colIndex - 2;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.remove('active-header');
                    }
                    row.cells[1]?.classList.remove('active-header');
                } else if (!isMin && headerRow) {
                    const targetCol = colIndex - 1;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.remove('active-header');
                    }
                    row.cells[0]?.classList.remove('active-header');
                }
            }
        });
    });


    /* ============================================================
       6. EJECUCIÓN INICIAL
       ============================================================ */

    calcularLímites();
    cargarRPF();

}; // fin window.initRpf
