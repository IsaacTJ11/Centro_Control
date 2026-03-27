<<<<<<< HEAD
// Variables for Drag & Drop
let draggedElement = null;
let draggedData = null;
let dropIndicator = null;
let mergeIndicator = null;

window.initReportes = function() {

    /* ===============================
       Restaurar filtros
    =============================== */
    const filterState = getFilterState();

    updateViewStateButton(filterState.viewState);

    Object.keys(filterState.tipos).forEach(tipo => {
        const btn = document.querySelector(`.filter-tipo-btn[data-tipo="${tipo}"]`);
        if (btn) {
            btn.classList.toggle('active', filterState.tipos[tipo]);
            btn.classList.toggle('inactive', !filterState.tipos[tipo]);
        }
    });

    applyAllFilters();

    /* ===============================
       Switches de aerogeneradores
    =============================== */
    const switchAero = document.getElementById('show-all-aerogeneradores');
    const switchAeroMant = document.getElementById('show-all-aerogeneradores-mantenimiento');

    if (switchAero) switchAero.checked = false;
    if (switchAeroMant) switchAeroMant.checked = false;

    if (document.getElementById('aerogeneradores-falla')) {
        toggleAerogeneradoresView();
    }

    if (document.getElementById('aerogeneradores-mantenimiento')) {
        toggleAerogeneradoresMantenimientoView();
    }

    /* ===============================
       Inicializaciones generales
    =============================== */
    initializeEditListeners();

    if (document.querySelector('.toggle-table-button')) {
        if (typeof loadDailyReportData === "function") {
            loadDailyReportData();
        }
    }

    /* ===============================
    Actualización AJAX cada 1 minuto
    =============================== */
    setInterval(() => {
        updateEquipmentData();
    }, 60 * 1000); // 1 minuto

    if (document.querySelector('.toggle-table-button')) {
        if (typeof loadDailyReportData === "function") {
            loadDailyReportData();
        }
    }

    // Inicializar filtros solar
    const solarFilterState = getSolarFilterState();
    updateViewStateSolarButton(solarFilterState.viewState);
    Object.keys(solarFilterState.tipos).forEach(tipo => {
        const btn = document.querySelector(`.filter-tipo-btn-solar[data-tipo="${tipo}"]`);
        if (btn) {
            btn.classList.toggle('active', solarFilterState.tipos[tipo]);
            btn.classList.toggle('inactive', !solarFilterState.tipos[tipo]);
        }
    });
    applyAllFiltersSolar();

};

// function toggleAerogeneradoresMantenimientoView() {
//     const checkbox = document.getElementById('show-all-aerogeneradores-mantenimiento');
//     const label = document.getElementById('aerogeneradores-mantenimiento-label');
//     const aerogeneradores = document.querySelectorAll('#aerogeneradores-mantenimiento .equipment-item');

//     if (!checkbox) return;

//     if (checkbox.checked) {
//         label.textContent = 'Todos';
//         aerogeneradores.forEach(aerogenerador => {
//             aerogenerador.style.display = 'flex';
//         });
//     } else {
//         label.textContent = 'Activos';
//         aerogeneradores.forEach(aerogenerador => {
//             if (aerogenerador.classList.contains('ok')) {
//                 aerogenerador.style.display = 'none';
//             } else {
//                 aerogenerador.style.display = 'flex';
//             }
//         });
//     }
// }

// Funcionalidad de edición de registros
function initializeEditListeners() {
    const equipmentNames = document.querySelectorAll('.equipment-name');
    equipmentNames.forEach(name => {
        // Siempre remover y reagregar listener para evitar duplicados
        name.removeEventListener('click', handleEditClick);
        name.addEventListener('click', handleEditClick);
        
        // Solo agregar tooltip si no existe
        if (!name.querySelector('.equipment-name-tooltip')) {
            const item = name.closest('.equipment-item');
            let tipo = item.getAttribute('data-tipo');
            const circuito = item.getAttribute('data-circuito');
            let tipoDisplay = tipo === 'MANT' ? 'MANTENIMIENTO' : tipo;

            const tooltip = document.createElement('div');
            tooltip.className = 'equipment-name-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <span class="status-indicator status-${tipo}"></span>
                    <span class="tooltip-tipo-text tipo-${tipo}">${tipoDisplay}</span>
                </div>
                <div class="tooltip-circuito">C-${circuito.toString().padStart(2, '0')}</div>
            `;

            name.appendChild(tooltip);
        }
    });
}

function handleEditClick(e) {
    e.stopPropagation();
    const item = this.closest('.equipment-item');
    const recordId = item.getAttribute('data-id');
    
    // Obtener solo el texto directo del elemento (sin el tooltip)
    let nombre = '';
    for (let node of this.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            nombre += node.textContent;
        }
    }
    nombre = nombre.trim();
    
    console.log('Click en:', nombre, 'ID:', recordId); // Debug
    
    // Verificar si es registro unificado por el asterisco en el nombre
    const isUnified = nombre.includes('*');
    
    if (isUnified) {
        const componentsDataStr = item.getAttribute('data-components');
        console.log('Es unificado. data-components:', componentsDataStr); // Debug
        
        if (!componentsDataStr || componentsDataStr === 'null') {
            console.error('ERROR: Registro unificado sin data-components');
            alert('Error: Este registro no tiene datos de componentes.');
            return;
        }
        
        try {
            const componentsData = JSON.parse(componentsDataStr);
            const nombreLimpio = nombre.replace('*', '');
            showUnifiedRecordsDialog(componentsData, nombreLimpio);
        } catch (error) {
            console.error('ERROR parsing components:', error);
            alert('Error al procesar los datos del registro');
        }
        return;
    }
    
    // Si no es unificado, mostrar diálogo de edición normal
    const statusIndicator = item.querySelector('.status-indicator');

    // Extraer el tipo desde la clase status-TIPO
    let tipo = 'FALLA';
    const classes = statusIndicator.className.split(' ');
    classes.forEach(cls => {
        if (cls.startsWith('status-') && cls !== 'status-indicator') {
            tipo = cls.replace('status-', '');
        }
    });

    // Obtener circuito
    let circuito = item.getAttribute('data-circuito');

    // Si no tiene data-circuito, intentar extraerlo del contenido
    if (!circuito || circuito === 'N/A') {
        const allItems = document.querySelectorAll('.equipment-item');
        allItems.forEach(otherItem => {
            if (otherItem.getAttribute('data-id') === recordId) {
                circuito = otherItem.getAttribute('data-circuito') || 'N/A';
            }
        });
    }

    // Obtener datos del registro
    const recordData = {
        id: recordId,
        nombre: nombre,
        circuito: circuito,
        tipo: tipo,
        tecnologia: item.getAttribute('data-tecnologia') || 'wind',  // <- agregar esta línea
        fecha_inicio: item.querySelectorAll('.equipment-fecha')[0].textContent.trim(),
        fecha_fin: item.querySelectorAll('.equipment-fecha')[1].textContent.trim()
    };

    showEditDialog(recordData);
}

function showUnifiedRecordsDialog(components, nombre) {
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';
    
    // Extraer solo el nombre del aero (eliminar asterisco y cualquier sufijo)
    const nombreAero = nombre.replace('*', '').split(' ')[0]; // Solo "WTG18"
    const numRegistros = components.length.toString().padStart(2, '0');
    
    let contentHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeUnifiedRecordsDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>${nombreAero} - ${numRegistros} registros continuos</h3>
            </div>
            <div style="margin-bottom: 20px;">
    `;
    
    components.forEach((comp, index) => {
        const tipoDisplay = comp.tipo === 'MANT' ? 'MANTENIMIENTO' : comp.tipo;
        contentHTML += `
            <div class="merge-option compact-merge-option" 
                data-record-id="${comp.id}" 
                data-record-nombre="${comp.nombre}" 
                data-record-circuito="${comp.circuito}" 
                data-record-tipo="${comp.tipo}" 
                data-record-fecha-inicio="${comp.fecha_inicio}" 
                data-record-fecha-fin="${comp.fecha_fin || ''}">
                <div class="merge-option-title">
                    <span class="status-indicator status-${comp.tipo}"></span>
                    ${comp.nombre} - ${tipoDisplay}
                </div>
                <div class="merge-option-dates">
                    ${comp.fecha_inicio} - ${comp.fecha_fin || 'Continúa'}
                </div>
            </div>
        `;
        
        // Agregar indicador de tiempo entre registros (excepto después del último)
        if (index < components.length - 1) {
            const nextComp = components[index + 1];
            const tiempoEntreRegistros = calcularTiempoEntreRegistros(comp.fecha_fin, nextComp.fecha_inicio);
            
            contentHTML += `
                <div class="time-between-records">
                    <i class="fa-solid fa-arrow-down"></i>
                    <span>${tiempoEntreRegistros} min</span>
                </div>
            `;
        }
    });
    
    contentHTML += `
        <div style="margin-top: 20px; text-align: center; padding: 0 20px;">
            <button class="btn btn-secondary" onclick='showUnmergeOptions(${JSON.stringify(components)})'>
                <i class="fa-solid fa-unlink"></i>
                Separar
            </button>
        </div>
    `;

    contentHTML += '</div></div>';
    dialog.innerHTML = contentHTML;
    
    dialog.innerHTML = contentHTML;

    document.body.appendChild(dialog);

    setTimeout(() => {
        dialog.classList.add('show');
        
        // Agregar listeners de click a cada opción
        const mergeOptions = dialog.querySelectorAll('.merge-option.compact-merge-option');
        mergeOptions.forEach(option => {
            option.addEventListener('click', function() {
                const recordData = {
                    id: this.getAttribute('data-record-id'),
                    nombre: this.getAttribute('data-record-nombre'),
                    circuito: this.getAttribute('data-record-circuito'),
                    tipo: this.getAttribute('data-record-tipo'),
                    fecha_inicio: this.getAttribute('data-record-fecha-inicio'),
                    fecha_fin: this.getAttribute('data-record-fecha-fin')
                };
                
                closeUnifiedRecordsDialog();
                showEditDialog(recordData);
            });
        });
    }, 10);
    
    // Agregar event listeners a las opciones
    const options = dialog.querySelectorAll('.merge-option');
    options.forEach(option => {
        option.addEventListener('click', function() {
            const recordData = {
                id: this.getAttribute('data-record-id'),
                nombre: this.getAttribute('data-record-nombre'),
                circuito: this.getAttribute('data-record-circuito'),
                tipo: this.getAttribute('data-record-tipo'),
                fecha_inicio: this.getAttribute('data-record-fecha-inicio'),
                fecha_fin: this.getAttribute('data-record-fecha-fin')
            };
            closeUnifiedRecordsDialog();
            showEditDialog(recordData);
        });
    });
    
    const handleEscape = function(e) {
        if (e.key === 'Escape') {
            closeUnifiedRecordsDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) closeUnifiedRecordsDialog();
    });
}

function calcularTiempoEntreRegistros(fechaFin, fechaInicio) {
    if (!fechaFin || fechaFin.trim() === '') return '0';
    
    const fecha1 = parseFechaFromString(fechaFin);
    const fecha2 = parseFechaFromString(fechaInicio);
    
    if (!fecha1 || !fecha2) return '0';
    
    const diffMinutes = Math.round((fecha2 - fecha1) / (1000 * 60));
    return diffMinutes.toString();
}

function closeUnifiedRecordsDialog() {
    const dialog = document.querySelector('.merge-select-dialog');
    if (dialog) dialog.remove();
}

// function openComponentRecord(recordId) {
//     closeUnifiedRecordsDialog();
    
//     // Buscar el item original en el DOM
//     const allItems = document.querySelectorAll('.equipment-item');
//     let recordData = null;
    
//     allItems.forEach(item => {
//         if (item.getAttribute('data-unified') === 'true') {
//             const components = JSON.parse(item.getAttribute('data-components'));
//             const found = components.find(c => c.id === recordId);
//             if (found) {
//                 recordData = {
//                     id: found.id,
//                     nombre: found.nombre,
//                     circuito: found.circuito,
//                     tipo: found.tipo,
//                     fecha_inicio: found.fecha_inicio,
//                     fecha_fin: found.fecha_fin || ''
//                 };
//             }
//         }
//     });
    
//     if (recordData) {
//         showEditDialog(recordData);
//     }
// }

function showEditDialog(data) {
    const fechaInicioInput = convertToDatetimeLocal(data.fecha_inicio);
    const fechaFinInput = data.fecha_fin ? convertToDatetimeLocal(data.fecha_fin) : '';
    const hasFechaFin = data.fecha_fin && data.fecha_fin.trim() !== '';
    const tipoDisplay = data.tipo === 'MANT' ? 'MANTENIMIENTO' : data.tipo;

    // Para solar solo FALLA y MANT; para eólica todos
    const esSolar = data.tecnologia === 'solar';
    const tiposOrden = esSolar
        ? ['FALLA', 'MANTENIMIENTO']
        : ['PAUSA', 'STOP', 'FALLA', 'MANTENIMIENTO'];

    const tiposOptions = tiposOrden
        .map(t => {
            const value = t === 'MANTENIMIENTO' ? 'MANT' : t;
            const selected = value === data.tipo ? 'selected' : '';
            return `<option value="${value}" ${selected}>${t}</option>`;
        })
        .join('');

    const dialog = document.createElement('div');
    dialog.className = 'edit-dialog';
    dialog.innerHTML = `
        <div class="edit-dialog-content">
            <button class="dialog-close-btn" onclick="closeEditDialog()">&times;</button>
            <div class="edit-dialog-header">
                <i class="fas fa-edit"></i>
                <h3>${data.nombre}</h3>
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Circuito:</label>
                <div class="edit-circuito-display">${data.circuito}</div>
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Tipo:</label>
                <div class="edit-tipo-select-wrapper">
                    <span class="status-indicator status-${data.tipo}" id="tipo-indicator"></span>
                    <span class="edit-tipo-text" id="tipo-text">${tipoDisplay}</span>
                    <select class="edit-tipo-select" id="edit-tipo">
                        ${tiposOptions}
                    </select>
                </div>
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Fecha Inicio:</label>
                <input type="datetime-local" class="edit-form-input" id="edit-fecha-inicio" value="${fechaInicioInput}" step="60">
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Fecha Fin:</label>
                <input type="datetime-local" class="edit-form-input" id="edit-fecha-fin" value="${fechaFinInput}" ${!hasFechaFin ? 'disabled' : ''} step="60">
            </div>
            
            <div class="edit-buttons">
                <button class="btn btn-danger" style="margin-right: auto;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
                <button class="btn btn-merge">
                    <i class="fa-solid fa-link"></i> Unir
                </button>
                <button class="btn btn-primary" id="btn-actualizar-edit">
                    <i class="fas fa-check"></i> Actualizar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Event listeners para los botones
    dialog.querySelector('.btn-danger').addEventListener('click', function() {
        confirmDelete(data.id, data.nombre);
    });

    dialog.querySelector('.btn-merge').addEventListener('click', function() {
        showMergeSelectDialog(data.id, data.nombre, data.tipo, data.fecha_inicio, data.fecha_fin || '');
    });

    const tipoSelect = dialog.querySelector('#edit-tipo');
    const tipoIndicator = dialog.querySelector('#tipo-indicator');
    const tipoText = dialog.querySelector('#tipo-text');

    tipoSelect.addEventListener('change', function () {
        const newTipo = this.value;
        const newTipoDisplay = newTipo === 'MANT' ? 'MANTENIMIENTO' : newTipo;
        tipoIndicator.className = `status-indicator status-${newTipo}`;
        tipoText.textContent = newTipoDisplay;
    });

    const btnActualizar = dialog.querySelector('#btn-actualizar-edit');
    btnActualizar.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        confirmEdit(data.id, data.fecha_inicio, data.fecha_fin, hasFechaFin, data.tipo);
    });

    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeEditDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeEditDialog();
    });
}

function closeEditDialog() {
    const dialog = document.querySelector('.edit-dialog');
    if (dialog) dialog.remove();
}

function convertToDatetimeLocal(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return '';
    const [fecha, hora] = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const anioCompleto = anio.length === 2 ? '20' + anio : anio;
    return `${anioCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${hora}`;
}

function convertFromDatetimeLocal(datetimeStr) {
    if (!datetimeStr) return null;
    const [fecha, hora] = datetimeStr.split('T');
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio} ${hora}`;
}

function confirmEdit(recordId, originalFechaInicio, originalFechaFin, hasFechaFin, originalTipo, tecnologia) {
    const newFechaInicio = document.getElementById('edit-fecha-inicio').value;
    const newFechaFin = document.getElementById('edit-fecha-fin').value;
    const newTipo = document.getElementById('edit-tipo').value;

    if (!newFechaInicio) {
        showNotification('Debe ingresar una fecha de inicio', 'error');
        return;
    }

    const newFechaInicioFormatted = convertFromDatetimeLocal(newFechaInicio);
    const newFechaFinFormatted = hasFechaFin && newFechaFin ? convertFromDatetimeLocal(newFechaFin) : null;

    const fechaInicioChanged = newFechaInicioFormatted !== originalFechaInicio;
    const fechaFinChanged = hasFechaFin && newFechaFinFormatted && newFechaFinFormatted !== originalFechaFin;
    const tipoChanged = newTipo !== originalTipo;

    if (!fechaInicioChanged && !fechaFinChanged && !tipoChanged) {
        showNotification('No se realizaron cambios', 'info');
        closeEditDialog();
        return;
    }

    const updateData = {
        id: recordId,
        fecha_inicio: newFechaInicioFormatted,
        tipo: newTipo
    };

    if (hasFechaFin && newFechaFinFormatted) {
        updateData.fecha_fin = newFechaFinFormatted;
    }

    const endpoint = tecnologia === 'solar'
        ? '/api/update-solar-equipment'
        : '/api/update-equipment';

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registro actualizado correctamente', 'success');
                closeEditDialog();
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showNotification('Error al actualizar: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión al actualizar', 'error');
        });
}

function confirmDelete(recordId, nombre) {
    closeEditDialog();

    const dialog = document.createElement('div');
    dialog.className = 'merge-dialog';
    dialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeDeleteDialog()">&times;</button>
            <h3><i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> Confirmar Eliminación</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Esta acción no se puede deshacer.
                </div>
                <div class="delete-question">
                    ¿Está seguro de eliminar el registro de <strong>${nombre}</strong>?
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-danger" onclick="executeDelete('${recordId}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeDeleteDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeDeleteDialog();
    });
}

function closeDeleteDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeDelete(recordId) {
    closeDeleteDialog();

    fetch('/api/mark-deleted-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registro eliminado correctamente', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showNotification('Error al eliminar: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión al eliminar', 'error');
        });
}

function deleteEquipment(recordId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) {
        return;
    }
    
    fetch('/api/mark-deleted-equipment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: recordId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Registro eliminado correctamente', 'success');
            closeEditDialog();
            // Actualizar datos para reflejar el cambio
            setTimeout(() => {
                updateEquipmentData();
            }, 500);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    });
}

function generateDailyReport() {
    let button = event?.target?.closest('button');
    if (!button) {
        button = document.querySelector('button[onclick="generateDailyReport()"]');
    }

    let icon = null;
    if (button) {
        icon = button.querySelector('i') || button.querySelector('.fas');
    }

    if (icon) {
        const originalClasses = icon.className;
        icon.className = 'fas fa-spinner fa-spin';
        icon.dataset.originalClasses = originalClasses;
    }

    if (button) button.disabled = true;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    // 23:30 = 1410 min, 02:00 = 120 min
    const isInTimeRange = currentTime >= 1410 || currentTime <= 120;

    if (!isInTimeRange) {
        showTimeWarningDialog();
    }

    // Cargar datos
    if (typeof loadDailyReportData === "function") {
        loadDailyReportData();
    }
}

function showTimeWarningDialog() {
    if (document.querySelector('.time-warning-dialog')) return; // Avoid duplicates

    const dialog = document.createElement('div');
    dialog.className = 'merge-dialog time-warning-dialog';
    dialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeTimeWarningDialog()">&times;</button>
            <h3><i class="fas fa-clock" style="color: #ffc107;"></i> Advertencia de Horario</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="time-warning-text">Está visualizando el reporte fuera del horario establecido (23:30 - 02:00).</span>
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-primary" onclick="closeTimeWarningDialog()">
                    <i class="fas fa-check"></i> Entendido
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeTimeWarningDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeTimeWarningDialog();
    });
}

function closeTimeWarningDialog() {
    const dialog = document.querySelector('.time-warning-dialog');
    if (dialog) dialog.remove();
}

function executeGenerateReport() {
    if (typeof loadDailyReportData === "function") {
        loadDailyReportData();
    }
}

function toggleTableVisibility() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const button = document.querySelector('.toggle-table-button');
    const icon = button.querySelector('i');

    if (tableWrapper.classList.contains('hidden')) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours * 60 + minutes;
        const isInTimeRange = currentTime >= 1410 || currentTime <= 120;

        if (!isInTimeRange) {
            showTimeWarningDialog();
        }
    }

    tableWrapper.classList.toggle('hidden');

    if (tableWrapper.classList.contains('hidden')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-up';
    }
}

function showMergeDialog(currentId, currentNombre) {
    // Cerrar diálogo de edición
    closeEditDialog();
    
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';
    dialog.id = 'merge-dialog';
    
    // Obtener todos los registros visibles del mismo aerogenerador
    const items = Array.from(document.querySelectorAll('.equipment-item'));
    const aeroNum = currentNombre.replace('WTG', '').replace('*', '').trim();
    const sameAeroItems = items.filter(item => {
        // Verificar que sea del mismo aerogenerador
        const itemNombre = item.querySelector('.equipment-name').textContent.replace('*', '').trim();
        const isSameAero = itemNombre === `WTG${aeroNum}`;
        
        // Verificar que sea diferente al actual
        const isDifferent = item.getAttribute('data-id') !== currentId;
        
        // Verificar que esté visible (no filtrado)
        const isVisible = !item.classList.contains('filtered-out') && item.style.display !== 'none';
        
        return isSameAero && isDifferent && isVisible;
    });
    
    let optionsHTML = '';
    
    if (sameAeroItems.length === 0) {
        optionsHTML = '<p style="text-align: center; color: #999;">No hay otros registros visibles del mismo aerogenerador para unir</p>';
    } else {
        sameAeroItems.forEach(item => {
            const id = item.getAttribute('data-id');
            const nombre = item.querySelector('.equipment-name').textContent.trim();
            const tipo = item.getAttribute('data-tipo');
            const tipoDisplay = tipo === 'MANT' ? 'MANTENIMIENTO' : tipo;
            const fechaInicio = item.querySelectorAll('.equipment-fecha')[0].textContent.trim();
            const fechaFin = item.querySelectorAll('.equipment-fecha')[1].textContent.trim() || 'Continúa';
            
            optionsHTML += `
                <div class="merge-option" onclick="confirmMerge('${currentId}', '${id}')">
                    <div class="merge-option-title">
                        <span class="status-indicator status-${tipo}"></span>
                        ${nombre} - ${tipoDisplay}
                    </div>
                    <div class="merge-option-dates">
                        ${fechaInicio} - ${fechaFin}
                    </div>
                </div>
            `;
        });
    }
    
    dialog.innerHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeMergeDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>Unir ${currentNombre} con:</h3>
            </div>
            <div class="merge-options-container">
                ${optionsHTML}
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    setTimeout(() => {
        dialog.classList.add('show');
    }, 10);
}

function closeMergeDialog() {
    const dialog = document.getElementById('merge-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        setTimeout(() => dialog.remove(), 300);
    }
}

function confirmMerge(currentId, nextId) {
    if (!confirm('¿Estás seguro de que deseas unir estos registros?')) {
        return;
    }
    
    fetch('/api/merge-equipment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            current_id: currentId,
            next_id: nextId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Registros unidos correctamente', 'success');
            closeMergeDialog();
            setTimeout(() => {
                updateEquipmentData();
            }, 500);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    });
}

// Merge functionality
function showMergeSelectDialog(currentId, currentNombre, currentTipo, currentFechaInicio, currentFechaFin) {
    // Determinar el grupo de tipos
    const tiposFalla = ['FALLA', 'STOP', 'PAUSA'];
    const tiposMant = ['MANT'];

    const grupoActual = tiposFalla.includes(currentTipo) ? 'falla' : 'mantenimiento';

    // Buscar todos los items del mismo aerogenerador
    const allItems = document.querySelectorAll('.equipment-item');
    const matchingItems = [];

    allItems.forEach(item => {
        const itemId = item.getAttribute('data-id');

        if (itemId === currentId) return;

        // Leer solo nodos de texto ignorando tooltip
        const nameEl = item.querySelector('.equipment-name');
        let itemNombrePuro = '';
        for (let node of nameEl.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) itemNombrePuro += node.textContent;
        }
        itemNombrePuro = itemNombrePuro.trim().replace('*', '').trim();
        const currentNombreNorm = currentNombre.replace('*', '').trim();

        if (itemNombrePuro !== currentNombreNorm) return;

        // Determinar tipo del item
        const statusIndicator = item.querySelector('.status-indicator');
        let itemTipo = 'FALLA';
        item.querySelector('.status-indicator').className.split(' ').forEach(cls => {
            if (cls.startsWith('status-')) itemTipo = cls.replace('status-', '');
        });

        // Solo mismo grupo (falla o mantenimiento)
        const grupoItem = tiposFalla.includes(itemTipo) ? 'falla' : 'mantenimiento';
        if (grupoItem !== grupoActual) return;

        const fechas = item.querySelectorAll('.equipment-fecha');
        const itemFechaInicioStr = fechas[0].textContent.trim();
        const itemFechaFinStr = fechas[1].textContent.trim();

        // --- Filtro 1: duración mínima de 58 minutos ---
        const tiempoEl = item.querySelector('.equipment-time');
        const tiempoStr = tiempoEl ? tiempoEl.textContent.replace('(', '').replace(')', '').trim() : '';
        const totalMinutos = extractTotalMinutos(tiempoStr);
        if (totalMinutos < 58) return;

        // --- Filtro 2: fecha_fin no anterior a hace 24 horas (o sin fecha_fin = activo) ---
        if (itemFechaFinStr !== '') {
            const fechaFin = parseFecha(itemFechaFinStr);
            const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (fechaFin <= hace24h) return;
        }

        matchingItems.push({
            id: itemId,
            nombre: nameEl.textContent.trim(),
            tipo: itemTipo,
            fecha_inicio: itemFechaInicioStr,
            fecha_fin: itemFechaFinStr
        });
    });

    // Crear el diálogo
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';

    let contentHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeMergeSelectDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>Seleccionar registro para unir con ${currentNombre}</h3>
            </div>
    `;

    if (matchingItems.length === 0) {
        contentHTML += `
            <div class="merge-no-records">
                <i class="fas fa-info-circle"></i>
                <p>No hay otros registros de ${currentNombre} del mismo tipo disponibles para unir.</p>
            </div>
        `;
    } else {
        contentHTML += '<div style="margin-bottom: 20px;">';

        matchingItems.forEach(item => {
            const tipoDisplay = item.tipo === 'MANT' ? 'MANTENIMIENTO' : item.tipo;
            contentHTML += `
                <div class="merge-option" onclick="selectMergeOption(this, '${item.id}', '${item.fecha_inicio}', '${item.fecha_fin}')">
                    <div class="merge-option-title">
                        <span class="status-indicator status-${item.tipo}"></span>
                        ${item.nombre} - ${tipoDisplay}
                    </div>
                    <div class="merge-option-dates">
                        ${item.fecha_inicio} - ${item.fecha_fin || 'Continúa'}
                    </div>
                </div>
            `;
        });

        contentHTML += `
            </div>
            <div class="edit-buttons">
                <button class="btn btn-primary" id="btn-confirm-merge" disabled>
                    <i class="fas fa-check"></i> Unir
                </button>
            </div>
        `;
    }

    contentHTML += '</div>';
    dialog.innerHTML = contentHTML;

    document.body.appendChild(dialog);

    // Guardar datos actuales para usar después
    dialog.dataset.currentId = currentId;
    dialog.dataset.currentNombre = currentNombre;
    dialog.dataset.currentFechaInicio = currentFechaInicio;
    dialog.dataset.currentFechaFin = currentFechaFin;

    // Event listener para el botón de confirmar
    const btnConfirm = dialog.querySelector('#btn-confirm-merge');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
            const selectedOption = dialog.querySelector('.merge-option.selected');
            if (selectedOption) {
                const targetId = selectedOption.dataset.targetId;
                const targetFechaInicio = selectedOption.dataset.targetFechaInicio;
                const targetFechaFin = selectedOption.dataset.targetFechaFin;

                confirmMergeFromSelect(currentId, currentFechaInicio, currentFechaFin,
                    targetId, targetFechaInicio, targetFechaFin, currentNombre);
            }
        });
    }

    // Cerrar con tecla Escape
    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeMergeSelectDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeMergeSelectDialog();
    });
}

function selectMergeOption(element, targetId, targetFechaInicio, targetFechaFin) {
    // Remover selección anterior
    const dialog = element.closest('.merge-select-dialog');
    dialog.querySelectorAll('.merge-option').forEach(opt => opt.classList.remove('selected'));

    // Seleccionar actual
    element.classList.add('selected');

    // Guardar datos en el elemento
    element.dataset.targetId = targetId;
    element.dataset.targetFechaInicio = targetFechaInicio;
    element.dataset.targetFechaFin = targetFechaFin;

    // Habilitar botón de confirmar
    const btnConfirm = dialog.querySelector('#btn-confirm-merge');
    if (btnConfirm) {
        btnConfirm.disabled = false;
    }
}

function closeMergeSelectDialog() {
    const dialog = document.querySelector('.merge-select-dialog');
    if (dialog) dialog.remove();
}

function confirmMergeFromSelect(currentId, currentFechaInicio, currentFechaFin,
    targetId, targetFechaInicio, targetFechaFin, nombre) {
    // Calcular diferencia de tiempo
    const fecha1 = currentFechaFin ? parseFecha(currentFechaFin) : null;
    const fecha2 = parseFecha(targetFechaInicio);

    let diffMinutes = 0;
    let warningMessage = '';

    if (fecha1) {
        diffMinutes = Math.abs((fecha2 - fecha1) / (1000 * 60));

        if (diffMinutes > 70) {
            warningMessage = `El tiempo entre registros es mayor a 70 minutos (${Math.round(diffMinutes)} min). `;
        }
    }

    // Determinar cuál registro mantener (el más antiguo)
    const fecha1Date = parseFecha(currentFechaInicio);
    const fecha2Date = parseFecha(targetFechaInicio);

    const keepId = fecha1Date < fecha2Date ? currentId : targetId;
    const deleteId = fecha1Date < fecha2Date ? targetId : currentId;
    const newFechaFin = fecha1Date < fecha2Date ? targetFechaFin : currentFechaFin;

    if (warningMessage) {
        // Mostrar advertencia antes de unir
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'merge-dialog';
        confirmDialog.innerHTML = `
            <div class="merge-dialog-content">
                <button class="dialog-close-btn" onclick="closeWarningMergeDialog()">&times;</button>
                <h3><i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i> Advertencia</h3>
                <div class="merge-warning" style="margin: 20px 0;">
                    <i class="fas fa-info-circle"></i>
                    ${warningMessage}¿Desea continuar con la unión?
                </div>
                <div class="merge-buttons">
                    <button class="btn btn-primary" onclick="executeMerge('${keepId}', '${deleteId}', '${newFechaFin}')">
                        <i class="fas fa-check"></i> Continuar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        // Cerrar con tecla Escape
        const handleEscape = function (e) {
            if (e.key === 'Escape') {
                closeWarningMergeDialog();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        confirmDialog.addEventListener('click', function (e) {
            if (e.target === confirmDialog) closeWarningMergeDialog();
        });
    } else {
        // Unir directamente sin advertencia
        executeMerge(keepId, deleteId, newFechaFin);
    }

    closeMergeSelectDialog();
    closeEditDialog();
}

function closeWarningMergeDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function showUnmergeOptions(components) {
    if (components.length <= 2) {
        // Si solo hay 2 registros, separar directamente el primero
        confirmUnmerge(components[0].id);
    } else {
        // Si hay más de 2, mostrar opciones
        closeUnifiedRecordsDialog();
        
        const dialog = document.createElement('div');
        dialog.className = 'merge-select-dialog';
        dialog.id = 'unmerge-dialog';
        
        let optionsHTML = '';
        
        // Mostrar todos excepto el último (el último no tiene 'unido')
        for (let i = 0; i < components.length - 1; i++) {
            const comp = components[i];
            const tipoDisplay = comp.tipo === 'MANT' ? 'MANTENIMIENTO' : comp.tipo;
            
            optionsHTML += `
                <div class="merge-option" onclick="confirmUnmerge('${comp.id}')">
                    <div class="merge-option-title">
                        <span class="status-indicator status-${comp.tipo}"></span>
                        ${comp.nombre} - ${tipoDisplay}
                    </div>
                    <div class="merge-option-dates">
                        Separar después de este registro
                    </div>
                </div>
            `;
        }
        
        dialog.innerHTML = `
            <div class="merge-select-content">
                <button class="dialog-close-btn" onclick="closeUnmergeDialog()">&times;</button>
                <div class="merge-select-header">
                    <i class="fa-solid fa-unlink"></i>
                    <h3>Seleccionar punto de separación</h3>
                </div>
                <div class="merge-options-container">
                    ${optionsHTML}
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        setTimeout(() => {
            dialog.classList.add('show');
        }, 10);
    }
}

function closeUnmergeDialog() {
    const dialog = document.getElementById('unmerge-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        setTimeout(() => dialog.remove(), 300);
    }
}

function confirmUnmerge(recordId) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'merge-dialog';
    
    confirmDialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeConfirmUnmergeDialog()">&times;</button>
            <h3><i class="fa-solid fa-unlink"></i> Confirmar Separación</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Esta acción modificará la relación entre los registros unidos.
                </div>
                <div class="delete-question">
                    ¿Estás seguro de que deseas separar estos registros?
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-danger" onclick="executeUnmerge('${recordId}')">
                    <i class="fa-solid fa-unlink"></i>
                    Separar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmDialog);
    
    setTimeout(() => {
        confirmDialog.classList.add('show');
    }, 10);
}

function closeConfirmUnmergeDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeUnmerge(recordId) {
    fetch('/api/unmerge-equipment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            record_id: recordId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Registros separados correctamente', 'success');
            closeConfirmUnmergeDialog();
            closeUnmergeDialog();
            closeUnifiedRecordsDialog();
            setTimeout(() => {
                updateEquipmentData();
            }, 500);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    });
}

function parseFecha(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return null;
    const [fecha, hora] = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const [horas, minutos] = hora ? hora.split(':') : ['0', '0'];
    const anioCompleto = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

function executeMerge(keepId, deleteId, newFechaFin) {
    closeWarningMergeDialog();

    fetch('/api/merge-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            current_id: keepId,
            next_id: deleteId
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registros unidos correctamente', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showNotification('Error al unir: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión al unir registros', 'error');
        });
}

function updateEquipmentData() {
    // Actualizar eólica
    fetch('/api/get-wind-data')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateEquipmentSection('aerogeneradores-wayra-i', data.data.wayra_i, false);
                updateEquipmentSection('aerogeneradores-wayra-ext', data.data.wayra_ext, false);
                initializeEditListeners();
                applyAllFilters();
            }
        })
        .catch(error => console.error('Error al actualizar datos eólicos:', error));

    // Actualizar solar
    fetch('/api/get-solar-data')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateEquipmentSectionSolar('inversores-rubi', data.data.rubi);
                updateEquipmentSectionSolar('inversores-clemesi', data.data.clemesi);
                updateEquipmentSectionSolar('inversores-central', data.data.central || []);
                initializeEditListeners();
                applyAllFiltersSolar();
            }
        })
        .catch(error => console.error('Error al actualizar datos solares:', error));
}

function updateEquipmentSection(sectionId, aeros) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Limpiar contenido actual
    section.innerHTML = '';
    
    aeros.forEach(aero => {
        const div = document.createElement('div');
        div.className = `equipment-item ${aero.status}`;
        div.setAttribute('data-id', aero.id);
        div.setAttribute('data-circuito', aero.circuito);
        div.setAttribute('data-tipo', aero.tipo);
        div.setAttribute('data-fecha-fin', aero.fecha_fin || '');
        
        const tipoGroup = (aero.tipo === 'PAUSA' || aero.tipo === 'STOP') ? 'PAUSA_STOP' : aero.tipo;
        div.setAttribute('data-tipo-group', tipoGroup);
        
        if (aero.is_unified) {
            div.setAttribute('data-unified', 'true');
            div.setAttribute('data-components', JSON.stringify(aero.component_records));
        }
        
        let html = `
            <span class="status-indicator status-${aero.tipo}"></span>
            <span class="equipment-name">${aero.nombre}</span>
            <span class="equipment-fecha">${aero.fecha_inicio}</span>
            <span class="equipment-fecha">${aero.fecha_fin || ''}</span>
            <span class="equipment-time">(${aero.tiempo})</span>
        `;
        
        if (aero.tipo === 'FALLA' || aero.tipo === 'STOP' || aero.tipo === 'PAUSA') {
            html += `
                <span class="equipment-report">${aero.reporte304 || ''}</span>
                <span class="equipment-report">${aero.reporte264 || ''}</span>
                <span class="equipment-report j5-badge ${
                    aero.reporteJ5 === 'J5 ✓' ? 'j5-ok' : 
                    aero.reporteJ5 === 'J5 ✗' ? 'j5-pending' : ''
                }">${aero.reporteJ5 || ''}</span>
            `;
        }
        
        div.innerHTML = html;
        section.appendChild(div);
    });
}

function updateEquipmentSectionSolar(sectionId, inversores) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.innerHTML = '';

    inversores.forEach(inv => {
        const div = document.createElement('div');
        div.className = `equipment-item ${inv.status}`;
        div.setAttribute('data-id', inv.id);
        div.setAttribute('data-circuito', inv.circuito);
        div.setAttribute('data-tipo', inv.tipo);
        div.setAttribute('data-fecha-fin', inv.fecha_fin || '');
        div.setAttribute('data-tipo-group', inv.tipo);
        div.setAttribute('data-tecnologia', 'solar');

        if (inv.is_unified) {
            div.setAttribute('data-unified', 'true');
            div.setAttribute('data-components', JSON.stringify(inv.component_records));
        }

        div.innerHTML = `
            <span class="status-indicator status-${inv.tipo}"></span>
            <span class="equipment-name">${inv.nombre}</span>
            <span class="equipment-fecha">${inv.fecha_inicio}</span>
            <span class="equipment-fecha">${inv.fecha_fin || ''}</span>
            <span class="equipment-time">(${inv.tiempo})</span>
        `;

        section.appendChild(div);
    });
}

// Estado de filtros (se guarda en sessionStorage)
function getFilterState() {
    const saved = sessionStorage.getItem('reportes_filter_state');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        viewState: 'activos',  // 'activos' o 'turno'
        tipos: {
            FALLA: true,
            PAUSA_STOP: true,
            MANT: true
        }
    };
}

function saveFilterState(state) {
    sessionStorage.setItem('reportes_filter_state', JSON.stringify(state));
}

function cycleViewState() {
    const filterState = getFilterState();
    const states = ['activos', 'turno'];  // Solo dos estados
    const currentIndex = states.indexOf(filterState.viewState);
    const nextIndex = (currentIndex + 1) % states.length;
    const nextState = states[nextIndex];
    
    filterState.viewState = nextState;
    saveFilterState(filterState);
    
    updateViewStateButton(nextState);
    applyAllFilters();
}

function updateViewStateButton(state) {
    const btn = document.getElementById('view-state-btn');
    if (!btn) return;
    
    // Remover todas las clases de estado
    btn.classList.remove('state-activos', 'state-turno');
    
    if (state === 'activos') {
        btn.classList.add('state-activos');
        btn.textContent = 'Activos';
    } else if (state === 'turno') {
        btn.classList.add('state-turno');
        
        // Determinar turno actual
        const now = new Date();
        const currentHour = now.getHours();
        const isTurno2 = currentHour >= 8 && currentHour < 20;
        
        // Si estamos en Turno 2, el anterior es 1: "Turno 1 | 2"
        // Si estamos en Turno 1, el anterior es 2: "Turno 2 | 1"
        btn.textContent = isTurno2 ? 'Turno 1 | 2' : 'Turno 2 | 1';
    }
}

function parseFechaFromString(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return null;
    const [fecha, hora] = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const [horas, minutos] = hora ? hora.split(':') : ['0', '0'];
    const anioCompleto = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

// function toggleAerogeneradoresView() {
//     const filterState = getFilterState();
//     const checkbox = document.getElementById('show-all-aerogeneradores');
    
//     filterState.showAll = checkbox.checked;
//     saveFilterState(filterState);
    
//     updateSwitchLabel();
//     applyAllFilters();
// }

// function updateSwitchLabel() {
//     const checkbox = document.getElementById('show-all-aerogeneradores');
//     const label = document.getElementById('aerogeneradores-label');
    
//     if (checkbox && label) {
//         label.textContent = checkbox.checked ? 'Todos' : 'Activos';
//     }
// }

function toggleTipoFilter(button) {
    const tipo = button.getAttribute('data-tipo');
    const filterState = getFilterState();
    
    // Toggle estado
    filterState.tipos[tipo] = !filterState.tipos[tipo];
    saveFilterState(filterState);
    
    // Actualizar apariencia del botón
    if (filterState.tipos[tipo]) {
        button.classList.add('active');
        button.classList.remove('inactive');
    } else {
        button.classList.remove('active');
        button.classList.add('inactive');
    }
    
    // Aplicar filtros
    applyAllFilters();
}

function applyAllFilters() {
    const filterState = getFilterState();
    const allItems = document.querySelectorAll('.equipment-item');
    
    allItems.forEach(item => {
        const isOk = item.classList.contains('ok');
        const tipoGroup = item.getAttribute('data-tipo-group');
        const fechaFin = item.getAttribute('data-fecha-fin');
        const fechaInicioStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim() || '';
        const fechaInicioElement = item.querySelectorAll('.equipment-fecha')[0];
        const fechaFinElement = item.querySelectorAll('.equipment-fecha')[1];
        const tiempoStr = item.querySelector('.equipment-time')?.textContent.trim() || '';
        
        // Verificar filtro de tipo
        const tipoVisible = filterState.tipos[tipoGroup];
        
        let shouldShow = true;
        const sinFechaFin = !fechaFin || fechaFin.trim() === '';
        
        // Limpiar clases de turno primero
        if (fechaInicioElement) {
            fechaInicioElement.classList.remove('turno-actual', 'turno-anterior');
        }
        if (fechaFinElement) {
            fechaFinElement.classList.remove('turno-actual', 'turno-anterior');
        }
        
        // Lógica según el estado de vista
        if (filterState.viewState === 'activos') {
            // Modo Activos: solo sin fecha_fin (abiertos)
            shouldShow = !isOk;
        } else if (filterState.viewState === 'turno') {
            // Modo Turno: abiertos + cerrados con duración >= 58 min que tengan fecha_inicio O fecha_fin en turno actual o anterior
            if (sinFechaFin) {
                // Abiertos siempre se muestran
                shouldShow = true;
            } else {
                // Cerrados: verificar duración >= 58 min
                const totalMinutos = extractTotalMinutos(tiempoStr);
                if (totalMinutos < 58) {
                    shouldShow = false;
                } else {
                    // Duración OK, verificar si fecha_inicio O fecha_fin están en turno actual o anterior
                    const fechaInicioEnTurno = isInTurnoActualOAnterior(fechaInicioStr);
                    const fechaFinEnTurno = isInTurnoActualOAnterior(fechaFin);
                    
                    shouldShow = fechaInicioEnTurno || fechaFinEnTurno;
                }
            }
                
            // Aplicar fondos de turno en modo Turno (tanto para abiertos como cerrados)
            if (shouldShow) {
                const fechaInicio = parseFechaFromString(fechaInicioStr);
                
                // Aplicar fondo a fecha_inicio
                if (fechaInicio) {
                    const turnoInfoInicio = getTurnoInfo(fechaInicio);
                    if (turnoInfoInicio) {
                        if (fechaInicioElement) {
                            fechaInicioElement.classList.add(turnoInfoInicio.esActual ? 'turno-actual' : 'turno-anterior');
                        }
                    }
                }
                
                // Aplicar fondo a fecha_fin solo si existe (cerrados)
                if (!sinFechaFin) {
                    const fechaFinObj = parseFechaFromString(fechaFin);
                    if (fechaFinObj) {
                        const turnoInfoFin = getTurnoInfo(fechaFinObj);
                        if (turnoInfoFin) {
                            if (fechaFinElement) {
                                fechaFinElement.classList.add(turnoInfoFin.esActual ? 'turno-actual' : 'turno-anterior');
                            }
                        }
                    }
                }
            }
        }
        
        // Gestionar fondo rojo en fecha_fin vacía (en Activos y Turno)
        if (fechaFinElement) {
            if (sinFechaFin && !isOk) {
                fechaFinElement.classList.add('empty-fecha-fin');
            } else {
                fechaFinElement.classList.remove('empty-fecha-fin');
            }
        }
        
        // Remover borde naranja (ya no se usa)
        item.classList.remove('active-border');
        
        // Mostrar solo si todos los filtros pasan
        if (tipoVisible && shouldShow) {
            item.classList.remove('filtered-out');
            item.style.display = 'flex';
        } else {
            item.classList.add('filtered-out');
            item.style.display = 'none';
        }
    });
    
    // Ordenar elementos en modo Turno
    if (filterState.viewState === 'turno') {
        sortEquipmentItems();
    }
}

function sortEquipmentItems() {
    // Ordenar en cada lista (Wayra I y Wayra Ext)
    const lists = document.querySelectorAll('.equipment-list');
    
    lists.forEach(list => {
        // Obtener todos los items visibles
        const items = Array.from(list.querySelectorAll('.equipment-item:not(.filtered-out)'));
        
        // Separar por tipo
        const falla = items.filter(item => {
            const tipo = item.getAttribute('data-tipo');
            return tipo === 'FALLA' || tipo === 'STOP' || tipo === 'PAUSA';
        });
        
        const mant = items.filter(item => {
            const tipo = item.getAttribute('data-tipo');
            return tipo === 'MANT';
        });
        
        // Ordenar FALLA/STOP/PAUSA por fecha_inicio descendente
        falla.sort((a, b) => {
            const fechaA = parseFechaInicio(a);
            const fechaB = parseFechaInicio(b);
            return fechaA - fechaB; // Ascendente (más antiguo primero)
        });

        // Ordenar MANT por fecha_inicio ascendente
        mant.sort((a, b) => {
            const fechaA = parseFechaInicio(a);
            const fechaB = parseFechaInicio(b);
            return fechaA - fechaB; // Ascendente (más antiguo primero)
        });
        
        // Reorganizar en el DOM: primero FALLA/STOP/PAUSA, luego MANT
        [...falla, ...mant].forEach(item => {
            list.appendChild(item);
        });
    });
}

function parseFechaInicio(item) {
    const fechaStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim();
    if (!fechaStr) return new Date(0);
    
    // Formato: "DD/MM/YY HH:MM"
    const partes = fechaStr.split(' ');
    const [dia, mes, anio] = partes[0].split('/');
    const [horas, minutos] = partes[1] ? partes[1].split(':') : ['0', '0'];
    const anioCompleto = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

function extractTotalMinutos(tiempoStr) {
    if (!tiempoStr || tiempoStr.trim() === '') return 0;
    
    let dias = 0, horas = 0, minutos = 0;
    
    // Extraer días
    if (tiempoStr.includes('d')) {
        const match = tiempoStr.match(/(\d+)d/);
        if (match) dias = parseInt(match[1]);
    }
    
    // Extraer horas
    if (tiempoStr.includes('h')) {
        const match = tiempoStr.match(/(\d+)h/);
        if (match) horas = parseInt(match[1]);
    }
    
    // Extraer minutos
    if (tiempoStr.includes('m')) {
        const match = tiempoStr.match(/(\d+)m/);
        if (match) minutos = parseInt(match[1]);
    }
    
    return (dias * 1440) + (horas * 60) + minutos;
}

/* ============================================================
   FILTROS SOLAR
============================================================ */
function getSolarFilterState() {
    const saved = sessionStorage.getItem('solar_filter_state');
    if (saved) return JSON.parse(saved);
    return {
        viewState: 'activos',
        tipos: { FALLA: true, MANT: true }
    };
}

function saveSolarFilterState(state) {
    sessionStorage.setItem('solar_filter_state', JSON.stringify(state));
}

function toggleTipoFilterSolar(btn) {
    const tipo = btn.getAttribute('data-tipo');
    const filterState = getSolarFilterState();
    filterState.tipos[tipo] = !filterState.tipos[tipo];
    btn.classList.toggle('active', filterState.tipos[tipo]);
    btn.classList.toggle('inactive', !filterState.tipos[tipo]);
    saveSolarFilterState(filterState);
    applyAllFiltersSolar();
}

function cycleViewStateSolar() {
    const filterState = getSolarFilterState();
    const states = ['activos', 'turno'];
    const nextIndex = (states.indexOf(filterState.viewState) + 1) % states.length;
    filterState.viewState = states[nextIndex];
    saveSolarFilterState(filterState);
    updateViewStateSolarButton(filterState.viewState);
    applyAllFiltersSolar();
}

function updateViewStateSolarButton(state) {
    const btn = document.getElementById('view-state-btn-solar');
    if (!btn) return;
    btn.classList.remove('state-activos', 'state-turno');
    if (state === 'activos') {
        btn.classList.add('state-activos');
        btn.textContent = 'Activos';
    } else {
        btn.classList.add('state-turno');
        btn.textContent = 'Turno';
    }
}

function applyAllFiltersSolar() {
    const filterState = getSolarFilterState();
    const solarSections = ['inversores-rubi', 'inversores-clemesi', 'inversores-central'];

    solarSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const items = section.querySelectorAll('.equipment-item');
        items.forEach(item => {
            const tipoGroup = item.getAttribute('data-tipo-group');
            const tipoVisible = filterState.tipos[tipoGroup] !== false;

            let shouldShow = true;
            if (filterState.viewState === 'activos') {
                const fechaFin = item.getAttribute('data-fecha-fin') || '';
                shouldShow = fechaFin.trim() === '';
            } else if (filterState.viewState === 'turno') {
                const fechaStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim();
                shouldShow = isInTurnoActualOAnterior(fechaStr);
            }

            if (tipoVisible && shouldShow) {
                item.classList.remove('filtered-out');
                item.style.display = 'flex';
            } else {
                item.classList.add('filtered-out');
                item.style.display = 'none';
            }
        });
    });
}

function ejecutarActualizarSolar() {
    const button = event.target.closest('.btn-actualizar');
    button.classList.add('rotating');
    button.disabled = true;

    fetch('/api/ejecutar-actualizar-solar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Datos solares actualizados', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification('Error al actualizar: ' + data.message, 'error');
            button.classList.remove('rotating');
            button.disabled = false;
        }
    })
    .catch(error => {
        showNotification('Error de conexión al actualizar solar', 'error');
        button.classList.remove('rotating');
        button.disabled = false;
    });
}

function ejecutarActualizarWind() {
    const button = event.target.closest('.btn-actualizar');
    const icon = button.querySelector('i');
    
    // Añadir animación de rotación
    button.classList.add('rotating');
    button.disabled = true;
    
    fetch('/api/ejecutar-actualizar-wind', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Datos actualizados correctamente', 'success');
            // Recargar página después de 1 segundo
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Error al actualizar: ' + data.message, 'error');
            button.classList.remove('rotating');
            button.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión al actualizar', 'error');
        button.classList.remove('rotating');
        button.disabled = false;
    });
}

function getTurnoInfo(fecha) {
    // Retorna { turno: 1 o 2, esActual: true/false }
    if (!fecha) return null;
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Determinar turno actual y anterior
    let turnoActual, turnoAnterior;
    let rangoActualInicio, rangoActualFin, rangoAnteriorInicio, rangoAnteriorFin;
    
    if (currentHour >= 8 && currentHour < 20) {
        // Estamos en Turno 2 (08:00 - 20:00)
        turnoActual = 2;
        turnoAnterior = 1;
        
        // Turno 2 actual: hoy 08:00 - hoy 20:00
        rangoActualInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        rangoActualFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        
        // Turno 1 anterior: ayer 20:00 - hoy 08:00
        rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
        rangoAnteriorFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    } else {
        // Estamos en Turno 1 (20:00 - 08:00)
        turnoActual = 1;
        turnoAnterior = 2;
        
        if (currentHour >= 20) {
            // Turno 1 actual: hoy 20:00 - mañana 08:00
            rangoActualInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
            rangoActualFin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
            
            // Turno 2 anterior: hoy 08:00 - hoy 20:00
            rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
            rangoAnteriorFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        } else {
            // Turno 1 actual: ayer 20:00 - hoy 08:00
            rangoActualInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
            rangoActualFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
            
            // Turno 2 anterior: ayer 08:00 - ayer 20:00
            rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 0, 0);
            rangoAnteriorFin = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
        }
    }
    
    // Verificar en qué turno está la fecha
    if (fecha >= rangoActualInicio && fecha < rangoActualFin) {
        return { turno: turnoActual, esActual: true };
    } else if (fecha >= rangoAnteriorInicio && fecha < rangoAnteriorFin) {
        return { turno: turnoAnterior, esActual: false };
    }
    
    return null;
}

function isInTurnoActualOAnterior(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return false;
    
    const fecha = parseFechaFromString(fechaStr);
    if (!fecha) return false;
    
    const turnoInfo = getTurnoInfo(fecha);
    return turnoInfo !== null;
=======
// Variables for Drag & Drop
let draggedElement = null;
let draggedData = null;
let dropIndicator = null;
let mergeIndicator = null;

window.initReportes = function() {

    /* ===============================
       Restaurar filtros
    =============================== */
    const filterState = getFilterState();

    updateViewStateButton(filterState.viewState);

    Object.keys(filterState.tipos).forEach(tipo => {
        const btn = document.querySelector(`.filter-tipo-btn[data-tipo="${tipo}"]`);
        if (btn) {
            btn.classList.toggle('active', filterState.tipos[tipo]);
            btn.classList.toggle('inactive', !filterState.tipos[tipo]);
        }
    });

    applyAllFilters();

    /* ===============================
       Switches de aerogeneradores
    =============================== */
    const switchAero = document.getElementById('show-all-aerogeneradores');
    const switchAeroMant = document.getElementById('show-all-aerogeneradores-mantenimiento');

    if (switchAero) switchAero.checked = false;
    if (switchAeroMant) switchAeroMant.checked = false;

    if (document.getElementById('aerogeneradores-falla')) {
        toggleAerogeneradoresView();
    }

    if (document.getElementById('aerogeneradores-mantenimiento')) {
        toggleAerogeneradoresMantenimientoView();
    }

    /* ===============================
       Inicializaciones generales
    =============================== */
    initializeEditListeners();

    if (document.querySelector('.toggle-table-button')) {
        if (typeof loadDailyReportData === "function") {
            loadDailyReportData();
        }
    }

    /* ===============================
    Actualización AJAX cada 1 minuto
    =============================== */
    setInterval(() => {
        updateEquipmentData();
    }, 60 * 1000); // 1 minuto

    if (document.querySelector('.toggle-table-button')) {
        if (typeof loadDailyReportData === "function") {
            loadDailyReportData();
        }
    }

};

// function toggleAerogeneradoresMantenimientoView() {
//     const checkbox = document.getElementById('show-all-aerogeneradores-mantenimiento');
//     const label = document.getElementById('aerogeneradores-mantenimiento-label');
//     const aerogeneradores = document.querySelectorAll('#aerogeneradores-mantenimiento .equipment-item');

//     if (!checkbox) return;

//     if (checkbox.checked) {
//         label.textContent = 'Todos';
//         aerogeneradores.forEach(aerogenerador => {
//             aerogenerador.style.display = 'flex';
//         });
//     } else {
//         label.textContent = 'Activos';
//         aerogeneradores.forEach(aerogenerador => {
//             if (aerogenerador.classList.contains('ok')) {
//                 aerogenerador.style.display = 'none';
//             } else {
//                 aerogenerador.style.display = 'flex';
//             }
//         });
//     }
// }

// Funcionalidad de edición de registros
function initializeEditListeners() {
    const equipmentNames = document.querySelectorAll('.equipment-name');
    equipmentNames.forEach(name => {
        // Siempre remover y reagregar listener para evitar duplicados
        name.removeEventListener('click', handleEditClick);
        name.addEventListener('click', handleEditClick);
        
        // Solo agregar tooltip si no existe
        if (!name.querySelector('.equipment-name-tooltip')) {
            const item = name.closest('.equipment-item');
            let tipo = item.getAttribute('data-tipo');
            const circuito = item.getAttribute('data-circuito');
            let tipoDisplay = tipo === 'MANT' ? 'MANTENIMIENTO' : tipo;

            const tooltip = document.createElement('div');
            tooltip.className = 'equipment-name-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <span class="status-indicator status-${tipo}"></span>
                    <span class="tooltip-tipo-text tipo-${tipo}">${tipoDisplay}</span>
                </div>
                <div class="tooltip-circuito">C-${circuito.toString().padStart(2, '0')}</div>
            `;

            name.appendChild(tooltip);
        }
    });
}

function handleEditClick(e) {
    e.stopPropagation();
    const item = this.closest('.equipment-item');
    const recordId = item.getAttribute('data-id');
    
    // Obtener solo el texto directo del elemento (sin el tooltip)
    let nombre = '';
    for (let node of this.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            nombre += node.textContent;
        }
    }
    nombre = nombre.trim();
    
    console.log('Click en:', nombre, 'ID:', recordId); // Debug
    
    // Verificar si es registro unificado por el asterisco en el nombre
    const isUnified = nombre.includes('*');
    
    if (isUnified) {
        const componentsDataStr = item.getAttribute('data-components');
        console.log('Es unificado. data-components:', componentsDataStr); // Debug
        
        if (!componentsDataStr || componentsDataStr === 'null') {
            console.error('ERROR: Registro unificado sin data-components');
            alert('Error: Este registro no tiene datos de componentes.');
            return;
        }
        
        try {
            const componentsData = JSON.parse(componentsDataStr);
            const nombreLimpio = nombre.replace('*', '');
            showUnifiedRecordsDialog(componentsData, nombreLimpio);
        } catch (error) {
            console.error('ERROR parsing components:', error);
            alert('Error al procesar los datos del registro');
        }
        return;
    }
    
    // Si no es unificado, mostrar diálogo de edición normal
    const statusIndicator = item.querySelector('.status-indicator');

    // Extraer el tipo desde la clase status-TIPO
    let tipo = 'FALLA';
    const classes = statusIndicator.className.split(' ');
    classes.forEach(cls => {
        if (cls.startsWith('status-') && cls !== 'status-indicator') {
            tipo = cls.replace('status-', '');
        }
    });

    // Obtener circuito
    let circuito = item.getAttribute('data-circuito');

    // Si no tiene data-circuito, intentar extraerlo del contenido
    if (!circuito || circuito === 'N/A') {
        const allItems = document.querySelectorAll('.equipment-item');
        allItems.forEach(otherItem => {
            if (otherItem.getAttribute('data-id') === recordId) {
                circuito = otherItem.getAttribute('data-circuito') || 'N/A';
            }
        });
    }

    // Obtener datos del registro
    const recordData = {
        id: recordId,
        nombre: nombre,
        circuito: circuito,
        tipo: tipo,
        fecha_inicio: item.querySelectorAll('.equipment-fecha')[0].textContent.trim(),
        fecha_fin: item.querySelectorAll('.equipment-fecha')[1].textContent.trim()
    };

    showEditDialog(recordData);
}

function showUnifiedRecordsDialog(components, nombre) {
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';
    
    // Extraer solo el nombre del aero (eliminar asterisco y cualquier sufijo)
    const nombreAero = nombre.replace('*', '').split(' ')[0]; // Solo "WTG18"
    const numRegistros = components.length.toString().padStart(2, '0');
    
    let contentHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeUnifiedRecordsDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>${nombreAero} - ${numRegistros} registros continuos</h3>
            </div>
            <div style="margin-bottom: 20px;">
    `;
    
    components.forEach((comp, index) => {
        const tipoDisplay = comp.tipo === 'MANT' ? 'MANTENIMIENTO' : comp.tipo;
        contentHTML += `
            <div class="merge-option compact-merge-option" 
                data-record-id="${comp.id}" 
                data-record-nombre="${comp.nombre}" 
                data-record-circuito="${comp.circuito}" 
                data-record-tipo="${comp.tipo}" 
                data-record-fecha-inicio="${comp.fecha_inicio}" 
                data-record-fecha-fin="${comp.fecha_fin || ''}">
                <div class="merge-option-title">
                    <span class="status-indicator status-${comp.tipo}"></span>
                    ${comp.nombre} - ${tipoDisplay}
                </div>
                <div class="merge-option-dates">
                    ${comp.fecha_inicio} - ${comp.fecha_fin || 'Continúa'}
                </div>
            </div>
        `;
        
        // Agregar indicador de tiempo entre registros (excepto después del último)
        if (index < components.length - 1) {
            const nextComp = components[index + 1];
            const tiempoEntreRegistros = calcularTiempoEntreRegistros(comp.fecha_fin, nextComp.fecha_inicio);
            
            contentHTML += `
                <div class="time-between-records">
                    <i class="fa-solid fa-arrow-down"></i>
                    <span>${tiempoEntreRegistros} min</span>
                </div>
            `;
        }
    });
    
    contentHTML += `
        <div style="margin-top: 20px; text-align: center; padding: 0 20px;">
            <button class="btn btn-secondary" onclick='showUnmergeOptions(${JSON.stringify(components)})'>
                <i class="fa-solid fa-unlink"></i>
                Separar
            </button>
        </div>
    `;

    contentHTML += '</div></div>';
    dialog.innerHTML = contentHTML;
    
    dialog.innerHTML = contentHTML;

    document.body.appendChild(dialog);

    setTimeout(() => {
        dialog.classList.add('show');
        
        // Agregar listeners de click a cada opción
        const mergeOptions = dialog.querySelectorAll('.merge-option.compact-merge-option');
        mergeOptions.forEach(option => {
            option.addEventListener('click', function() {
                const recordData = {
                    id: this.getAttribute('data-record-id'),
                    nombre: this.getAttribute('data-record-nombre'),
                    circuito: this.getAttribute('data-record-circuito'),
                    tipo: this.getAttribute('data-record-tipo'),
                    fecha_inicio: this.getAttribute('data-record-fecha-inicio'),
                    fecha_fin: this.getAttribute('data-record-fecha-fin')
                };
                
                closeUnifiedRecordsDialog();
                showEditDialog(recordData);
            });
        });
    }, 10);
    
    // Agregar event listeners a las opciones
    const options = dialog.querySelectorAll('.merge-option');
    options.forEach(option => {
        option.addEventListener('click', function() {
            const recordData = {
                id: this.getAttribute('data-record-id'),
                nombre: this.getAttribute('data-record-nombre'),
                circuito: this.getAttribute('data-record-circuito'),
                tipo: this.getAttribute('data-record-tipo'),
                fecha_inicio: this.getAttribute('data-record-fecha-inicio'),
                fecha_fin: this.getAttribute('data-record-fecha-fin')
            };
            closeUnifiedRecordsDialog();
            showEditDialog(recordData);
        });
    });
    
    const handleEscape = function(e) {
        if (e.key === 'Escape') {
            closeUnifiedRecordsDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) closeUnifiedRecordsDialog();
    });
}

function calcularTiempoEntreRegistros(fechaFin, fechaInicio) {
    if (!fechaFin || fechaFin.trim() === '') return '0';
    
    const fecha1 = parseFechaFromString(fechaFin);
    const fecha2 = parseFechaFromString(fechaInicio);
    
    if (!fecha1 || !fecha2) return '0';
    
    const diffMinutes = Math.round((fecha2 - fecha1) / (1000 * 60));
    return diffMinutes.toString();
}

function closeUnifiedRecordsDialog() {
    const dialog = document.querySelector('.merge-select-dialog');
    if (dialog) dialog.remove();
}

// function openComponentRecord(recordId) {
//     closeUnifiedRecordsDialog();
    
//     // Buscar el item original en el DOM
//     const allItems = document.querySelectorAll('.equipment-item');
//     let recordData = null;
    
//     allItems.forEach(item => {
//         if (item.getAttribute('data-unified') === 'true') {
//             const components = JSON.parse(item.getAttribute('data-components'));
//             const found = components.find(c => c.id === recordId);
//             if (found) {
//                 recordData = {
//                     id: found.id,
//                     nombre: found.nombre,
//                     circuito: found.circuito,
//                     tipo: found.tipo,
//                     fecha_inicio: found.fecha_inicio,
//                     fecha_fin: found.fecha_fin || ''
//                 };
//             }
//         }
//     });
    
//     if (recordData) {
//         showEditDialog(recordData);
//     }
// }

function showEditDialog(data) {
    const fechaInicioInput = convertToDatetimeLocal(data.fecha_inicio);
    const fechaFinInput = data.fecha_fin ? convertToDatetimeLocal(data.fecha_fin) : '';
    const hasFechaFin = data.fecha_fin && data.fecha_fin.trim() !== '';
    const tipoDisplay = data.tipo === 'MANT' ? 'MANTENIMIENTO' : data.tipo;

    const tiposOrden = ['PAUSA', 'STOP', 'FALLA', 'MANTENIMIENTO'];
    const tiposOptions = tiposOrden
        .map(t => {
            const value = t === 'MANTENIMIENTO' ? 'MANT' : t;
            const selected = value === data.tipo ? 'selected' : '';
            return `<option value="${value}" ${selected}>${t}</option>`;
        })
        .join('');

    const dialog = document.createElement('div');
    dialog.className = 'edit-dialog';
    dialog.innerHTML = `
        <div class="edit-dialog-content">
            <button class="dialog-close-btn" onclick="closeEditDialog()">&times;</button>
            <div class="edit-dialog-header">
                <i class="fas fa-edit"></i>
                <h3>${data.nombre}</h3>
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Circuito:</label>
                <div class="edit-circuito-display">${data.circuito}</div>
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Tipo:</label>
                <div class="edit-tipo-select-wrapper">
                    <span class="status-indicator status-${data.tipo}" id="tipo-indicator"></span>
                    <span class="edit-tipo-text" id="tipo-text">${tipoDisplay}</span>
                    <select class="edit-tipo-select" id="edit-tipo">
                        ${tiposOptions}
                    </select>
                </div>
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Fecha Inicio:</label>
                <input type="datetime-local" class="edit-form-input" id="edit-fecha-inicio" value="${fechaInicioInput}" step="60">
            </div>
            
            <div class="edit-form-group">
                <label class="edit-form-label">Fecha Fin:</label>
                <input type="datetime-local" class="edit-form-input" id="edit-fecha-fin" value="${fechaFinInput}" ${!hasFechaFin ? 'disabled' : ''} step="60">
            </div>
            
            <div class="edit-buttons">
                <button class="btn btn-danger" style="margin-right: auto;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
                <button class="btn btn-merge">
                    <i class="fa-solid fa-link"></i> Unir
                </button>
                <button class="btn btn-primary" id="btn-actualizar-edit">
                    <i class="fas fa-check"></i> Actualizar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Event listeners para los botones
    dialog.querySelector('.btn-danger').addEventListener('click', function() {
        confirmDelete(data.id, data.nombre);
    });

    dialog.querySelector('.btn-merge').addEventListener('click', function() {
        showMergeSelectDialog(data.id, data.nombre, data.tipo, data.fecha_inicio, data.fecha_fin || '');
    });

    const tipoSelect = dialog.querySelector('#edit-tipo');
    const tipoIndicator = dialog.querySelector('#tipo-indicator');
    const tipoText = dialog.querySelector('#tipo-text');

    tipoSelect.addEventListener('change', function () {
        const newTipo = this.value;
        const newTipoDisplay = newTipo === 'MANT' ? 'MANTENIMIENTO' : newTipo;
        tipoIndicator.className = `status-indicator status-${newTipo}`;
        tipoText.textContent = newTipoDisplay;
    });

    const btnActualizar = dialog.querySelector('#btn-actualizar-edit');
    btnActualizar.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        confirmEdit(data.id, data.fecha_inicio, data.fecha_fin, hasFechaFin, data.tipo);
    });

    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeEditDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeEditDialog();
    });
}

function closeEditDialog() {
    const dialog = document.querySelector('.edit-dialog');
    if (dialog) dialog.remove();
}

function convertToDatetimeLocal(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return '';
    const [fecha, hora] = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const anioCompleto = anio.length === 2 ? '20' + anio : anio;
    return `${anioCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${hora}`;
}

function convertFromDatetimeLocal(datetimeStr) {
    if (!datetimeStr) return null;
    const [fecha, hora] = datetimeStr.split('T');
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio} ${hora}`;
}

function confirmEdit(recordId, originalFechaInicio, originalFechaFin, hasFechaFin, originalTipo) {
    const newFechaInicio = document.getElementById('edit-fecha-inicio').value;
    const newFechaFin = document.getElementById('edit-fecha-fin').value;
    const newTipo = document.getElementById('edit-tipo').value;

    if (!newFechaInicio) {
        showNotification('Debe ingresar una fecha de inicio', 'error');
        return;
    }

    const newFechaInicioFormatted = convertFromDatetimeLocal(newFechaInicio);
    const newFechaFinFormatted = hasFechaFin && newFechaFin ? convertFromDatetimeLocal(newFechaFin) : null;

    const fechaInicioChanged = newFechaInicioFormatted !== originalFechaInicio;
    const fechaFinChanged = hasFechaFin && newFechaFinFormatted && newFechaFinFormatted !== originalFechaFin;
    const tipoChanged = newTipo !== originalTipo;

    if (!fechaInicioChanged && !fechaFinChanged && !tipoChanged) {
        showNotification('No se realizaron cambios', 'info');
        closeEditDialog();
        return;
    }

    const updateData = {
        id: recordId,
        fecha_inicio: newFechaInicioFormatted,
        tipo: newTipo
    };

    if (hasFechaFin && newFechaFinFormatted) {
        updateData.fecha_fin = newFechaFinFormatted;
    }

    fetch('/api/update-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registro actualizado correctamente', 'success');
                closeEditDialog();
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showNotification('Error al actualizar: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión al actualizar', 'error');
        });
}

function confirmDelete(recordId, nombre) {
    closeEditDialog();

    const dialog = document.createElement('div');
    dialog.className = 'merge-dialog';
    dialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeDeleteDialog()">&times;</button>
            <h3><i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> Confirmar Eliminación</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Esta acción no se puede deshacer.
                </div>
                <div class="delete-question">
                    ¿Está seguro de eliminar el registro de <strong>${nombre}</strong>?
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-danger" onclick="executeDelete('${recordId}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeDeleteDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeDeleteDialog();
    });
}

function closeDeleteDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeDelete(recordId) {
    closeDeleteDialog();

    fetch('/api/mark-deleted-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registro eliminado correctamente', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showNotification('Error al eliminar: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión al eliminar', 'error');
        });
}

function deleteEquipment(recordId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) {
        return;
    }
    
    fetch('/api/mark-deleted-equipment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: recordId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Registro eliminado correctamente', 'success');
            closeEditDialog();
            // Actualizar datos para reflejar el cambio
            setTimeout(() => {
                updateEquipmentData();
            }, 500);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    });
}

function generateDailyReport() {
    let button = event?.target?.closest('button');
    if (!button) {
        button = document.querySelector('button[onclick="generateDailyReport()"]');
    }

    let icon = null;
    if (button) {
        icon = button.querySelector('i') || button.querySelector('.fas');
    }

    if (icon) {
        const originalClasses = icon.className;
        icon.className = 'fas fa-spinner fa-spin';
        icon.dataset.originalClasses = originalClasses;
    }

    if (button) button.disabled = true;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    // 23:30 = 1410 min, 02:00 = 120 min
    const isInTimeRange = currentTime >= 1410 || currentTime <= 120;

    if (!isInTimeRange) {
        showTimeWarningDialog();
    }

    // Cargar datos
    if (typeof loadDailyReportData === "function") {
        loadDailyReportData();
    }
}

function showTimeWarningDialog() {
    if (document.querySelector('.time-warning-dialog')) return; // Avoid duplicates

    const dialog = document.createElement('div');
    dialog.className = 'merge-dialog time-warning-dialog';
    dialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeTimeWarningDialog()">&times;</button>
            <h3><i class="fas fa-clock" style="color: #ffc107;"></i> Advertencia de Horario</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="time-warning-text">Está visualizando el reporte fuera del horario establecido (23:30 - 02:00).</span>
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-primary" onclick="closeTimeWarningDialog()">
                    <i class="fas fa-check"></i> Entendido
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeTimeWarningDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeTimeWarningDialog();
    });
}

function closeTimeWarningDialog() {
    const dialog = document.querySelector('.time-warning-dialog');
    if (dialog) dialog.remove();
}

function executeGenerateReport() {
    if (typeof loadDailyReportData === "function") {
        loadDailyReportData();
    }
}

function toggleTableVisibility() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const button = document.querySelector('.toggle-table-button');
    const icon = button.querySelector('i');

    if (tableWrapper.classList.contains('hidden')) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours * 60 + minutes;
        const isInTimeRange = currentTime >= 1410 || currentTime <= 120;

        if (!isInTimeRange) {
            showTimeWarningDialog();
        }
    }

    tableWrapper.classList.toggle('hidden');

    if (tableWrapper.classList.contains('hidden')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-up';
    }
}

function showMergeDialog(currentId, currentNombre) {
    // Cerrar diálogo de edición
    closeEditDialog();
    
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';
    dialog.id = 'merge-dialog';
    
    // Obtener todos los registros visibles del mismo aerogenerador
    const items = Array.from(document.querySelectorAll('.equipment-item'));
    const aeroNum = currentNombre.replace('WTG', '').replace('*', '').trim();
    const sameAeroItems = items.filter(item => {
        // Verificar que sea del mismo aerogenerador
        const itemNombre = item.querySelector('.equipment-name').textContent.replace('*', '').trim();
        const isSameAero = itemNombre === `WTG${aeroNum}`;
        
        // Verificar que sea diferente al actual
        const isDifferent = item.getAttribute('data-id') !== currentId;
        
        // Verificar que esté visible (no filtrado)
        const isVisible = !item.classList.contains('filtered-out') && item.style.display !== 'none';
        
        return isSameAero && isDifferent && isVisible;
    });
    
    let optionsHTML = '';
    
    if (sameAeroItems.length === 0) {
        optionsHTML = '<p style="text-align: center; color: #999;">No hay otros registros visibles del mismo aerogenerador para unir</p>';
    } else {
        sameAeroItems.forEach(item => {
            const id = item.getAttribute('data-id');
            const nombre = item.querySelector('.equipment-name').textContent.trim();
            const tipo = item.getAttribute('data-tipo');
            const tipoDisplay = tipo === 'MANT' ? 'MANTENIMIENTO' : tipo;
            const fechaInicio = item.querySelectorAll('.equipment-fecha')[0].textContent.trim();
            const fechaFin = item.querySelectorAll('.equipment-fecha')[1].textContent.trim() || 'Continúa';
            
            optionsHTML += `
                <div class="merge-option" onclick="confirmMerge('${currentId}', '${id}')">
                    <div class="merge-option-title">
                        <span class="status-indicator status-${tipo}"></span>
                        ${nombre} - ${tipoDisplay}
                    </div>
                    <div class="merge-option-dates">
                        ${fechaInicio} - ${fechaFin}
                    </div>
                </div>
            `;
        });
    }
    
    dialog.innerHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeMergeDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>Unir ${currentNombre} con:</h3>
            </div>
            <div class="merge-options-container">
                ${optionsHTML}
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    setTimeout(() => {
        dialog.classList.add('show');
    }, 10);
}

function closeMergeDialog() {
    const dialog = document.getElementById('merge-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        setTimeout(() => dialog.remove(), 300);
    }
}

function confirmMerge(currentId, nextId) {
    if (!confirm('¿Estás seguro de que deseas unir estos registros?')) {
        return;
    }
    
    fetch('/api/merge-equipment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            current_id: currentId,
            next_id: nextId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Registros unidos correctamente', 'success');
            closeMergeDialog();
            setTimeout(() => {
                updateEquipmentData();
            }, 500);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    });
}

// Merge functionality
function showMergeSelectDialog(currentId, currentNombre, currentTipo, currentFechaInicio, currentFechaFin) {
    // Determinar el grupo de tipos
    const tiposFalla = ['FALLA', 'STOP', 'PAUSA'];
    const tiposMant = ['MANT'];

    const grupoActual = tiposFalla.includes(currentTipo) ? 'falla' : 'mantenimiento';

    // Buscar todos los items del mismo aerogenerador
    const allItems = document.querySelectorAll('.equipment-item');
    const matchingItems = [];

    allItems.forEach(item => {
        const itemId = item.getAttribute('data-id');

        if (itemId === currentId) return;

        // Leer solo nodos de texto ignorando tooltip
        const nameEl = item.querySelector('.equipment-name');
        let itemNombrePuro = '';
        for (let node of nameEl.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) itemNombrePuro += node.textContent;
        }
        itemNombrePuro = itemNombrePuro.trim().replace('*', '').trim();
        const currentNombreNorm = currentNombre.replace('*', '').trim();

        if (itemNombrePuro !== currentNombreNorm) return;

        // Determinar tipo del item
        const statusIndicator = item.querySelector('.status-indicator');
        let itemTipo = 'FALLA';
        item.querySelector('.status-indicator').className.split(' ').forEach(cls => {
            if (cls.startsWith('status-')) itemTipo = cls.replace('status-', '');
        });

        // Solo mismo grupo (falla o mantenimiento)
        const grupoItem = tiposFalla.includes(itemTipo) ? 'falla' : 'mantenimiento';
        if (grupoItem !== grupoActual) return;

        const fechas = item.querySelectorAll('.equipment-fecha');
        const itemFechaInicioStr = fechas[0].textContent.trim();
        const itemFechaFinStr = fechas[1].textContent.trim();

        // --- Filtro 1: duración mínima de 58 minutos ---
        const tiempoEl = item.querySelector('.equipment-time');
        const tiempoStr = tiempoEl ? tiempoEl.textContent.replace('(', '').replace(')', '').trim() : '';
        const totalMinutos = extractTotalMinutos(tiempoStr);
        if (totalMinutos < 58) return;

        // --- Filtro 2: fecha_fin no anterior a hace 24 horas (o sin fecha_fin = activo) ---
        if (itemFechaFinStr !== '') {
            const fechaFin = parseFecha(itemFechaFinStr);
            const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (fechaFin <= hace24h) return;
        }

        matchingItems.push({
            id: itemId,
            nombre: nameEl.textContent.trim(),
            tipo: itemTipo,
            fecha_inicio: itemFechaInicioStr,
            fecha_fin: itemFechaFinStr
        });
    });

    // Crear el diálogo
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';

    let contentHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeMergeSelectDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>Seleccionar registro para unir con ${currentNombre}</h3>
            </div>
    `;

    if (matchingItems.length === 0) {
        contentHTML += `
            <div class="merge-no-records">
                <i class="fas fa-info-circle"></i>
                <p>No hay otros registros de ${currentNombre} del mismo tipo disponibles para unir.</p>
            </div>
        `;
    } else {
        contentHTML += '<div style="margin-bottom: 20px;">';

        matchingItems.forEach(item => {
            const tipoDisplay = item.tipo === 'MANT' ? 'MANTENIMIENTO' : item.tipo;
            contentHTML += `
                <div class="merge-option" onclick="selectMergeOption(this, '${item.id}', '${item.fecha_inicio}', '${item.fecha_fin}')">
                    <div class="merge-option-title">
                        <span class="status-indicator status-${item.tipo}"></span>
                        ${item.nombre} - ${tipoDisplay}
                    </div>
                    <div class="merge-option-dates">
                        ${item.fecha_inicio} - ${item.fecha_fin || 'Continúa'}
                    </div>
                </div>
            `;
        });

        contentHTML += `
            </div>
            <div class="edit-buttons">
                <button class="btn btn-primary" id="btn-confirm-merge" disabled>
                    <i class="fas fa-check"></i> Unir
                </button>
            </div>
        `;
    }

    contentHTML += '</div>';
    dialog.innerHTML = contentHTML;

    document.body.appendChild(dialog);

    // Guardar datos actuales para usar después
    dialog.dataset.currentId = currentId;
    dialog.dataset.currentNombre = currentNombre;
    dialog.dataset.currentFechaInicio = currentFechaInicio;
    dialog.dataset.currentFechaFin = currentFechaFin;

    // Event listener para el botón de confirmar
    const btnConfirm = dialog.querySelector('#btn-confirm-merge');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
            const selectedOption = dialog.querySelector('.merge-option.selected');
            if (selectedOption) {
                const targetId = selectedOption.dataset.targetId;
                const targetFechaInicio = selectedOption.dataset.targetFechaInicio;
                const targetFechaFin = selectedOption.dataset.targetFechaFin;

                confirmMergeFromSelect(currentId, currentFechaInicio, currentFechaFin,
                    targetId, targetFechaInicio, targetFechaFin, currentNombre);
            }
        });
    }

    // Cerrar con tecla Escape
    const handleEscape = function (e) {
        if (e.key === 'Escape') {
            closeMergeSelectDialog();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeMergeSelectDialog();
    });
}

function selectMergeOption(element, targetId, targetFechaInicio, targetFechaFin) {
    // Remover selección anterior
    const dialog = element.closest('.merge-select-dialog');
    dialog.querySelectorAll('.merge-option').forEach(opt => opt.classList.remove('selected'));

    // Seleccionar actual
    element.classList.add('selected');

    // Guardar datos en el elemento
    element.dataset.targetId = targetId;
    element.dataset.targetFechaInicio = targetFechaInicio;
    element.dataset.targetFechaFin = targetFechaFin;

    // Habilitar botón de confirmar
    const btnConfirm = dialog.querySelector('#btn-confirm-merge');
    if (btnConfirm) {
        btnConfirm.disabled = false;
    }
}

function closeMergeSelectDialog() {
    const dialog = document.querySelector('.merge-select-dialog');
    if (dialog) dialog.remove();
}

function confirmMergeFromSelect(currentId, currentFechaInicio, currentFechaFin,
    targetId, targetFechaInicio, targetFechaFin, nombre) {
    // Calcular diferencia de tiempo
    const fecha1 = currentFechaFin ? parseFecha(currentFechaFin) : null;
    const fecha2 = parseFecha(targetFechaInicio);

    let diffMinutes = 0;
    let warningMessage = '';

    if (fecha1) {
        diffMinutes = Math.abs((fecha2 - fecha1) / (1000 * 60));

        if (diffMinutes > 70) {
            warningMessage = `El tiempo entre registros es mayor a 70 minutos (${Math.round(diffMinutes)} min). `;
        }
    }

    // Determinar cuál registro mantener (el más antiguo)
    const fecha1Date = parseFecha(currentFechaInicio);
    const fecha2Date = parseFecha(targetFechaInicio);

    const keepId = fecha1Date < fecha2Date ? currentId : targetId;
    const deleteId = fecha1Date < fecha2Date ? targetId : currentId;
    const newFechaFin = fecha1Date < fecha2Date ? targetFechaFin : currentFechaFin;

    if (warningMessage) {
        // Mostrar advertencia antes de unir
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'merge-dialog';
        confirmDialog.innerHTML = `
            <div class="merge-dialog-content">
                <button class="dialog-close-btn" onclick="closeWarningMergeDialog()">&times;</button>
                <h3><i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i> Advertencia</h3>
                <div class="merge-warning" style="margin: 20px 0;">
                    <i class="fas fa-info-circle"></i>
                    ${warningMessage}¿Desea continuar con la unión?
                </div>
                <div class="merge-buttons">
                    <button class="btn btn-primary" onclick="executeMerge('${keepId}', '${deleteId}', '${newFechaFin}')">
                        <i class="fas fa-check"></i> Continuar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        // Cerrar con tecla Escape
        const handleEscape = function (e) {
            if (e.key === 'Escape') {
                closeWarningMergeDialog();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        confirmDialog.addEventListener('click', function (e) {
            if (e.target === confirmDialog) closeWarningMergeDialog();
        });
    } else {
        // Unir directamente sin advertencia
        executeMerge(keepId, deleteId, newFechaFin);
    }

    closeMergeSelectDialog();
    closeEditDialog();
}

function closeWarningMergeDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function showUnmergeOptions(components) {
    if (components.length <= 2) {
        // Si solo hay 2 registros, separar directamente el primero
        confirmUnmerge(components[0].id);
    } else {
        // Si hay más de 2, mostrar opciones
        closeUnifiedRecordsDialog();
        
        const dialog = document.createElement('div');
        dialog.className = 'merge-select-dialog';
        dialog.id = 'unmerge-dialog';
        
        let optionsHTML = '';
        
        // Mostrar todos excepto el último (el último no tiene 'unido')
        for (let i = 0; i < components.length - 1; i++) {
            const comp = components[i];
            const tipoDisplay = comp.tipo === 'MANT' ? 'MANTENIMIENTO' : comp.tipo;
            
            optionsHTML += `
                <div class="merge-option" onclick="confirmUnmerge('${comp.id}')">
                    <div class="merge-option-title">
                        <span class="status-indicator status-${comp.tipo}"></span>
                        ${comp.nombre} - ${tipoDisplay}
                    </div>
                    <div class="merge-option-dates">
                        Separar después de este registro
                    </div>
                </div>
            `;
        }
        
        dialog.innerHTML = `
            <div class="merge-select-content">
                <button class="dialog-close-btn" onclick="closeUnmergeDialog()">&times;</button>
                <div class="merge-select-header">
                    <i class="fa-solid fa-unlink"></i>
                    <h3>Seleccionar punto de separación</h3>
                </div>
                <div class="merge-options-container">
                    ${optionsHTML}
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        setTimeout(() => {
            dialog.classList.add('show');
        }, 10);
    }
}

function closeUnmergeDialog() {
    const dialog = document.getElementById('unmerge-dialog');
    if (dialog) {
        dialog.classList.remove('show');
        setTimeout(() => dialog.remove(), 300);
    }
}

function confirmUnmerge(recordId) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'merge-dialog';
    
    confirmDialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeConfirmUnmergeDialog()">&times;</button>
            <h3><i class="fa-solid fa-unlink"></i> Confirmar Separación</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom: 15px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Esta acción modificará la relación entre los registros unidos.
                </div>
                <div class="delete-question">
                    ¿Estás seguro de que deseas separar estos registros?
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-danger" onclick="executeUnmerge('${recordId}')">
                    <i class="fa-solid fa-unlink"></i>
                    Separar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmDialog);
    
    setTimeout(() => {
        confirmDialog.classList.add('show');
    }, 10);
}

function closeConfirmUnmergeDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeUnmerge(recordId) {
    fetch('/api/unmerge-equipment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            record_id: recordId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Registros separados correctamente', 'success');
            closeConfirmUnmergeDialog();
            closeUnmergeDialog();
            closeUnifiedRecordsDialog();
            setTimeout(() => {
                updateEquipmentData();
            }, 500);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    });
}

function parseFecha(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return null;
    const [fecha, hora] = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const [horas, minutos] = hora ? hora.split(':') : ['0', '0'];
    const anioCompleto = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

function executeMerge(keepId, deleteId, newFechaFin) {
    closeWarningMergeDialog();

    fetch('/api/merge-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            current_id: keepId,
            next_id: deleteId
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registros unidos correctamente', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showNotification('Error al unir: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión al unir registros', 'error');
        });
}

function updateEquipmentData() {
    fetch('/api/get-wind-data')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Actualizar Wayra I
                updateEquipmentSection('aerogeneradores-wayra-i', data.data.wayra_i);
                // Actualizar Wayra Ext
                updateEquipmentSection('aerogeneradores-wayra-ext', data.data.wayra_ext);
                // Reinicializar listeners
                initializeEditListeners();
                // Aplicar filtros
                applyAllFilters();
            }
        })
        .catch(error => {
            console.error('Error al actualizar datos:', error);
        });
}

function updateEquipmentSection(sectionId, aeros) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Limpiar contenido actual
    section.innerHTML = '';
    
    aeros.forEach(aero => {
        const div = document.createElement('div');
        div.className = `equipment-item ${aero.status}`;
        div.setAttribute('data-id', aero.id);
        div.setAttribute('data-circuito', aero.circuito);
        div.setAttribute('data-tipo', aero.tipo);
        div.setAttribute('data-fecha-fin', aero.fecha_fin || '');
        
        const tipoGroup = (aero.tipo === 'PAUSA' || aero.tipo === 'STOP') ? 'PAUSA_STOP' : aero.tipo;
        div.setAttribute('data-tipo-group', tipoGroup);
        
        if (aero.is_unified) {
            div.setAttribute('data-unified', 'true');
            div.setAttribute('data-components', JSON.stringify(aero.component_records));
        }
        
        let html = `
            <span class="status-indicator status-${aero.tipo}"></span>
            <span class="equipment-name">${aero.nombre}</span>
            <span class="equipment-fecha">${aero.fecha_inicio}</span>
            <span class="equipment-fecha">${aero.fecha_fin || ''}</span>
            <span class="equipment-time">(${aero.tiempo})</span>
        `;
        
        if (aero.tipo === 'FALLA' || aero.tipo === 'STOP' || aero.tipo === 'PAUSA') {
            html += `
                <span class="equipment-report">${aero.reporte304 || ''}</span>
                <span class="equipment-report">${aero.reporte264 || ''}</span>
                <span class="equipment-report j5-badge ${
                    aero.reporteJ5 === 'J5 ✓' ? 'j5-ok' : 
                    aero.reporteJ5 === 'J5 ✗' ? 'j5-pending' : ''
                }">${aero.reporteJ5 || ''}</span>
            `;
        }
        
        div.innerHTML = html;
        section.appendChild(div);
    });
}

// Estado de filtros (se guarda en sessionStorage)
function getFilterState() {
    const saved = sessionStorage.getItem('reportes_filter_state');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        viewState: 'activos',  // 'activos' o 'turno'
        tipos: {
            FALLA: true,
            PAUSA_STOP: true,
            MANT: true
        }
    };
}

function saveFilterState(state) {
    sessionStorage.setItem('reportes_filter_state', JSON.stringify(state));
}

function cycleViewState() {
    const filterState = getFilterState();
    const states = ['activos', 'turno'];  // Solo dos estados
    const currentIndex = states.indexOf(filterState.viewState);
    const nextIndex = (currentIndex + 1) % states.length;
    const nextState = states[nextIndex];
    
    filterState.viewState = nextState;
    saveFilterState(filterState);
    
    updateViewStateButton(nextState);
    applyAllFilters();
}

function updateViewStateButton(state) {
    const btn = document.getElementById('view-state-btn');
    if (!btn) return;
    
    // Remover todas las clases de estado
    btn.classList.remove('state-activos', 'state-turno');
    
    if (state === 'activos') {
        btn.classList.add('state-activos');
        btn.textContent = 'Activos';
    } else if (state === 'turno') {
        btn.classList.add('state-turno');
        
        // Determinar turno actual
        const now = new Date();
        const currentHour = now.getHours();
        const isTurno2 = currentHour >= 8 && currentHour < 20;
        
        // Si estamos en Turno 2, el anterior es 1: "Turno 1 | 2"
        // Si estamos en Turno 1, el anterior es 2: "Turno 2 | 1"
        btn.textContent = isTurno2 ? 'Turno 1 | 2' : 'Turno 2 | 1';
    }
}

function parseFechaFromString(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return null;
    const [fecha, hora] = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const [horas, minutos] = hora ? hora.split(':') : ['0', '0'];
    const anioCompleto = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

// function toggleAerogeneradoresView() {
//     const filterState = getFilterState();
//     const checkbox = document.getElementById('show-all-aerogeneradores');
    
//     filterState.showAll = checkbox.checked;
//     saveFilterState(filterState);
    
//     updateSwitchLabel();
//     applyAllFilters();
// }

// function updateSwitchLabel() {
//     const checkbox = document.getElementById('show-all-aerogeneradores');
//     const label = document.getElementById('aerogeneradores-label');
    
//     if (checkbox && label) {
//         label.textContent = checkbox.checked ? 'Todos' : 'Activos';
//     }
// }

function toggleTipoFilter(button) {
    const tipo = button.getAttribute('data-tipo');
    const filterState = getFilterState();
    
    // Toggle estado
    filterState.tipos[tipo] = !filterState.tipos[tipo];
    saveFilterState(filterState);
    
    // Actualizar apariencia del botón
    if (filterState.tipos[tipo]) {
        button.classList.add('active');
        button.classList.remove('inactive');
    } else {
        button.classList.remove('active');
        button.classList.add('inactive');
    }
    
    // Aplicar filtros
    applyAllFilters();
}

function applyAllFilters() {
    const filterState = getFilterState();
    const allItems = document.querySelectorAll('.equipment-item');
    
    allItems.forEach(item => {
        const isOk = item.classList.contains('ok');
        const tipoGroup = item.getAttribute('data-tipo-group');
        const fechaFin = item.getAttribute('data-fecha-fin');
        const fechaInicioStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim() || '';
        const fechaInicioElement = item.querySelectorAll('.equipment-fecha')[0];
        const fechaFinElement = item.querySelectorAll('.equipment-fecha')[1];
        const tiempoStr = item.querySelector('.equipment-time')?.textContent.trim() || '';
        
        // Verificar filtro de tipo
        const tipoVisible = filterState.tipos[tipoGroup];
        
        let shouldShow = true;
        const sinFechaFin = !fechaFin || fechaFin.trim() === '';
        
        // Limpiar clases de turno primero
        if (fechaInicioElement) {
            fechaInicioElement.classList.remove('turno-actual', 'turno-anterior');
        }
        if (fechaFinElement) {
            fechaFinElement.classList.remove('turno-actual', 'turno-anterior');
        }
        
        // Lógica según el estado de vista
        if (filterState.viewState === 'activos') {
            // Modo Activos: solo sin fecha_fin (abiertos)
            shouldShow = !isOk;
        } else if (filterState.viewState === 'turno') {
            // Modo Turno: abiertos + cerrados con duración >= 58 min que tengan fecha_inicio O fecha_fin en turno actual o anterior
            if (sinFechaFin) {
                // Abiertos siempre se muestran
                shouldShow = true;
            } else {
                // Cerrados: verificar duración >= 58 min
                const totalMinutos = extractTotalMinutos(tiempoStr);
                if (totalMinutos < 58) {
                    shouldShow = false;
                } else {
                    // Duración OK, verificar si fecha_inicio O fecha_fin están en turno actual o anterior
                    const fechaInicioEnTurno = isInTurnoActualOAnterior(fechaInicioStr);
                    const fechaFinEnTurno = isInTurnoActualOAnterior(fechaFin);
                    
                    shouldShow = fechaInicioEnTurno || fechaFinEnTurno;
                }
            }
                
            // Aplicar fondos de turno en modo Turno (tanto para abiertos como cerrados)
            if (shouldShow) {
                const fechaInicio = parseFechaFromString(fechaInicioStr);
                
                // Aplicar fondo a fecha_inicio
                if (fechaInicio) {
                    const turnoInfoInicio = getTurnoInfo(fechaInicio);
                    if (turnoInfoInicio) {
                        if (fechaInicioElement) {
                            fechaInicioElement.classList.add(turnoInfoInicio.esActual ? 'turno-actual' : 'turno-anterior');
                        }
                    }
                }
                
                // Aplicar fondo a fecha_fin solo si existe (cerrados)
                if (!sinFechaFin) {
                    const fechaFinObj = parseFechaFromString(fechaFin);
                    if (fechaFinObj) {
                        const turnoInfoFin = getTurnoInfo(fechaFinObj);
                        if (turnoInfoFin) {
                            if (fechaFinElement) {
                                fechaFinElement.classList.add(turnoInfoFin.esActual ? 'turno-actual' : 'turno-anterior');
                            }
                        }
                    }
                }
            }
        }
        
        // Gestionar fondo rojo en fecha_fin vacía (en Activos y Turno)
        if (fechaFinElement) {
            if (sinFechaFin && !isOk) {
                fechaFinElement.classList.add('empty-fecha-fin');
            } else {
                fechaFinElement.classList.remove('empty-fecha-fin');
            }
        }
        
        // Remover borde naranja (ya no se usa)
        item.classList.remove('active-border');
        
        // Mostrar solo si todos los filtros pasan
        if (tipoVisible && shouldShow) {
            item.classList.remove('filtered-out');
            item.style.display = 'flex';
        } else {
            item.classList.add('filtered-out');
            item.style.display = 'none';
        }
    });
    
    // Ordenar elementos en modo Turno
    if (filterState.viewState === 'turno') {
        sortEquipmentItems();
    }
}

function sortEquipmentItems() {
    // Ordenar en cada lista (Wayra I y Wayra Ext)
    const lists = document.querySelectorAll('.equipment-list');
    
    lists.forEach(list => {
        // Obtener todos los items visibles
        const items = Array.from(list.querySelectorAll('.equipment-item:not(.filtered-out)'));
        
        // Separar por tipo
        const falla = items.filter(item => {
            const tipo = item.getAttribute('data-tipo');
            return tipo === 'FALLA' || tipo === 'STOP' || tipo === 'PAUSA';
        });
        
        const mant = items.filter(item => {
            const tipo = item.getAttribute('data-tipo');
            return tipo === 'MANT';
        });
        
        // Ordenar FALLA/STOP/PAUSA por fecha_inicio descendente
        falla.sort((a, b) => {
            const fechaA = parseFechaInicio(a);
            const fechaB = parseFechaInicio(b);
            return fechaA - fechaB; // Ascendente (más antiguo primero)
        });

        // Ordenar MANT por fecha_inicio ascendente
        mant.sort((a, b) => {
            const fechaA = parseFechaInicio(a);
            const fechaB = parseFechaInicio(b);
            return fechaA - fechaB; // Ascendente (más antiguo primero)
        });
        
        // Reorganizar en el DOM: primero FALLA/STOP/PAUSA, luego MANT
        [...falla, ...mant].forEach(item => {
            list.appendChild(item);
        });
    });
}

function parseFechaInicio(item) {
    const fechaStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim();
    if (!fechaStr) return new Date(0);
    
    // Formato: "DD/MM/YY HH:MM"
    const partes = fechaStr.split(' ');
    const [dia, mes, anio] = partes[0].split('/');
    const [horas, minutos] = partes[1] ? partes[1].split(':') : ['0', '0'];
    const anioCompleto = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

function extractTotalMinutos(tiempoStr) {
    if (!tiempoStr || tiempoStr.trim() === '') return 0;
    
    let dias = 0, horas = 0, minutos = 0;
    
    // Extraer días
    if (tiempoStr.includes('d')) {
        const match = tiempoStr.match(/(\d+)d/);
        if (match) dias = parseInt(match[1]);
    }
    
    // Extraer horas
    if (tiempoStr.includes('h')) {
        const match = tiempoStr.match(/(\d+)h/);
        if (match) horas = parseInt(match[1]);
    }
    
    // Extraer minutos
    if (tiempoStr.includes('m')) {
        const match = tiempoStr.match(/(\d+)m/);
        if (match) minutos = parseInt(match[1]);
    }
    
    return (dias * 1440) + (horas * 60) + minutos;
}

function ejecutarActualizarWind() {
    const button = event.target.closest('.btn-actualizar');
    const icon = button.querySelector('i');
    
    // Añadir animación de rotación
    button.classList.add('rotating');
    button.disabled = true;
    
    fetch('/api/ejecutar-actualizar-wind', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Datos actualizados correctamente', 'success');
            // Recargar página después de 1 segundo
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Error al actualizar: ' + data.message, 'error');
            button.classList.remove('rotating');
            button.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error de conexión al actualizar', 'error');
        button.classList.remove('rotating');
        button.disabled = false;
    });
}

function getTurnoInfo(fecha) {
    // Retorna { turno: 1 o 2, esActual: true/false }
    if (!fecha) return null;
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Determinar turno actual y anterior
    let turnoActual, turnoAnterior;
    let rangoActualInicio, rangoActualFin, rangoAnteriorInicio, rangoAnteriorFin;
    
    if (currentHour >= 8 && currentHour < 20) {
        // Estamos en Turno 2 (08:00 - 20:00)
        turnoActual = 2;
        turnoAnterior = 1;
        
        // Turno 2 actual: hoy 08:00 - hoy 20:00
        rangoActualInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        rangoActualFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        
        // Turno 1 anterior: ayer 20:00 - hoy 08:00
        rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
        rangoAnteriorFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    } else {
        // Estamos en Turno 1 (20:00 - 08:00)
        turnoActual = 1;
        turnoAnterior = 2;
        
        if (currentHour >= 20) {
            // Turno 1 actual: hoy 20:00 - mañana 08:00
            rangoActualInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
            rangoActualFin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
            
            // Turno 2 anterior: hoy 08:00 - hoy 20:00
            rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
            rangoAnteriorFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        } else {
            // Turno 1 actual: ayer 20:00 - hoy 08:00
            rangoActualInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
            rangoActualFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
            
            // Turno 2 anterior: ayer 08:00 - ayer 20:00
            rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 0, 0);
            rangoAnteriorFin = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
        }
    }
    
    // Verificar en qué turno está la fecha
    if (fecha >= rangoActualInicio && fecha < rangoActualFin) {
        return { turno: turnoActual, esActual: true };
    } else if (fecha >= rangoAnteriorInicio && fecha < rangoAnteriorFin) {
        return { turno: turnoAnterior, esActual: false };
    }
    
    return null;
}

function isInTurnoActualOAnterior(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return false;
    
    const fecha = parseFechaFromString(fechaStr);
    if (!fecha) return false;
    
    const turnoInfo = getTurnoInfo(fecha);
    return turnoInfo !== null;
>>>>>>> d8ad0b27ff8876c3ce36c1e1edf5e1db272e0c05
}