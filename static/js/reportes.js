/* ============================================================
   1. INICIALIZACIÓN
   ============================================================ */

window.initReportes = function () {

    /* ----------------------------
       1.1 Restaurar filtros eólica
       ---------------------------- */
    const filterState = getFilterState();

    updateViewStateButton(filterState.viewState);

    Object.keys(filterState.tipos).forEach(tipo => {
        const btn = document.querySelector(`.filter-tipo-btn[data-tipo="${tipo}"]`);
        if (btn) {
            btn.classList.toggle('active',   filterState.tipos[tipo]);
            btn.classList.toggle('inactive', !filterState.tipos[tipo]);
        }
    });

    applyAllFilters();

    /* ----------------------------
       1.2 Restaurar filtros solar
       ---------------------------- */
    const solarFilterState = getSolarFilterState();

    updateViewStateSolarButton(solarFilterState.viewState);

    Object.keys(solarFilterState.tipos).forEach(tipo => {
        const btn = document.querySelector(`.filter-tipo-btn-solar[data-tipo="${tipo}"]`);
        if (btn) {
            btn.classList.toggle('active',   solarFilterState.tipos[tipo]);
            btn.classList.toggle('inactive', !solarFilterState.tipos[tipo]);
        }
    });

    applyAllFiltersSolar();

    /* ----------------------------
       1.3 Listeners de edición
       ---------------------------- */
    initializeEditListeners();

    /* ----------------------------
       1.4 Tabla reporte diario
       ---------------------------- */
    if (document.querySelector('.toggle-table-button')) {
        loadDailyReportData();
    }

    /* ----------------------------
       1.5 Polling AJAX cada 1 minuto
       ---------------------------- */
    setInterval(() => updateEquipmentData(), 60 * 1000);
};


/* ============================================================
   2. EDICIÓN DE REGISTROS
   ============================================================ */

/* ----------------------------
   2.1 Listeners e inicialización
   ---------------------------- */
function initializeEditListeners() {
    const equipmentNames = document.querySelectorAll('.equipment-name');
    equipmentNames.forEach(name => {
        name.removeEventListener('click', handleEditClick);
        name.addEventListener('click', handleEditClick);

        if (!name.querySelector('.equipment-name-tooltip')) {
            const item      = name.closest('.equipment-item');
            const tipo      = item.getAttribute('data-tipo');
            const circuito  = item.getAttribute('data-circuito');
            const nombreRaw = item.getAttribute('data-nombre-raw') || '';
            const tipoDisplay = tipo === 'MANT' ? 'MANTENIMIENTO' : tipo;

            const tooltip = document.createElement('div');
            tooltip.className = 'equipment-name-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <span class="status-indicator status-${tipo}"></span>
                    <span class="tooltip-tipo-text tipo-${tipo}">${tipoDisplay}</span>
                </div>
                ${nombreRaw ? `<div class="tooltip-circuito">${nombreRaw}</div>` : ''}
                <div class="tooltip-circuito">C-${circuito.toString().padStart(2, '0')}</div>
            `;
            name.appendChild(tooltip);
        }
    });
}

function handleEditClick(e) {
    e.stopPropagation();
    const item     = this.closest('.equipment-item');
    const recordId = item.getAttribute('data-id');

    // Leer solo nodos de texto ignorando el tooltip hijo
    let nombre = '';
    for (let node of this.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) nombre += node.textContent;
    }
    nombre = nombre.trim();

    const isUnified = nombre.includes('*');

    if (isUnified) {
        const componentsDataStr = item.getAttribute('data-components');
        if (!componentsDataStr || componentsDataStr === 'null') {
            console.error('ERROR: Registro unificado sin data-components');
            alert('Error: Este registro no tiene datos de componentes.');
            return;
        }
        try {
            const componentsData = JSON.parse(componentsDataStr);
            showUnifiedRecordsDialog(componentsData, nombre.replace('*', ''));
        } catch (error) {
            console.error('ERROR parsing components:', error);
            alert('Error al procesar los datos del registro');
        }
        return;
    }

    // Extraer tipo desde la clase status-TIPO del indicador
    const statusIndicator = item.querySelector('.status-indicator');
    let tipo = 'FALLA';
    statusIndicator.className.split(' ').forEach(cls => {
        if (cls.startsWith('status-') && cls !== 'status-indicator') {
            tipo = cls.replace('status-', '');
        }
    });

    showEditDialog({
        id:          recordId,
        nombre:      nombre,
        circuito:    item.getAttribute('data-circuito') || 'N/A',
        tipo:        tipo,
        tecnologia:  item.getAttribute('data-tecnologia') || 'wind',
        fecha_inicio: item.querySelectorAll('.equipment-fecha')[0].textContent.trim(),
        fecha_fin:    item.querySelectorAll('.equipment-fecha')[1].textContent.trim()
    });
}

/* ----------------------------
   2.2 Diálogo de edición
   ---------------------------- */
function showEditDialog(data) {
    const fechaInicioInput = convertToDatetimeLocal(data.fecha_inicio);
    const fechaFinInput    = data.fecha_fin ? convertToDatetimeLocal(data.fecha_fin) : '';
    const hasFechaFin      = data.fecha_fin && data.fecha_fin.trim() !== '';
    const tipoDisplay      = data.tipo === 'MANT' ? 'MANTENIMIENTO' : data.tipo;
    const esSolar          = data.tecnologia === 'solar';

    const tiposOrden = esSolar
        ? ['FALLA', 'MANTENIMIENTO']
        : ['PAUSA', 'STOP', 'FALLA', 'MANTENIMIENTO'];

    const tiposOptions = tiposOrden.map(t => {
        const value    = t === 'MANTENIMIENTO' ? 'MANT' : t;
        const selected = value === data.tipo ? 'selected' : '';
        return `<option value="${value}" ${selected}>${t}</option>`;
    }).join('');

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
                    <select class="edit-tipo-select" id="edit-tipo">${tiposOptions}</select>
                </div>
            </div>
            <div class="edit-form-group">
                <label class="edit-form-label">Fecha Inicio:</label>
                <input type="datetime-local" class="edit-form-input" id="edit-fecha-inicio"
                       value="${fechaInicioInput}" step="60">
            </div>
            <div class="edit-form-group">
                <label class="edit-form-label">Fecha Fin:</label>
                <input type="datetime-local" class="edit-form-input" id="edit-fecha-fin"
                       value="${fechaFinInput}" ${!hasFechaFin ? 'disabled' : ''} step="60">
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

    // Cambio de tipo en el select
    const tipoSelect    = dialog.querySelector('#edit-tipo');
    const tipoIndicator = dialog.querySelector('#tipo-indicator');
    const tipoText      = dialog.querySelector('#tipo-text');
    tipoSelect.addEventListener('change', function () {
        const newTipo = this.value;
        tipoIndicator.className = `status-indicator status-${newTipo}`;
        tipoText.textContent    = newTipo === 'MANT' ? 'MANTENIMIENTO' : newTipo;
    });

    // Botón eliminar
    dialog.querySelector('.btn-danger').addEventListener('click', function () {
        confirmDelete(data.id, data.nombre, data.tecnologia);
    });

    // Botón unir
    dialog.querySelector('.btn-merge').addEventListener('click', function () {
        showMergeSelectDialog(data.id, data.nombre, data.tipo, data.fecha_inicio, data.fecha_fin || '');
    });

    // Botón actualizar
    dialog.querySelector('#btn-actualizar-edit').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        confirmEdit(data.id, data.fecha_inicio, data.fecha_fin, hasFechaFin, data.tipo, data.tecnologia);
    });

    // Cerrar con Escape o click fuera
    const handleEscape = (e) => {
        if (e.key === 'Escape') { closeEditDialog(); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeEditDialog(); });
}

function closeEditDialog() {
    const dialog = document.querySelector('.edit-dialog');
    if (dialog) dialog.remove();
}

/* ----------------------------
   2.3 Confirmar edición
   ---------------------------- */
function confirmEdit(recordId, originalFechaInicio, originalFechaFin, hasFechaFin, originalTipo, tecnologia) {
    const newFechaInicio = document.getElementById('edit-fecha-inicio').value;
    const newFechaFin    = document.getElementById('edit-fecha-fin').value;
    const newTipo        = document.getElementById('edit-tipo').value;

    if (!newFechaInicio) {
        showNotification('Debe ingresar una fecha de inicio', 'error');
        return;
    }

    const newFechaInicioFormatted = convertFromDatetimeLocal(newFechaInicio);
    const newFechaFinFormatted    = hasFechaFin && newFechaFin
        ? convertFromDatetimeLocal(newFechaFin)
        : null;

    const fechaInicioChanged = newFechaInicioFormatted !== originalFechaInicio;
    const fechaFinChanged    = hasFechaFin && newFechaFinFormatted && newFechaFinFormatted !== originalFechaFin;
    const tipoChanged        = newTipo !== originalTipo;

    if (!fechaInicioChanged && !fechaFinChanged && !tipoChanged) {
        showNotification('No se realizaron cambios', 'info');
        closeEditDialog();
        return;
    }

    const updateData = { id: recordId, fecha_inicio: newFechaInicioFormatted, tipo: newTipo };
    if (hasFechaFin && newFechaFinFormatted) updateData.fecha_fin = newFechaFinFormatted;

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

/* ----------------------------
   2.4 Conversión de fechas
   ---------------------------- */
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


/* ============================================================
   3. ELIMINAR REGISTROS
   ============================================================ */

function confirmDelete(recordId, nombre, tecnologia) {
    closeEditDialog();

    const dialog = document.createElement('div');
    dialog.className = 'merge-dialog';
    dialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeDeleteDialog()">&times;</button>
            <h3><i class="fas fa-exclamation-triangle" style="color:#dc3545;"></i> Confirmar Eliminación</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom:15px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Esta acción no se puede deshacer.
                </div>
                <div class="delete-question">
                    ¿Está seguro de eliminar el registro de <strong>${nombre}</strong>?
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-danger" id="btn-confirm-delete">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#btn-confirm-delete').addEventListener('click', () => {
        executeDelete(recordId, tecnologia);
    });

    const handleEscape = (e) => {
        if (e.key === 'Escape') { closeDeleteDialog(); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDeleteDialog(); });
}

function closeDeleteDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeDelete(recordId, tecnologia) {
    closeDeleteDialog();

    const endpoint = tecnologia === 'solar'
        ? '/api/mark-deleted-solar-equipment'
        : '/api/mark-deleted-equipment';

    fetch(endpoint, {
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


/* ============================================================
   4. MERGE DE REGISTROS
   ============================================================ */

/* ----------------------------
   4.1 Diálogo de selección
   ---------------------------- */
function showMergeSelectDialog(currentId, currentNombre, currentTipo, currentFechaInicio, currentFechaFin) {
    const tiposFalla  = ['FALLA', 'STOP', 'PAUSA'];
    const grupoActual = tiposFalla.includes(currentTipo) ? 'falla' : 'mantenimiento';

    const allItems     = document.querySelectorAll('.equipment-item');
    const matchingItems = [];

    allItems.forEach(item => {
        const itemId = item.getAttribute('data-id');
        if (itemId === currentId) return;

        // Leer nombre ignorando tooltip
        const nameEl = item.querySelector('.equipment-name');
        let itemNombrePuro = '';
        for (let node of nameEl.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) itemNombrePuro += node.textContent;
        }
        itemNombrePuro = itemNombrePuro.trim().replace('*', '').trim();
        if (itemNombrePuro !== currentNombre.replace('*', '').trim()) return;

        // Determinar tipo y grupo del item
        let itemTipo = 'FALLA';
        item.querySelector('.status-indicator').className.split(' ').forEach(cls => {
            if (cls.startsWith('status-') && cls !== 'status-indicator') itemTipo = cls.replace('status-', '');
        });
        const grupoItem = tiposFalla.includes(itemTipo) ? 'falla' : 'mantenimiento';
        if (grupoItem !== grupoActual) return;

        const fechas          = item.querySelectorAll('.equipment-fecha');
        const itemFechaInicio = fechas[0].textContent.trim();
        const itemFechaFin    = fechas[1].textContent.trim();

        // Filtro: duración mínima de 58 minutos
        const tiempoStr    = item.querySelector('.equipment-time')?.textContent.replace('(', '').replace(')', '').trim() || '';
        const totalMinutos = extractTotalMinutos(tiempoStr);
        if (totalMinutos < 58) return;

        // Filtro: fecha_fin no anterior a hace 24 horas
        if (itemFechaFin !== '') {
            const fechaFin = parseFecha(itemFechaFin);
            if (fechaFin <= new Date(Date.now() - 24 * 60 * 60 * 1000)) return;
        }

        matchingItems.push({ id: itemId, nombre: nameEl.textContent.trim(), tipo: itemTipo, fecha_inicio: itemFechaInicio, fecha_fin: itemFechaFin });
    });

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
        contentHTML += '<div style="margin-bottom:20px;">';
        matchingItems.forEach(item => {
            const tipoDisplay = item.tipo === 'MANT' ? 'MANTENIMIENTO' : item.tipo;
            contentHTML += `
                <div class="merge-option"
                    onclick="selectMergeOption(this,'${item.id}','${item.fecha_inicio}','${item.fecha_fin}')">
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

    dialog.dataset.currentId          = currentId;
    dialog.dataset.currentFechaInicio = currentFechaInicio;
    dialog.dataset.currentFechaFin    = currentFechaFin;

    const btnConfirm = dialog.querySelector('#btn-confirm-merge');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
            const selected = dialog.querySelector('.merge-option.selected');
            if (selected) {
                confirmMergeFromSelect(
                    currentId, currentFechaInicio, currentFechaFin,
                    selected.dataset.targetId,
                    selected.dataset.targetFechaInicio,
                    selected.dataset.targetFechaFin,
                    currentNombre
                );
            }
        });
    }

    const handleEscape = (e) => {
        if (e.key === 'Escape') { closeMergeSelectDialog(); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeMergeSelectDialog(); });
}

function selectMergeOption(element, targetId, targetFechaInicio, targetFechaFin) {
    const dialog = element.closest('.merge-select-dialog');
    dialog.querySelectorAll('.merge-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    element.dataset.targetId          = targetId;
    element.dataset.targetFechaInicio = targetFechaInicio;
    element.dataset.targetFechaFin    = targetFechaFin;

    const btnConfirm = dialog.querySelector('#btn-confirm-merge');
    if (btnConfirm) btnConfirm.disabled = false;
}

function closeMergeSelectDialog() {
    const dialog = document.querySelector('.merge-select-dialog');
    if (dialog) dialog.remove();
}

/* ----------------------------
   4.2 Confirmar y ejecutar merge
   ---------------------------- */
function confirmMergeFromSelect(currentId, currentFechaInicio, currentFechaFin,
    targetId, targetFechaInicio, targetFechaFin, nombre) {

    const fecha1 = currentFechaFin ? parseFecha(currentFechaFin) : null;
    const fecha2 = parseFecha(targetFechaInicio);

    let diffMinutes  = 0;
    let warningMessage = '';

    if (fecha1) {
        diffMinutes = Math.abs((fecha2 - fecha1) / (1000 * 60));
        if (diffMinutes > 70) {
            warningMessage = `El tiempo entre registros es mayor a 70 minutos (${Math.round(diffMinutes)} min). `;
        }
    }

    // Mantener el registro más antiguo como base
    const fecha1Date = parseFecha(currentFechaInicio);
    const fecha2Date = parseFecha(targetFechaInicio);
    const keepId     = fecha1Date < fecha2Date ? currentId   : targetId;
    const deleteId   = fecha1Date < fecha2Date ? targetId    : currentId;
    const newFechaFin = fecha1Date < fecha2Date ? targetFechaFin : currentFechaFin;

    if (warningMessage) {
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'merge-dialog';
        confirmDialog.innerHTML = `
            <div class="merge-dialog-content">
                <button class="dialog-close-btn" onclick="closeWarningMergeDialog()">&times;</button>
                <h3><i class="fas fa-exclamation-triangle" style="color:#ffc107;"></i> Advertencia</h3>
                <div class="merge-warning" style="margin:20px 0;">
                    <i class="fas fa-info-circle"></i>
                    ${warningMessage}¿Desea continuar con la unión?
                </div>
                <div class="merge-buttons">
                    <button class="btn btn-primary"
                        onclick="executeMerge('${keepId}','${deleteId}','${newFechaFin}')">
                        <i class="fas fa-check"></i> Continuar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmDialog);

        const handleEscape = (e) => {
            if (e.key === 'Escape') { closeWarningMergeDialog(); document.removeEventListener('keydown', handleEscape); }
        };
        document.addEventListener('keydown', handleEscape);
        confirmDialog.addEventListener('click', (e) => { if (e.target === confirmDialog) closeWarningMergeDialog(); });
    } else {
        executeMerge(keepId, deleteId, newFechaFin);
    }

    closeMergeSelectDialog();
    closeEditDialog();
}

function closeWarningMergeDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeMerge(keepId, deleteId, newFechaFin) {
    closeWarningMergeDialog();

    fetch('/api/merge-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_id: keepId, next_id: deleteId })
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

/* ----------------------------
   4.3 Registros unificados
   ---------------------------- */
function showUnifiedRecordsDialog(components, nombre) {
    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';

    const nombreAero  = nombre.split(' ')[0];
    const numRegistros = components.length.toString().padStart(2, '0');

    let contentHTML = `
        <div class="merge-select-content">
            <button class="dialog-close-btn" onclick="closeUnifiedRecordsDialog()">&times;</button>
            <div class="merge-select-header">
                <i class="fa-solid fa-link"></i>
                <h3>${nombreAero} - ${numRegistros} registros continuos</h3>
            </div>
            <div style="margin-bottom:20px;">
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

        if (index < components.length - 1) {
            const tiempoEntre = calcularTiempoEntreRegistros(comp.fecha_fin, components[index + 1].fecha_inicio);
            contentHTML += `
                <div class="time-between-records">
                    <i class="fa-solid fa-arrow-down"></i>
                    <span>${tiempoEntre} min</span>
                </div>
            `;
        }
    });

    contentHTML += `
            <div style="margin-top:20px;text-align:center;padding:0 20px;">
                <button class="btn btn-secondary" onclick='showUnmergeOptions(${JSON.stringify(components)})'>
                    <i class="fa-solid fa-unlink"></i> Separar
                </button>
            </div>
        </div></div>
    `;

    dialog.innerHTML = contentHTML;
    document.body.appendChild(dialog);

    // Click en cada opción abre el diálogo de edición del componente
    dialog.querySelectorAll('.merge-option.compact-merge-option').forEach(option => {
        option.addEventListener('click', function () {
            closeUnifiedRecordsDialog();
            showEditDialog({
                id:           this.getAttribute('data-record-id'),
                nombre:       this.getAttribute('data-record-nombre'),
                circuito:     this.getAttribute('data-record-circuito'),
                tipo:         this.getAttribute('data-record-tipo'),
                fecha_inicio: this.getAttribute('data-record-fecha-inicio'),
                fecha_fin:    this.getAttribute('data-record-fecha-fin')
            });
        });
    });

    const handleEscape = (e) => {
        if (e.key === 'Escape') { closeUnifiedRecordsDialog(); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeUnifiedRecordsDialog(); });
}

function closeUnifiedRecordsDialog() {
    const dialog = document.querySelector('.merge-select-dialog');
    if (dialog) dialog.remove();
}

function calcularTiempoEntreRegistros(fechaFin, fechaInicio) {
    if (!fechaFin || fechaFin.trim() === '') return '0';
    const fecha1 = parseFechaFromString(fechaFin);
    const fecha2 = parseFechaFromString(fechaInicio);
    if (!fecha1 || !fecha2) return '0';
    return Math.round((fecha2 - fecha1) / (1000 * 60)).toString();
}


/* ============================================================
   5. UNMERGE DE REGISTROS
   ============================================================ */

function showUnmergeOptions(components) {
    // Con 2 registros separar directamente; con más mostrar punto de corte
    if (components.length <= 2) {
        confirmUnmerge(components[0].id);
        return;
    }

    closeUnifiedRecordsDialog();

    const dialog = document.createElement('div');
    dialog.className = 'merge-select-dialog';
    dialog.id = 'unmerge-dialog';

    let optionsHTML = '';
    for (let i = 0; i < components.length - 1; i++) {
        const comp        = components[i];
        const tipoDisplay = comp.tipo === 'MANT' ? 'MANTENIMIENTO' : comp.tipo;
        optionsHTML += `
            <div class="merge-option" onclick="confirmUnmerge('${comp.id}')">
                <div class="merge-option-title">
                    <span class="status-indicator status-${comp.tipo}"></span>
                    ${comp.nombre} - ${tipoDisplay}
                </div>
                <div class="merge-option-dates">Separar después de este registro</div>
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
            <div class="merge-options-container">${optionsHTML}</div>
        </div>
    `;

    document.body.appendChild(dialog);
}

function closeUnmergeDialog() {
    const dialog = document.getElementById('unmerge-dialog');
    if (dialog) dialog.remove();
}

function confirmUnmerge(recordId) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'merge-dialog';
    confirmDialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeConfirmUnmergeDialog()">&times;</button>
            <h3><i class="fa-solid fa-unlink"></i> Confirmar Separación</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom:15px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Esta acción modificará la relación entre los registros unidos.
                </div>
                <div class="delete-question">
                    ¿Estás seguro de que deseas separar estos registros?
                </div>
            </div>
            <div class="merge-buttons">
                <button class="btn btn-danger" onclick="executeUnmerge('${recordId}')">
                    <i class="fa-solid fa-unlink"></i> Separar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmDialog);
}

function closeConfirmUnmergeDialog() {
    const dialog = document.querySelector('.merge-dialog');
    if (dialog) dialog.remove();
}

function executeUnmerge(recordId) {
    fetch('/api/unmerge-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: recordId })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Registros separados correctamente', 'success');
                closeConfirmUnmergeDialog();
                closeUnmergeDialog();
                closeUnifiedRecordsDialog();
                setTimeout(() => updateEquipmentData(), 500);
            } else {
                showNotification('Error: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error de conexión', 'error');
        });
}


/* ============================================================
   6. ACTUALIZACIÓN DE DATOS (AJAX)
   ============================================================ */

function updateEquipmentData() {
    // Actualizar eólica
    fetch('/api/get-wind-data')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateEquipmentSection('aerogeneradores-wayra-i',  data.data.wayra_i);
                updateEquipmentSection('aerogeneradores-wayra-ext', data.data.wayra_ext);
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
                updateEquipmentSectionSolar('inversores-rubi',    data.data.rubi);
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
    section.innerHTML = '';

    aeros.forEach(aero => {
        const div = document.createElement('div');
        div.className = `equipment-item ${aero.status}`;
        div.setAttribute('data-id',         aero.id);
        div.setAttribute('data-circuito',    aero.circuito);
        div.setAttribute('data-tipo',        aero.tipo);
        div.setAttribute('data-fecha-fin',   aero.fecha_fin || '');
        div.setAttribute('data-tipo-group',
            (aero.tipo === 'PAUSA' || aero.tipo === 'STOP') ? 'PAUSA_STOP' : aero.tipo
        );

        if (aero.is_unified) {
            div.setAttribute('data-unified',    'true');
            div.setAttribute('data-components', JSON.stringify(aero.component_records));
        }

        let html = `
            <span class="status-indicator status-${aero.tipo}"></span>
            <span class="equipment-name">${aero.nombre}</span>
            <span class="equipment-fecha">${aero.fecha_inicio}</span>
            <span class="equipment-fecha">${aero.fecha_fin || ''}</span>
            <span class="equipment-time">(${aero.tiempo})</span>
        `;

        if (['FALLA', 'STOP', 'PAUSA'].includes(aero.tipo)) {
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
        div.setAttribute('data-id',          inv.id);
        div.setAttribute('data-nombre-raw',  inv.nombre_raw || inv.nombre);
        div.setAttribute('data-circuito',    inv.circuito);
        div.setAttribute('data-tipo',        inv.tipo);
        div.setAttribute('data-fecha-fin',   inv.fecha_fin || '');
        div.setAttribute('data-tipo-group',  inv.tipo);
        div.setAttribute('data-tecnologia',  'solar');

        if (inv.is_unified) {
            div.setAttribute('data-unified',    'true');
            div.setAttribute('data-components', JSON.stringify(inv.component_records));
        }

        div.innerHTML = `
            <span class="status-indicator status-${inv.tipo}"></span>
            <span class="equipment-name">${inv.nombre}</span>
            <span class="equipment-fecha">${inv.fecha_inicio}</span>
            <span class="equipment-fecha">${inv.fecha_fin || ''}</span>
            <span class="equipment-time">(${inv.tiempo})</span>
            <span class="equipment-report"></span>
            <span class="equipment-report"></span>
            <span class="equipment-report j5-badge"></span>
        `;

        section.appendChild(div);
    });
}


/* ============================================================
   7. FILTROS — EÓLICA
   ============================================================ */

/* ----------------------------
   7.1 Estado de filtros
   ---------------------------- */
function getFilterState() {
    const saved = sessionStorage.getItem('reportes_filter_state');
    if (saved) return JSON.parse(saved);
    return {
        viewState: 'activos',
        tipos: { FALLA: true, PAUSA_STOP: true, MANT: true }
    };
}

function saveFilterState(state) {
    sessionStorage.setItem('reportes_filter_state', JSON.stringify(state));
}

/* ----------------------------
   7.2 Ciclo de vista y botón
   ---------------------------- */
function cycleViewState() {
    const filterState = getFilterState();
    const states      = ['activos', 'turno'];
    filterState.viewState = states[(states.indexOf(filterState.viewState) + 1) % states.length];
    saveFilterState(filterState);
    updateViewStateButton(filterState.viewState);
    applyAllFilters();
}

function updateViewStateButton(state) {
    const btn = document.getElementById('view-state-btn');
    if (!btn) return;
    btn.classList.remove('state-activos', 'state-turno');
    if (state === 'activos') {
        btn.classList.add('state-activos');
        btn.textContent = 'Activos';
    } else {
        btn.classList.add('state-turno');
        const isTurno2 = new Date().getHours() >= 8 && new Date().getHours() < 20;
        btn.textContent = isTurno2 ? 'Turno 1 | 2' : 'Turno 2 | 1';
    }
}

/* ----------------------------
   7.3 Filtro por tipo
   ---------------------------- */
function toggleTipoFilter(button) {
    const tipo        = button.getAttribute('data-tipo');
    const filterState = getFilterState();
    filterState.tipos[tipo] = !filterState.tipos[tipo];
    saveFilterState(filterState);
    button.classList.toggle('active',   filterState.tipos[tipo]);
    button.classList.toggle('inactive', !filterState.tipos[tipo]);
    applyAllFilters();
}

/* ----------------------------
   7.4 Aplicar filtros
   ---------------------------- */
function applyAllFilters() {
    const filterState = getFilterState();
    const allItems = document.querySelectorAll(
    '#aerogeneradores-wayra-i .equipment-item, #aerogeneradores-wayra-ext .equipment-item'
);

    allItems.forEach(item => {
        const isOk           = item.classList.contains('ok');
        const tipoGroup      = item.getAttribute('data-tipo-group');
        const fechaFin       = item.getAttribute('data-fecha-fin');
        const sinFechaFin    = !fechaFin || fechaFin.trim() === '';
        const fechaInicioStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim() || '';
        const fechaInicioEl  = item.querySelectorAll('.equipment-fecha')[0];
        const fechaFinEl     = item.querySelectorAll('.equipment-fecha')[1];
        const tiempoStr      = item.querySelector('.equipment-time')?.textContent.trim() || '';
        const tipoVisible    = filterState.tipos[tipoGroup];

        // Limpiar clases de turno
        fechaInicioEl?.classList.remove('turno-actual', 'turno-anterior');
        fechaFinEl?.classList.remove('turno-actual', 'turno-anterior');

        let shouldShow = true;

        if (filterState.viewState === 'activos') {
            shouldShow = !isOk;
        } else if (filterState.viewState === 'turno') {
            if (sinFechaFin) {
                shouldShow = true;
            } else {
                const totalMinutos = extractTotalMinutos(tiempoStr);
                shouldShow = totalMinutos >= 58
                    && (isInTurnoActualOAnterior(fechaInicioStr) || isInTurnoActualOAnterior(fechaFin));
            }

            // Aplicar fondos de turno si es visible
            if (shouldShow) {
                const turnoInicio = getTurnoInfo(parseFechaFromString(fechaInicioStr));
                if (turnoInicio && fechaInicioEl) {
                    fechaInicioEl.classList.add(turnoInicio.esActual ? 'turno-actual' : 'turno-anterior');
                }
                if (!sinFechaFin) {
                    const turnoFin = getTurnoInfo(parseFechaFromString(fechaFin));
                    if (turnoFin && fechaFinEl) {
                        fechaFinEl.classList.add(turnoFin.esActual ? 'turno-actual' : 'turno-anterior');
                    }
                }
            }
        }

        // Fondo en fecha_fin vacía
        if (fechaFinEl) {
            sinFechaFin && !isOk
                ? fechaFinEl.classList.add('empty-fecha-fin')
                : fechaFinEl.classList.remove('empty-fecha-fin');
        }

        item.classList.remove('active-border');

        if (tipoVisible && shouldShow) {
            item.classList.remove('filtered-out');
            item.style.display = 'flex';
        } else {
            item.classList.add('filtered-out');
            item.style.display = 'none';
        }
    });

    if (filterState.viewState === 'turno') sortEquipmentItems();
}

function sortEquipmentItems() {
    document.querySelectorAll('.equipment-list').forEach(list => {
        const items = Array.from(list.querySelectorAll('.equipment-item:not(.filtered-out)'));

        const falla = items.filter(i => ['FALLA','STOP','PAUSA'].includes(i.getAttribute('data-tipo')));
        const mant  = items.filter(i => i.getAttribute('data-tipo') === 'MANT');

        const byFechaAsc = (a, b) => parseFechaInicio(a) - parseFechaInicio(b);
        falla.sort(byFechaAsc);
        mant.sort(byFechaAsc);

        [...falla, ...mant].forEach(item => list.appendChild(item));
    });
}


/* ============================================================
   8. FILTROS — SOLAR
   ============================================================ */

function getSolarFilterState() {
    const saved = sessionStorage.getItem('solar_filter_state');
    if (saved) return JSON.parse(saved);
    return { viewState: 'activos', tipos: { FALLA: true, MANT: true } };
}

function saveSolarFilterState(state) {
    sessionStorage.setItem('solar_filter_state', JSON.stringify(state));
}

function cycleViewStateSolar() {
    const filterState = getSolarFilterState();
    const states      = ['activos', 'turno'];
    filterState.viewState = states[(states.indexOf(filterState.viewState) + 1) % states.length];
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
        const isTurno2 = new Date().getHours() >= 8 && new Date().getHours() < 20;
        btn.textContent = isTurno2 ? 'Turno 1 | 2' : 'Turno 2 | 1';
    }
}

function toggleTipoFilterSolar(btn) {
    const tipo        = btn.getAttribute('data-tipo');
    const filterState = getSolarFilterState();
    filterState.tipos[tipo] = !filterState.tipos[tipo];
    btn.classList.toggle('active',   filterState.tipos[tipo]);
    btn.classList.toggle('inactive', !filterState.tipos[tipo]);
    saveSolarFilterState(filterState);
    applyAllFiltersSolar();
}

function applyAllFiltersSolar() {
    const filterState   = getSolarFilterState();
    const solarSections = ['inversores-rubi', 'inversores-clemesi', 'inversores-central'];

    solarSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (!section) return;

        section.querySelectorAll('.equipment-item').forEach(item => {
            const isOk        = item.classList.contains('ok');
            const tipoGroup   = item.getAttribute('data-tipo-group');
            const tipoVisible = filterState.tipos[tipoGroup] !== false;
            const fechaFin    = item.getAttribute('data-fecha-fin') || '';
            const sinFechaFin = !fechaFin || fechaFin.trim() === '';
            const fechaInicioStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim() || '';
            const fechaInicioEl  = item.querySelectorAll('.equipment-fecha')[0];
            const fechaFinEl     = item.querySelectorAll('.equipment-fecha')[1];
            const tiempoStr   = item.querySelector('.equipment-time')?.textContent.trim() || '';

            fechaInicioEl?.classList.remove('turno-actual', 'turno-anterior');
            fechaFinEl?.classList.remove('turno-actual', 'turno-anterior');

            let shouldShow = true;

            if (filterState.viewState === 'activos') {
                shouldShow = !isOk && sinFechaFin;
            } else if (filterState.viewState === 'turno') {
                if (sinFechaFin) {
                    shouldShow = true;
                } else {
                    const totalMinutos = extractTotalMinutos(tiempoStr);
                    shouldShow = totalMinutos >= 58
                        && (isInTurnoActualOAnterior(fechaInicioStr) || isInTurnoActualOAnterior(fechaFin));
                }

                if (shouldShow) {
                    const turnoInicio = getTurnoInfo(parseFechaFromString(fechaInicioStr));
                    if (turnoInicio && fechaInicioEl) {
                        fechaInicioEl.classList.add(turnoInicio.esActual ? 'turno-actual' : 'turno-anterior');
                    }
                    if (!sinFechaFin) {
                        const turnoFin = getTurnoInfo(parseFechaFromString(fechaFin));
                        if (turnoFin && fechaFinEl) {
                            fechaFinEl.classList.add(turnoFin.esActual ? 'turno-actual' : 'turno-anterior');
                        }
                    }
                }
            }

            if (fechaFinEl) {
                sinFechaFin && !isOk
                    ? fechaFinEl.classList.add('empty-fecha-fin')
                    : fechaFinEl.classList.remove('empty-fecha-fin');
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


/* ============================================================
   9. ACTUALIZAR DESDE SERVIDOR
   ============================================================ */

function ejecutarActualizarWind() {
    const button = event.target.closest('.btn-actualizar');
    button.classList.add('rotating');
    button.disabled = true;

    fetch('/api/ejecutar-actualizar-wind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Datos actualizados correctamente', 'success');
                setTimeout(() => window.location.reload(), 1000);
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


/* ============================================================
   10. TABLA REPORTE DIARIO
   ============================================================ */

function toggleTableVisibility() {
    const tableWrapper = document.querySelector('.table-wrapper');
    const icon         = document.querySelector('.toggle-table-button i');

    if (tableWrapper.classList.contains('hidden')) {
        const currentHour = new Date().getHours();
        const currentMin  = new Date().getMinutes();
        const currentTime = currentHour * 60 + currentMin;
        // Horario válido: 23:30 - 02:00
        if (!(currentTime >= 1410 || currentTime <= 120)) {
            showTimeWarningDialog();
        }
    }

    tableWrapper.classList.toggle('hidden');
    icon.className = tableWrapper.classList.contains('hidden')
        ? 'fas fa-chevron-down'
        : 'fas fa-chevron-up';
}

function loadDailyReportData() {
    fetch('/api/daily-report-data')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                populateDailyReportTable(data.data);
            } else {
                console.error('Error al cargar datos:', data.message);
            }
        })
        .catch(error => console.error('Error de conexión:', error));
}

function populateDailyReportTable(data) {
    const tbody = document.getElementById('daily-report-tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">No hay registros para mostrar</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.central}</td>
            <td>${row.aero}</td>
            <td>${row.circuito}</td>
            <td>${row.hora_inicio}</td>
            <td>${row.descripcion}</td>
            <td><span class="status ${row.estado_clase}">${row.estado_actual}</span></td>
            <td>${row.hora_fin}</td>
        `;
        tbody.appendChild(tr);
    });
}

function showTimeWarningDialog() {
    if (document.querySelector('.time-warning-dialog')) return;

    const dialog = document.createElement('div');
    dialog.className = 'merge-dialog time-warning-dialog';
    dialog.innerHTML = `
        <div class="merge-dialog-content">
            <button class="dialog-close-btn" onclick="closeTimeWarningDialog()">&times;</button>
            <h3><i class="fas fa-clock" style="color:#ffc107;"></i> Advertencia de Horario</h3>
            <div class="delete-warning-container">
                <div class="merge-warning" style="margin-bottom:15px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="time-warning-text">
                        Está visualizando el reporte fuera del horario establecido (23:30 - 02:00).
                    </span>
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

    const handleEscape = (e) => {
        if (e.key === 'Escape') { closeTimeWarningDialog(); document.removeEventListener('keydown', handleEscape); }
    };
    document.addEventListener('keydown', handleEscape);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeTimeWarningDialog(); });
}

function closeTimeWarningDialog() {
    const dialog = document.querySelector('.time-warning-dialog');
    if (dialog) dialog.remove();
}


/* ============================================================
   11. UTILIDADES
   ============================================================ */

/* ----------------------------
   11.1 Parseo de fechas
   ---------------------------- */
function parseFecha(fechaStr) {
    if (!fechaStr || fechaStr.trim() === '') return null;
    const [fecha, hora]    = fechaStr.split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const [horas, minutos] = hora ? hora.split(':') : ['0', '0'];
    const anioCompleto     = anio.length === 2 ? 2000 + parseInt(anio) : parseInt(anio);
    return new Date(anioCompleto, mes - 1, dia, horas, minutos, 0);
}

function parseFechaFromString(fechaStr) {
    return parseFecha(fechaStr);
}

function parseFechaInicio(item) {
    const fechaStr = item.querySelectorAll('.equipment-fecha')[0]?.textContent.trim();
    return fechaStr ? parseFecha(fechaStr) || new Date(0) : new Date(0);
}

/* ----------------------------
   11.2 Lógica de turnos
   ---------------------------- */
function getTurnoInfo(fecha) {
    if (!fecha) return null;

    const now         = new Date();
    const currentHour = now.getHours();
    let rangoActualInicio, rangoActualFin, rangoAnteriorInicio, rangoAnteriorFin;
    let turnoActual, turnoAnterior;

    if (currentHour >= 8 && currentHour < 20) {
        // Turno 2 activo (08:00–20:00)
        turnoActual   = 2; turnoAnterior = 1;
        rangoActualInicio   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8,  0, 0);
        rangoActualFin      = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
        rangoAnteriorFin    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8,  0, 0);
    } else {
        // Turno 1 activo (20:00–08:00)
        turnoActual   = 1; turnoAnterior = 2;
        if (currentHour >= 20) {
            rangoActualInicio   = new Date(now.getFullYear(), now.getMonth(), now.getDate(),     20, 0, 0);
            rangoActualFin      = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1,  8, 0, 0);
            rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(),      8, 0, 0);
            rangoAnteriorFin    = new Date(now.getFullYear(), now.getMonth(), now.getDate(),     20, 0, 0);
        } else {
            rangoActualInicio   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
            rangoActualFin      = new Date(now.getFullYear(), now.getMonth(), now.getDate(),      8, 0, 0);
            rangoAnteriorInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1,  8, 0, 0);
            rangoAnteriorFin    = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
        }
    }

    if (fecha >= rangoActualInicio   && fecha < rangoActualFin)   return { turno: turnoActual,   esActual: true  };
    if (fecha >= rangoAnteriorInicio && fecha < rangoAnteriorFin) return { turno: turnoAnterior, esActual: false };
    return null;
}

function isInTurnoActualOAnterior(fechaStr) {
    const fecha = parseFechaFromString(fechaStr);
    return fecha ? getTurnoInfo(fecha) !== null : false;
}

/* ----------------------------
   11.3 Tiempo y ordenamiento
   ---------------------------- */
function extractTotalMinutos(tiempoStr) {
    if (!tiempoStr || tiempoStr.trim() === '') return 0;
    let dias = 0, horas = 0, minutos = 0;
    const matchD = tiempoStr.match(/(\d+)d/);
    const matchH = tiempoStr.match(/(\d+)h/);
    const matchM = tiempoStr.match(/(\d+)m/);
    if (matchD) dias    = parseInt(matchD[1]);
    if (matchH) horas   = parseInt(matchH[1]);
    if (matchM) minutos = parseInt(matchM[1]);
    return (dias * 1440) + (horas * 60) + minutos;
}
