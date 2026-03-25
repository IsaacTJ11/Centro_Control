window.initRpf = function() {
    const rpfInput = document.getElementById('val-rpf-actual');

    const calcularLímites = () => {
        const rpf = (parseFloat(rpfInput.value) || 0) / 100;
        const celdasBase = document.querySelectorAll('.p-nom-val');
        
        celdasBase.forEach(celda => {
            const tipo = celda.dataset.type; 
            const unidad = celda.dataset.unit;
            
            // 1. Intentamos leer el valor original de un atributo data-valor. 
            // Si no existe (primera ejecución), lo tomamos del innerText y lo guardamos.
            let valorReal = celda.getAttribute('data-valor-real');
            
            if (valorReal === null) {
                valorReal = parseFloat(celda.innerText) || 0;
                celda.setAttribute('data-valor-real', valorReal);
            } else {
                valorReal = parseFloat(valorReal);
            }

            let resultado = 0;

            // 2. Mostramos el valor nominal redondeado visualmente, pero valorReal sigue intacto
            if (!isNaN(valorReal)) {
                celda.innerText = valorReal.toFixed(1);
            }

            // 3. Los cálculos se realizan SIEMPRE sobre valorReal
            if (tipo === 'min') {
                resultado = valorReal + (rpf * valorReal);
                const target = document.getElementById(`calc-min-${unidad}`);
                if(target) target.innerText = resultado.toFixed(1); 
            } else {
                resultado = valorReal - (rpf * valorReal);
                const target = document.getElementById(`calc-max-${unidad}`);
                if(target) target.innerText = resultado.toFixed(1);
            }
        });
    };

    // Función para cargar el valor RPF en JSON
    const cargarRPF = async () => {
        try {
            const response = await fetch('/cargar_rpf');
            if (response.ok) {
                const data = await response.json();
                if (data.rpf_actual !== undefined) {
                    // Mantenemos 2 decimales en el input
                    rpfInput.value = parseFloat(data.rpf_actual).toFixed(2);
                    calcularLímites();
                }
            }
        } catch (error) {
            console.error('Error al cargar RPF:', error);
        }
    };

    // Función para guardar el valor RPF en JSON
    const guardarRPF = async () => {
        const rpfValue = parseFloat(rpfInput.value) || 0;
        
        try {
            const response = await fetch('/guardar_rpf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rpf_actual: parseFloat(rpfValue.toFixed(2)),
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error('Error al guardar RPF');
            }

            const data = await response.json();
            console.log('RPF guardado:', data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    rpfInput.addEventListener('input', () => {
        calcularLímites();
        guardarRPF();
    });

    rpfInput.addEventListener('blur', () => {
        const value = parseFloat(rpfInput.value) || 0;
        rpfInput.value = value.toFixed(2);
    });

    // Ejecución inicial
    calcularLímites();
    cargarRPF();

    // Manejar hover en celdas RPF para resaltar encabezados
    document.querySelectorAll('#rpf-table tbody tr:nth-child(n+3) td:not(.bg-orange-header)').forEach(celda => {
        celda.addEventListener('mouseenter', function() {
            this.classList.add('active-cell');
            
            const colIndex = this.cellIndex;
            const table = this.closest('table');
            const row = this.closest('tr');
            const rowIndex = row.rowIndex;
            
            const bodyRowIndex = rowIndex - 2; // Índice relativo al tbody
            
            // Solo aplicar lógica si estamos en las filas 3 en adelante del tbody
            if (bodyRowIndex >= 2) {
                // Si bodyRowIndex es par (2,4,6...) actúa como calc-min
                // Si bodyRowIndex es impar (3,5,7...) actúa como calc-max
                const isMin = bodyRowIndex % 2 === 0;
                const isMax = bodyRowIndex % 2 !== 0;
                
                // Resaltar encabezado de la segunda fila (thead row 2)
                const headerRowIndex = 1;
                const headerRow = table.rows[headerRowIndex];
                
                if (isMin && headerRow) {
                    const targetCol = colIndex - 2;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.add('active-header');
                    }
                } else if (isMax && headerRow) {
                    const targetCol = colIndex - 1;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.add('active-header');
                    }
                }
                
                // Resaltar encabezados de fila
                if (isMin) {
                    const secondRowHeader = row.cells[1];
                    if (secondRowHeader) secondRowHeader.classList.add('active-header');
                } else if (isMax) {
                    const firstRowHeader = row.cells[0];
                    if (firstRowHeader) firstRowHeader.classList.add('active-header');
                }
            }
        });
        
        celda.addEventListener('mouseleave', function() {
            this.classList.remove('active-cell');
            
            const colIndex = this.cellIndex;
            const table = this.closest('table');
            const row = this.closest('tr');
            const rowIndex = row.rowIndex;
            
            const bodyRowIndex = rowIndex - 2;
            
            if (bodyRowIndex >= 2) {
                const isMin = bodyRowIndex % 2 === 0;
                const isMax = bodyRowIndex % 2 !== 0;
                
                const headerRowIndex = 1;
                const headerRow = table.rows[headerRowIndex];
                
                if (isMin && headerRow) {
                    const targetCol = colIndex - 2;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.remove('active-header');
                    }
                } else if (isMax && headerRow) {
                    const targetCol = colIndex - 1;
                    if (targetCol >= 0 && headerRow.cells[targetCol]) {
                        headerRow.cells[targetCol].classList.remove('active-header');
                    }
                }
                
                if (isMin) {
                    const secondRowHeader = row.cells[1];
                    if (secondRowHeader) secondRowHeader.classList.remove('active-header');
                } else if (isMax) {
                    const firstRowHeader = row.cells[0];
                    if (firstRowHeader) firstRowHeader.classList.remove('active-header');
                }
            }
        });
    });
};