/* =========================================================
   usuarios.controller.js — Manejo de req/res de usuarios
   =========================================================
   Los controllers SOLO:
   - Extraen datos de req
   - Llaman al service
   - Devuelven res
   
   La lógica de negocio vive en services/usuarios.service.js
*/

import * as usuariosService from '../services/usuarios.service.js';
import { validar } from '../validators/index.js';
import {
  schemaActualizarPerfil,
  schemaActualizarDeportes,
  schemaCambiarPassword,
  schemaEliminarCuenta,
  schemaUuidParam,
} from '../validators/usuarios.schema.js';

/* =========================================================
   GET /api/usuarios/me
   =========================================================
   Requiere auth.
   Devuelve el perfil completo del usuario autenticado.
*/
export async function getMiPerfil(req, res, next) {
  try {
    const usuario = await usuariosService.obtenerMiPerfil(req.usuario.id);
    res.json({ usuario });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/usuarios/me
   =========================================================
   Requiere auth.
   Actualiza el perfil del usuario autenticado.
   Solo acepta campos de la whitelist (nombre, username, bio, etc).
*/
export async function patchMiPerfil(req, res, next) {
  try {
    // 1. Validar con Zod (.strict() rechaza campos extra)
    const cambios = validar(schemaActualizarPerfil, req.body);

    // 2. Llamar al service con el ID del token (no del body)
    const usuario = await usuariosService.actualizarMiPerfil(
      req.usuario.id,
      cambios
    );

    res.json({
      mensaje: 'Perfil actualizado correctamente',
      usuario,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/usuarios/me/deportes
   =========================================================
   Requiere auth.
   Reemplaza TODO el array de deportes del usuario.
*/
export async function patchMisDeportes(req, res, next) {
  try {
    const { deportes } = validar(schemaActualizarDeportes, req.body);

    const usuario = await usuariosService.actualizarMisDeportes(
      req.usuario.id,
      deportes
    );

    res.json({
      mensaje: 'Deportes actualizados',
      usuario,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/usuarios/me/password
   =========================================================
   Requiere auth.
   Cambia la contraseña. Requiere la actual.
   Revoca todas las sesiones activas.
*/
export async function patchMiPassword(req, res, next) {
  try {
    const { passwordActual, passwordNueva } = validar(
      schemaCambiarPassword,
      req.body
    );

    const resultado = await usuariosService.cambiarMiPassword(
      req.usuario.id,
      passwordActual,
      passwordNueva
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/usuarios/me
   =========================================================
   Requiere auth.
   Elimina la cuenta (soft delete).
   Requiere password + escribir "ELIMINAR".
*/
export async function deleteMiCuenta(req, res, next) {
  try {
    const { password } = validar(schemaEliminarCuenta, req.body);

    const resultado = await usuariosService.eliminarMiCuenta(
      req.usuario.id,
      password
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/usuarios/:id
   =========================================================
   Requiere auth.
   Devuelve el perfil PÚBLICO de otro usuario.
   
   SEGURIDAD:
   - Filtra stats privadas
   - Solo devuelve campos públicos
   - No permite listar todos
*/
export async function getPerfilPublico(req, res, next) {
  try {
    // Validar que el :id sea un UUID válido
    const id = validar(schemaUuidParam, req.params.id);

    const usuario = await usuariosService.obtenerPerfilPublico(id);

    res.json({ usuario });
  } catch (err) {
    next(err);
  }
}