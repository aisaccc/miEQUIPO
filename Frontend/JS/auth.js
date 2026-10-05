/* =========================================================
   auth.js — Re-export del service de auth real
   =========================================================
   Este archivo existía antes con la lógica mock (data-mock.js).
   Ahora delega todo al service que habla con el backend.

   Mantiene la misma interfaz para no romper:
   - auth-page.js
   - store.js
   - mi-equipo.js
   - cualquier otro archivo que importe desde './auth.js'
*/

export {
  login,
  registro,
  logout,
  logoutAll,
  getSesion,
  setSesion,
  cerrarSesion,
  estaAutenticado,
  obtenerUsuarioActual,
  refrescarSesion,
  verificarEmail,
} from './services/auth.service.js';