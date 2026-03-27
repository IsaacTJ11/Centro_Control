<<<<<<< HEAD
// error_conexion.js

function reintentarConexion(btn) {
    // Animación de giro en el ícono
    btn.classList.add('spinning');
    btn.disabled = true;

    // Reintentar después de un breve delay visual
    setTimeout(() => {
        window.location.reload();
    }, 800);
=======
// error_conexion.js

function reintentarConexion(btn) {
    // Animación de giro en el ícono
    btn.classList.add('spinning');
    btn.disabled = true;

    // Reintentar después de un breve delay visual
    setTimeout(() => {
        window.location.reload();
    }, 800);
>>>>>>> d8ad0b27ff8876c3ce36c1e1edf5e1db272e0c05
}