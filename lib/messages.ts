export const MESSAGES: Record<string, string> = {
  permiso: "Tu rol no permite realizar esa acción.",
  transicion:
    "Ese cambio de estado ya no está disponible. La pantalla se ha actualizado.",
  datos: "Faltan datos o no son válidos. Revisa el formulario.",
  sesion:
    "La mesa no tiene un servicio abierto. Abre la mesa antes de tomar la comanda.",
  comanda: "Comanda enviada a cocina.",
  lineas: "Platos añadidos a la comanda abierta.",
  estado: "Estado actualizado.",
  cancelado: "Plato cancelado y registrado en auditoría.",
  mesa_abierta: "Mesa abierta. Ya se pueden tomar comandas.",
  mesa_cerrada: "Mesa cerrada y comandas archivadas.",
  sin_impresora:
    "La comanda no tiene impresoras activas asignadas a sus estaciones.",
  cuenta_error: "Esa solicitud de cuenta ya no se puede actualizar.",
  cuenta: "Solicitud de cuenta actualizada.",
  reimpresion: "Ticket enviado de nuevo a la cola de impresión.",
  plato_guardado: "Plato guardado.",
  plato_eliminado: "Plato eliminado de la carta.",
  plato_archivado: "Plato archivado: deja de aparecer en la carta pública.",
  precio: "El precio no es válido. Usa un formato como 12,50.",
  imagen: "La imagen debe ser una ruta local (/demo/…) o una URL https.",
  mesa_duplicada: "Ya existe una mesa con ese nombre en este restaurante.",
  mesa_en_servicio: "La mesa tiene un servicio abierto. Ciérralo antes de eliminarla.",
  mesa_desactivada:
    "La mesa conserva historial, así que se ha desactivado en lugar de borrarse.",
  mesa_eliminada: "Mesa eliminada.",
  qr_regenerado:
    "QR regenerado. El código anterior deja de funcionar: sustituye los carteles impresos.",
  categoria_con_platos:
    "No se puede eliminar una categoría que todavía tiene platos. Muévelos o archívalos primero.",
  categoria_guardada: "Categoría guardada.",
  categoria_eliminada: "Categoría eliminada.",
  mesa_guardada: "Mesa guardada.",
  estacion_duplicada: "Ya existe una estación con ese nombre.",
  estacion_con_platos:
    "La estación tiene platos asignados. Reasígnalos antes de eliminarla.",
  estacion_eliminada: "Estación eliminada.",
  estacion_guardada: "Estación de cocina guardada.",
  ultimo_propietario:
    "No puedes dejar el restaurante sin ningún propietario. Asigna el rol a otra persona primero.",
  no_autoeliminar: "No puedes retirar tu propio acceso desde esta pantalla.",
  equipo_invitado: "Invitación creada. Comparte la contraseña temporal por un canal seguro.",
  equipo_actualizado: "Equipo actualizado.",
  equipo_eliminado: "Acceso retirado.",
  impresora_duplicada: "Ya existe una impresora con ese nombre.",
  impresora_ocupada:
    "La impresora tiene trabajos pendientes. Espera a que se impriman o revócalos antes de eliminarla.",
  impresora_desactivada:
    "La impresora tiene trabajos en el historial, así que se ha desactivado.",
  agente_revocado: "Token de agente revocado.",
  trabajo_reintentado: "Trabajo devuelto a la cola de impresión.",
  impresora_guardada: "Impresora guardada.",
  impresora_eliminada: "Impresora eliminada.",
  token_creado: "Token de agente creado. Cópialo ahora: no se volverá a mostrar.",
  token_revocado: "Token de agente revocado.",
  restaurante_slug: "Ese slug ya está en uso. Elige otro.",
  restaurante_guardado: "Restaurante actualizado.",
  restaurante_creado: "Restaurante creado.",
  restaurante_desactivado: "Estado del restaurante actualizado.",
  prueba_impresion: "Ticket de prueba en cola.",
  cancelacion: "Cancelación registrada.",
};
