document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const breadcrumb = document.getElementById('breadcrumb');

    // Persistir estado colapsado entre páginas
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    }
    // Quitar clase pre-colapso y re-habilitar transiciones
    requestAnimationFrame(() => {
        document.documentElement.classList.remove('sidebar-pre-collapsed');
    });

    // Menu toggle functionality
    if (menuToggle) {
        // Sincronizar ícono al cargar
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

    // ── Helper: cerrar todos los flotantes ──
    function closeAllFloatingSubmenus() {
        document.querySelectorAll('.submenu.floating').forEach(sm => {
            sm.classList.remove('floating', 'show');
            sm.style.top = '';
        });
        window._activeFloatingSubmenu = null;
    }

    // ── Submenu toggle ──
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-submenu]');
    sidebarItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const submenuId = this.dataset.submenu + '-submenu';
            const submenu = document.getElementById(submenuId);
            const arrow = this.querySelector('.submenu-arrow');
            const isCollapsed = sidebar.classList.contains('collapsed');

            if (!submenu) return;

            if (isCollapsed) {
                // ── Modo flotante ──
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
                // ── Modo normal (empuja contenido) ──
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

    // ── Cerrar flotante al navegar desde submenú ──
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', function () {
            closeAllFloatingSubmenus();
        });
    });

    // ── Cerrar flotante al hacer click fuera del sidebar ──
    document.addEventListener('click', function (e) {
        if (!sidebar.contains(e.target)) {
            closeAllFloatingSubmenus();
        }
    });

    // ── Forzar colapsado en móvil ──
    function checkMobile() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('expanded');
        }
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Navigation functionality
    const navigationItems = document.querySelectorAll('[data-page]');
    navigationItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page) {
                loadPage(page);
            }
        });
    });

    // Update active states based on current path
    updateActiveStates();

    // Update breadcrumb based on current page
    updateBreadcrumbFromPath();

    // Add smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    function updateToggleIcon() {
        const icon = menuToggle.querySelector('i');
        if (!icon) return;
        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-angles-right';
        } else {
            icon.className = 'fas fa-bars';
        }
    }

    initPageScripts(window.location.pathname);

    window._currentPage = window.location.pathname;

});

function updateActiveStates() {
    // Limpiar clases pre-activas del paint inicial
    document.querySelectorAll('.pre-active-parent').forEach(el => el.classList.remove('pre-active-parent'));
    document.querySelectorAll('.pre-active-submenu').forEach(el => el.classList.remove('pre-active-submenu'));
    document.querySelectorAll('.pre-active-child').forEach(el => el.classList.remove('pre-active-child'));
    sessionStorage.removeItem('pre_active_submenu');
    sessionStorage.removeItem('pre_active_page');

    const path = window.location.pathname;
    const currentItem = document.querySelector(`.submenu-item[data-page="${path}"], .sidebar-item[data-page="${path}"]`);

    if (currentItem) {
        document.querySelectorAll('.sidebar-item, .submenu-item').forEach(el => el.classList.remove('active'));
        currentItem.classList.add('active');

        if (currentItem.classList.contains('submenu-item')) {
            const submenu = currentItem.closest('.submenu');
            if (submenu) {
                const parentId = submenu.id.replace('-submenu', '');
                const parentItem = document.querySelector(`[data-submenu="${parentId}"]`);
                if (parentItem) {
                    parentItem.classList.add('active');
                    if (!sidebar.classList.contains('collapsed')) {
                        submenu.classList.add('show');
                        const arrow = parentItem.querySelector('.submenu-arrow');
                        if (arrow) arrow.classList.add('rotated');
                    }
                }
            }
        }
    }
}

function updateBreadcrumbFromPath() {
    const currentPath = window.location.pathname;
    const breadcrumbMap = {
        '/': 'Home',
        '/huinco': 'Home > Embalse y Desembalse > Presa Huinco',
        '/tulumayo': 'Home > Embalse y Desembalse > Presa Tulumayo',
        '/matucana': 'Home > Embalse y Desembalse > Pulmón Matucana',
        '/bypass': 'Home > Regulación de Compuertas > Compuerta Bypass',
        '/moyopampa': 'Home > Regulación de Compuertas > Compuertas Toma Moyopampa',
        '/config-compuertas': 'Home > Regulación de Compuertas > Configuración de Parámetros',
        '/costo-marginal': 'Home > COES > Costo Marginal Proyectado',
        '/despacho': 'Home > COES > Despacho Proyectado',
        '/rsf': 'Home > COES > RSF Proyectado',
        '/indis-diaria': 'Home > Indisponibilidades > Indisponibilidad Diaria',
        '/estado-equipos': 'Home > Reportes RER > Estado de aerogeneradores e inversores',
        '/estado-hydro': 'Home > Reportes Hydro > Estado Unidades Hydro'
    };

    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb && breadcrumbMap[currentPath]) {
        breadcrumb.textContent = breadcrumbMap[currentPath];
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    // Add styles
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

    // Add to document
    document.body.appendChild(notification);

    // Close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        margin-left: auto;
        opacity: 0.7;
    }
    
    .notification-close:hover {
        opacity: 1;
    }
`;

// Mapa de página → función de inicialización
const PAGE_INIT_MAP = {
    '/rpf':          () => window.initRpf?.(),
    '/huinco':       () => window.initEmbalse?.(),
    '/tulumayo':     () => window.initEmbalse?.(),
    '/matucana':     () => window.initEmbalse?.(),
    '/fondo_huinco': () => window.initCompuertas?.(),
    '/bypass_huinco':() => window.initCompuertas?.(),
    '/reportes_rer': () => window.initReportes?.(),
};

function loadPage(page) {
    const mainContent = document.getElementById('main-content');

    if (window.location.pathname === page && window._currentPage === page) return;
    window._currentPage = page;

    window.history.pushState({ page }, '', page);
    updateActiveStates();
    updateBreadcrumbFromPath();

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
            const doc = parser.parseFromString(html, 'text/html');

            // PASO 1: Inyectar CSS nuevo y esperar que carguen (SIN limpiar aún)
            const cssPromises = [];
            const newLinks = [];
            doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.includes('styles.css') && !href.includes('font-awesome') && !href.includes('fonts.googleapis')) {
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = href;
                    newLink.setAttribute('data-page-css', '');
                    cssPromises.push(new Promise(resolve => {
                        newLink.addEventListener('load', resolve, { once: true });
                        newLink.addEventListener('error', resolve, { once: true });
                    }));
                    newLinks.push(newLink);
                    document.head.appendChild(newLink);
                }
            });

            // PASO 2: CSS nuevo cargado → AHORA limpiar el anterior → luego scripts
            Promise.all(cssPromises).then(() => {
                document.querySelectorAll('link[rel="stylesheet"][data-page-css]').forEach(l => {
                    if (!newLinks.includes(l)) l.remove();
                });

                const scriptPromises = [];
                // ... resto del PASO 2 sin cambios
                doc.querySelectorAll('script[src]').forEach(script => {
                    const src = script.getAttribute('src');
                    if (!src) return;
                    const existing = document.querySelector(`script[src="${src}"]`);
                    if (existing) {
                        // Script ya cargado: removerlo y recargarlo para que re-ejecute
                        existing.remove();
                    }
                    scriptPromises.push(new Promise(resolve => {
                        const newScript = document.createElement('script');
                        newScript.src = src;
                        newScript.onload = resolve;
                        newScript.onerror = resolve;
                        document.body.appendChild(newScript);
                    }));
                });

                // PASO 3: Scripts listos → inyectar contenido
                Promise.all(scriptPromises).then(() => {
                    const newContent = doc.querySelector('#main-content');
                    if (newContent) {
                        mainContent.innerHTML = newContent.innerHTML;
                    }

                    // PASO 4: Esperar imágenes → init scripts de página
                    const images = mainContent.querySelectorAll('img');
                    const imagePromises = Array.from(images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.addEventListener('load', resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                        });
                    });

                    Promise.all(imagePromises).then(() => {
                        // PASO 5: Todo listo → init + fade in
                        initPageScripts(page);
                        requestAnimationFrame(() => {
                            mainContent.style.opacity = '1';
                        });
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
    if (e.state && e.state.page) {
        loadPage(e.state.page);
    }
});

function initPageScripts(page) {
    // Limpiar intervalo anterior
    if (window._autoReloadInterval) {
        clearInterval(window._autoReloadInterval);
        window._autoReloadInterval = null;
    }

    // Llamar función de init específica de la página
    const initFn = PAGE_INIT_MAP[page];
    if (initFn) initFn();

    // Auto-recarga cada 5 min en reportes_rer
    if (page === '/reportes_rer') {
        window._autoReloadInterval = setInterval(() => {
            loadPage('/reportes_rer');
        }, 5 * 60 * 1000);
    }
}

document.head.appendChild(style);