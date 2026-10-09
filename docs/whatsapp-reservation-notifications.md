# Avisos de reservas finalizadas por WhatsApp

La API crea un aviso aislado por negocio cuando una reserva cambia a `completada`. El destino se toma del campo WhatsApp guardado en la configuración de ese negocio. El aviso contiene los datos de la reserva y los datos de cliente disponibles en la base de datos.

## Variables de entorno del backend

Configurar en el servicio de backend (por ejemplo, Render → servicio → Environment), nunca en variables `VITE_*` ni en el código:

- `WA_ACCESS_TOKEN`: token de acceso de WhatsApp Cloud API.
- `WA_PHONE_NUMBER_ID`: ID del número emisor registrado en Meta WhatsApp Cloud API. No es el número de destino del negocio.
- `WA_GRAPH_API_VERSION`: versión Graph API; opcional, por defecto `v22.0`.
- `WA_TEMPLATE_NAME`: opcional, nombre de una plantilla de WhatsApp aprobada. Para avisos proactivos fuera de la ventana de atención, se recomienda configurar una plantilla aprobada cuyo cuerpo tenga un único marcador `{{1}}`; ese marcador recibirá el resumen completo de la reserva (hasta 1024 caracteres).
- `WA_TEMPLATE_LANGUAGE`: opcional, idioma de la plantilla, por defecto `es_AR`.

Sin token e ID de emisor, la reserva igualmente se finaliza, pero el aviso queda con estado `pendiente_config`; la interfaz lo informa. Si no hay un número de WhatsApp guardado en la configuración del negocio, el aviso queda `sin_destino`. Los errores de proveedor quedan registrados para permitir un reintento.

## Destino y privacidad

Cada aviso usa exclusivamente el número `whatsapp` del negocio dueño de la reserva. Los eventos tienen una clave única por negocio, reserva y finalización para evitar envíos duplicados. No guardar tokens en el repositorio, en la configuración pública del negocio ni en el frontend.

El envío por texto libre puede ser rechazado por Meta si no existe una ventana de atención abierta con el destinatario; para mensajes automáticos proactivos usar una plantilla aprobada y configurar `WA_TEMPLATE_NAME`.
