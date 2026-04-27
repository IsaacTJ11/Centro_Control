/* ============================================================
   1. INICIALIZACIÓN Y ESTADO GLOBAL
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

    /* ----------------------------
       1.1 Referencias DOM
       ---------------------------- */
    const menuToggle  = document.getElementById('menu-toggle');
    const sidebar     = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    /* ----------------------------
       1.2 Estado inicial del sidebar
       ---------------------------- */
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    }

    // Quitar clase pre-colapso y re-habilitar transiciones
    requestAnimationFrame(() => {
        document.documentElement.classList.remove('sidebar-pre-collapsed');
    });

    /* ----------------------------
       1.3 Toggle del menú
       ---------------------------- */
    if (menuToggle) {
        updateToggleIcon();

        menuToggle.addEventListener('click', function () {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');

            const isNowCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isNowCollapsed);
            updateToggleIcon();

            if (!isNowCollapsed) {
                closeAllFloatingSubmenus();
                updateActiveStates();
            }
        });
    }

    /* ----------------------------
       1.4 Submenús
       ---------------------------- */
    function closeAllFloatingSubmenus() {
        document.querySelectorAll('.submenu.floating').forEach(sm => {
            sm.classList.remove('floating', 'show');
            sm.style.top = '';
        });
        window._activeFloatingSubmenu = null;
    }

    const sidebarItems = document.querySelectorAll('.sidebar-item[data-submenu]');
    sidebarItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const submenuId = this.dataset.submenu + '-submenu';
            const submenu   = document.getElementById(submenuId);
            const arrow     = this.querySelector('.submenu-arrow');
            const isCollapsed = sidebar.classList.contains('collapsed');

            if (!submenu) return;

            if (isCollapsed) {
                // Modo flotante
                if (window._activeFloatingSubmenu === submenu) {
                    closeAllFloatingSubmenus();
                    return;
                }
                closeAllFloatingSubmenus();
                const rect = this.getBoundingClientRect();
                submenu.style.top = rect.top + 'px';
                submenu.classList.add('floating', 'show');
                window._activeFloatingSubmenu = submenu;
            } else {
                // Modo normal (empuja contenido)
                closeAllFloatingSubmenus();
                const isOpen = submenu.classList.contains('show');

                document.querySelectorAll('.submenu.show').forEach(sm => sm.classList.remove('show'));
                document.querySelectorAll('.submenu-arrow.rotated').forEach(a => a.classList.remove('rotated'));

                if (!isOpen) {
                    submenu.classList.add('show');
                    if (arrow) arrow.classList.add('rotated');
                }
            }
        });
    });

    // Cerrar flotante al navegar desde submenú
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', function () {
            closeAllFloatingSubmenus();
        });
    });

    // Cerrar flotante al hacer click fuera del sidebar
    document.addEventListener('click', function (e) {
        if (!sidebar.contains(e.target)) {
            closeAllFloatingSubmenus();
        }
    });

    /* ----------------------------
       1.5 Forzar colapsado en móvil
       ---------------------------- */
    function checkMobile() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('expanded');
        }
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);

    /* ----------------------------
       1.6 Navegación SPA
       ---------------------------- */
    const navigationItems = document.querySelectorAll('[data-page]');
    navigationItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page) loadPage(page);
        });
    });

    /* ----------------------------
       1.7 Init de página actual
       ---------------------------- */
    updateActiveStates();
    initPageScripts(window.location.pathname);
    window._currentPage = window.location.pathname;
});


/* ============================================================
   2. SIDEBAR — ESTADO ACTIVO
   ============================================================ */

function updateActiveStates() {
    const path = window.location.pathname;

    // Limpiar clases pre-activas
    document.querySelectorAll('.pre-active-parent').forEach(el => el.classList.remove('pre-active-parent'));
    document.querySelectorAll('.pre-active-submenu').forEach(el => el.classList.remove('pre-active-submenu'));
    document.querySelectorAll('.pre-active-child').forEach(el => el.classList.remove('pre-active-child'));

    const currentItem = document.querySelector(
        `.submenu-item[data-page="${path}"], .sidebar-item[data-page="${path}"]`
    );

    // Detectar qué submenú necesita estar abierto
    let targetSubmenu    = null;
    let targetParentItem = null;
    if (currentItem && currentItem.classList.contains('submenu-item')) {
        targetSubmenu = currentItem.closest('.submenu');
        if (targetSubmenu) {
            const parentId   = targetSubmenu.id.replace('-submenu', '');
            targetParentItem = document.querySelector(`[data-submenu="${parentId}"]`);
        }
    }

    // Limpiar todos los activos
    document.querySelectorAll('.sidebar-item, .submenu-item').forEach(el => el.classList.remove('active'));

    // Colapsar solo los submenús que no son el destino
    document.querySelectorAll('.submenu.show').forEach(sm => {
        if (sm !== targetSubmenu) sm.classList.remove('show');
    });
    document.querySelectorAll('.submenu-arrow.rotated').forEach(arrow => {
        const parentItem = arrow.closest('.sidebar-item');
        if (parentItem !== targetParentItem) arrow.classList.remove('rotated');
    });

    if (currentItem) {
        currentItem.classList.add('active');

        if (targetSubmenu && targetParentItem) {
            targetParentItem.classList.add('active');
            if (!sidebar.classList.contains('collapsed')) {
                targetSubmenu.classList.add('show');
                const arrow = targetParentItem.querySelector('.submenu-arrow');
                if (arrow) arrow.classList.add('rotated');
            }
        }
    }

    sessionStorage.removeItem('pre_active_submenu');
    sessionStorage.removeItem('pre_active_page');
}

function updateToggleIcon() {
    const menuToggle = document.getElementById('menu-toggle');
    const icon = menuToggle?.querySelector('i');
    if (!icon) return;
    const sidebar = document.getElementById('sidebar');
    icon.className = sidebar.classList.contains('collapsed')
        ? 'fas fa-angles-right'
        : 'fas fa-bars';
}


/* ============================================================
   3. NAVEGACIÓN SPA
   ============================================================ */

function waitForInitAndRun(page, attempts = 0) {
    const MAX_ATTEMPTS = 30; // 30 × 100ms = 3s máximo
    const initFn = PAGE_INIT_MAP[page];

    if (!initFn) return;

    const fnReady = {
        '/embalse_huinco':   () => typeof window.initEmbalse    === 'function',
        '/embalse_tulumayo': () => typeof window.initEmbalse    === 'function',
        '/pulmon_matucana':  () => typeof window.initEmbalse    === 'function',
        '/fondo_huinco':     () => typeof window.initCompuertas === 'function',
        '/bypass_huinco':    () => typeof window.initCompuertas === 'function',
        '/rpf':              () => typeof window.initRpf        === 'function',
        '/reportes_rer':     () => typeof window.initReportes   === 'function',
        '/costo-marginal':   () => typeof window.initCoes === 'function',
    };

    const isReady = fnReady[page];

    if (!isReady || isReady()) {
        initFn();
    } else if (attempts < MAX_ATTEMPTS) {
        setTimeout(() => waitForInitAndRun(page, attempts + 1), 100);
    } else {
        console.warn(`[waitForInitAndRun] initFn para ${page} no disponible tras ${MAX_ATTEMPTS} intentos`);
    }
}

function loadPage(page) {
    const mainContent = document.getElementById('main-content');

    if (window.location.pathname === page && window._currentPage === page) return;
    window._currentPage = page;

    window.history.pushState({ page }, '', page);
    updateActiveStates();

    // Fade out
    mainContent.style.transition = 'none';
    mainContent.style.opacity = '1';
    requestAnimationFrame(() => {
        mainContent.style.transition = 'opacity 0.1s ease';
        mainContent.style.opacity = '0';
    });

    fetch(page, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(res => res.text())
        .then(html => {
            const parser = new DOMParser();
            const doc    = parser.parseFromString(html, 'text/html');

            /* ----------------------------
               PASO 1: Inyectar CSS nuevo y esperar que carguen
               ---------------------------- */
            const cssPromises = [];
            const newLinks    = [];

            doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                const href = link.getAttribute('href');
                if (href
                    && !href.includes('styles.css')
                    && !href.includes('font-awesome')
                    && !href.includes('fonts.googleapis')
                ) {
                    const newLink = document.createElement('link');
                    newLink.rel   = 'stylesheet';
                    newLink.href  = href;
                    newLink.setAttribute('data-page-css', '');
                    cssPromises.push(new Promise(resolve => {
                        newLink.addEventListener('load',  resolve, { once: true });
                        newLink.addEventListener('error', resolve, { once: true });
                    }));
                    newLinks.push(newLink);
                    document.head.appendChild(newLink);
                }
            });

            /* ----------------------------
               PASO 2: CSS nuevo cargado → limpiar anterior → cargar scripts
               ---------------------------- */
            Promise.all(cssPromises).then(() => {
                document.querySelectorAll('link[rel="stylesheet"][data-page-css]').forEach(l => {
                    if (!newLinks.includes(l)) l.remove();
                });

                // Scripts globales que NUNCA deben recargarse durante navegación SPA
                const SKIP_SCRIPTS = [
                    'main.js',
                    'fonts.googleapis'
                ];

                const scriptPromises = [];
                doc.querySelectorAll('script[src]').forEach(script => {
                    const src = script.getAttribute('src');
                    if (!src) return;
                    if (SKIP_SCRIPTS.some(s => src.includes(s))) return;

                    // Para CDNs externos: solo cargar si no existe ya en el DOM
                    const isCDN = src.includes('cdn.jsdelivr.net') || src.includes('cdnjs.cloudflare.com');
                    if (isCDN) {
                        if (document.querySelector(`script[src="${src}"]`)) return; // ya cargado, omitir
                    } else {
                        // Scripts locales de página: recargar siempre para tener versión fresca
                        const existing = document.querySelector(`script[src="${src}"]`);
                        if (existing) existing.remove();
                    }

                    scriptPromises.push(new Promise(resolve => {
                        const newScript   = document.createElement('script');
                        newScript.src     = src;
                        newScript.onload  = resolve;
                        newScript.onerror = resolve;
                        document.body.appendChild(newScript);
                    }));
                });

                /* ----------------------------
                   PASO 3: Scripts listos → inyectar contenido
                   ---------------------------- */
                Promise.all(scriptPromises).then(() => {
                    const newContent = doc.querySelector('#main-content');
                    if (newContent) mainContent.innerHTML = newContent.innerHTML;

                    /* ----------------------------
                       PASO 4: Esperar imágenes → init scripts de página
                       ---------------------------- */
                    const images = mainContent.querySelectorAll('img');
                    const imagePromises = Array.from(images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.addEventListener('load',  resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                        });
                    });

                    /* ----------------------------
                       PASO 5: Todo listo → init + fade in
                       ---------------------------- */
                    Promise.all(imagePromises).then(() => {
                        requestAnimationFrame(() => {
                            mainContent.style.opacity = '1';
                        });
                        // Dar un tick al navegador para ejecutar los scripts recién insertados
                        setTimeout(() => waitForInitAndRun(page), 0);
                    });
                });
            });
        })
        .catch(() => {
            mainContent.style.opacity = '1';
            window.location.href = page;
        });
}

// Manejar botón "atrás" del navegador
window.addEventListener('popstate', function (e) {
    if (e.state && e.state.page) loadPage(e.state.page);
});


/* ============================================================
   4. INICIALIZACIÓN POR PÁGINA
   ============================================================ */

/* ----------------------------
   4.1 Mapa de página → función init
   ---------------------------- */
const PAGE_INIT_MAP = {
    '/rpf':               () => window.initRpf?.(),
    '/embalse_huinco':    () => window.initEmbalse?.(),
    '/embalse_tulumayo':  () => window.initEmbalse?.(),
    '/pulmon_matucana':   () => window.initEmbalse?.(),
    '/fondo_huinco':      () => window.initCompuertas?.(),
    '/bypass_huinco':     () => window.initCompuertas?.(),
    '/reportes_rer':      () => window.initReportes?.(),
    '/costo-marginal':    () => window.initCoes?.(),
};

/* ----------------------------
   4.2 Ejecutar init y limpiar intervalos anteriores
   ---------------------------- */
function initPageScripts(page) {
    if (window._autoReloadInterval) {
        clearInterval(window._autoReloadInterval);
        window._autoReloadInterval = null;
    }

    waitForInitAndRun(page);

    if (page === '/reportes_rer') {
        window._autoReloadInterval = setInterval(() => {
            if (window.location.pathname === '/reportes_rer') {
                loadPage('/reportes_rer');
            } else {
                clearInterval(window._autoReloadInterval);
                window._autoReloadInterval = null;
            }
        }, 5 * 60 * 1000);
    }
}


/* ============================================================
   5. NOTIFICACIONES
   ============================================================ */

// Los estilos de notificación (.notification-close, @keyframes slideIn)
// están definidos en styles.css

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });

    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 5000);
}
