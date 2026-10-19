import * as usuariosService from '../services/usuarios.service.js';
import { validar } from '../validators/index.js';
import { schemaUuidParam } from '../validators/usuarios.schema.js';

export async function obtenerMiPerfil(req, res, next) {
  try {
    const perfil = await usuariosService.obtenerMiPerfil(req.usuario.id);
    // ⚡ FIX: Envolvemos en { usuario: ... }
    res.json({ usuario: perfil }); 
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id || req.params.usuarioId);
    const perfil = await usuariosService.obtenerPerfilPublico(id, req.usuario.id);
    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function actualizarMiPerfil(req, res, next) {
  try {
    const perfil = await usuariosService.actualizarMiPerfil(req.usuario.id, req.body);
    // ⚡ FIX: Envolvemos en { usuario: ... }
    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function actualizarMisDeportes(req, res, next) {
  try {
    const perfil = await usuariosService.actualizarMisDeportes(req.usuario.id, req.body.deportes);
    // ⚡ FIX: Envolvemos en { usuario: ... }
    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function cambiarMiPassword(req, res, next) {
  try {
    const { passwordActual, passwordNueva } = req.body;
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

export async function eliminarMiCuenta(req, res, next) {
  try {
    const { password } = req.body;
    const resultado = await usuariosService.eliminarMiCuenta(req.usuario.id, password);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function buscar(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ usuarios: [] });
    const usuarios = await usuariosService.buscarUsuarios(q, req.usuario.id);
    res.json({ usuarios });
  } catch (err) {
    next(err);
  }
}