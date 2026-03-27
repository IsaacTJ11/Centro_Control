// error_conexion.js

function reintentarConexion(btn) {
    // Animación de giro en el ícono
    btn.classList.add('spinning');
    btn.disabled = true;

    // Reintentar después de un breve delay visual
    setTimeout(() => {
        window.location.reload();
    }, 800);
}