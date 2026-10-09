# Abrir WhatsApp al finalizar una reserva

Al marcar una reserva como finalizada, la aplicación abre WhatsApp con un mensaje preparado para el número guardado en **Configuración → WhatsApp de Reservas / Contacto** del negocio correspondiente.

El mensaje incluye:
- Nombre del negocio.
- Código, estado, espacio, fecha y horario de la reserva.
- Cantidad de personas, importe total, seña/pago, saldo, estado y medio de pago.
- Nombre, teléfono y correo del cliente cuando estén disponibles.
- Observaciones de la reserva.

## Envío manual

La aplicación **no envía mensajes automáticamente** ni requiere WhatsApp Cloud API o variables de entorno. La persona revisa el texto y toca **Enviar** en WhatsApp. Si el navegador bloquea la ventana emergente, la pantalla muestra un enlace alternativo para abrir el mensaje.

## Número por negocio

Cada negocio utiliza exclusivamente el número guardado en su propia configuración. El número debe incluir el código de área; para números argentinos, se normaliza el prefijo internacional al construir el enlace de WhatsApp.
