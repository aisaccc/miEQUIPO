import * as usuariosService from '../services/usuarios.service.js';
import { validar } from '../validators/index.js';
import {
  schemaUuidParam,
  schemaActualizarPerfil,
  schemaActualizarDeportes,
  schemaCambiarPassword,
  schemaEliminarCuenta,
  schemaBuscarUsuarios,
} from '../validators/usuarios.schema.js';

export async function obtenerMiPerfil(req, res, next) {
  try {
    const perfil = await usuariosService.obtenerMiPerfil(req.usuario.id);
    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function obtenerMiPlan(req, res, next) {
  try {
    const plan = await usuariosService.obtenerMiPlan(req.usuario.id);
    res.json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const id = validar(
      schemaUuidParam,
      req.params.id || req.params.usuarioId
    );

    const perfil = await usuariosService.obtenerPerfilPublico(
      id,
      req.usuario.id
    );

    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function actualizarMiPerfil(req, res, next) {
  try {
    const datos = validar(schemaActualizarPerfil, req.body);

    const perfil = await usuariosService.actualizarMiPerfil(
      req.usuario.id,
      datos
    );

    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function actualizarMisDeportes(req, res, next) {
  try {
    const datos = validar(schemaActualizarDeportes, req.body);

    const perfil = await usuariosService.actualizarMisDeportes(
      req.usuario.id,
      datos.deportes
    );

    res.json({ usuario: perfil });
  } catch (err) {
    next(err);
  }
}

export async function cambiarMiPassword(req, res, next) {
  try {
    const datos = validar(schemaCambiarPassword, req.body);

    const resultado = await usuariosService.cambiarMiPassword(
      req.usuario.id,
      datos.passwordActual,
      datos.passwordNueva
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function eliminarMiCuenta(req, res, next) {
  try {
    const datos = validar(
      schemaEliminarCuenta,
      req.body
    );

    const resultado = await usuariosService.eliminarMiCuenta(
      req.usuario.id,
      datos.password
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
export async function buscar(req, res, next) {
  try {
    const { q } = req.query;

    if (typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ usuarios: [] });
    }

    const datos = validar(schemaBuscarUsuarios, {
      q: q.trim(),
    });

    const usuarios = await usuariosService.buscarUsuarios(
      datos.q,
      req.usuario.id
    );

    res.json({ usuarios });
  } catch (err) {
    next(err);
  }
}