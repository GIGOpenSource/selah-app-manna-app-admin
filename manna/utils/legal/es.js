export default {
	meta: 'Manna · {entity}\nVigente tras el lanzamiento en tienda (borrador)\nContacto: {support}',
	privacy: {
		titleKey: 'legal_privacy',
		fallbackTitle: 'Política de privacidad',
		sections: [
			{
				heading: 'Introducción',
				paragraphs: [
					'Manna (“nosotros”) ofrece una aplicación móvil de afirmaciones diarias, devoción, check-ins, fondos de pantalla y funciones opcionales de reflexión con IA. Esta Política de privacidad explica qué información recopilamos, cómo la usamos y tus opciones.',
					'Si no estás de acuerdo con esta Política, no uses la App.',
				],
			},
			{
				heading: 'Información que recopilamos',
				paragraphs: [
					'Cuenta e identificadores: un identificador de dispositivo generado localmente (device_id), identificadores opcionales de Google o Apple, y tu ID de usuario emitido por el servidor.',
					'Perfil y preferencias: nombre opcional, idioma, respuestas de onboarding que elijas dar, consentimiento de marketing, sonido/silencio y recordatorios de check-in.',
					'Uso y analítica: eventos de producto (vistas, likes, compartidos, check-ins, embudo VIP) y metadatos básicos del dispositivo/app para diagnóstico.',
					'Contenido del usuario: likes, colecciones, historial, afirmaciones propias, reportes y mensajes de chat con IA que envíes.',
					'Compras: estado de suscripción e identificadores de transacción de la tienda para validar compras de App Store / Google Play. Los números completos de tarjeta los procesan Apple o Google; Manna no los almacena.',
					'Fotos: si guardas una tarjeta para compartir, la imagen se escribe en tu biblioteca con permiso. No subimos tu carrete.',
					'En la versión 1.0 no exigimos ubicación precisa, contactos, micrófono ni cámara para las funciones principales.',
				],
			},
			{
				heading: 'Cómo usamos la información',
				paragraphs: [
					'Usamos la información para prestar y sincronizar funciones, personalizar el contenido, aplicar cuotas de IA y beneficios VIP, programar recordatorios locales que actives, mejorar el producto, cumplir la ley, prevenir abusos y enviar marketing solo si lo aceptas.',
				],
			},
			{
				heading: 'Procesamiento de IA',
				paragraphs: [
					'Las respuestas de IA se generan mediante un proveedor de modelos de terceros configurable. El contenido que envías se procesa para devolver una respuesta y aplicar filtros de seguridad. La salida de IA es solo informativa y no constituye consejo pastoral, médico, legal ni de salud mental.',
				],
			},
			{
				heading: 'Compartir datos',
				paragraphs: [
					'Compartimos datos con proveedores de infraestructura, proveedores de IA, Apple/Google para autenticación y validación de compras, y autoridades cuando la ley lo exija. No vendemos tu información personal.',
				],
			},
			{
				heading: 'Traducción de Escritura (API de Google Translate)',
				paragraphs: [
					'Cuando usas la traducción bíblica en la app, enviamos el versículo solicitado a la API de Google Translate y mostramos el resultado en pantalla. La traducción se genera en tiempo real al pulsar Traducir.',
					'No guardamos, catalogamos ni publicamos el texto traducido por máquina como una edición bíblica almacenada. La fuente licenciada o de dominio público (por ejemplo WEB o KJV) sigue siendo la copia canónica. Google y Google Translate son marcas de Google LLC.',
				],
			},
			{
				heading: 'Conservación, seguridad y menores',
				paragraphs: [
					'Conservamos datos de cuenta y contenido mientras tu cuenta esté activa y según se necesite para suscripciones, seguridad y obligaciones legales. Solicita la eliminación en {support}.',
					'Usamos HTTPS en producción y controles de acceso habituales. Ningún método de transmisión es 100 % seguro.',
					'Manna no está dirigida a menores de 13 años (o la edad mínima de tu país). Contáctanos si crees que un menor nos ha proporcionado datos.',
				],
			},
			{
				heading: 'Tus opciones y contacto',
				paragraphs: [
					'Puedes vincular o omitir Google/Apple; activar o desactivar marketing, sonidos y recordatorios; limitar el acceso a fotos en ajustes del sistema; y solicitar acceso o eliminación en {support}.',
					'Responsable / operador: {entity}.',
				],
			},
		],
	},
	terms: {
		titleKey: 'legal_terms',
		fallbackTitle: 'Términos de uso',
		sections: [
			{
				heading: 'Acuerdo',
				paragraphs: [
					'Al descargar o usar Manna, aceptas estos Términos y nuestra Política de privacidad. Si no estás de acuerdo, no uses la App.',
				],
			},
			{
				heading: 'El servicio y las cuentas',
				paragraphs: [
					'Manna ofrece afirmaciones, temas, fondos, check-ins, herramientas para compartir y chat de IA opcional. Las funciones pueden variar según plataforma, región y estado de suscripción.',
					'El acceso predeterminado usa una cuenta basada en el dispositivo. Vincular Google o Apple ayuda a conservar las colecciones tras reinstalar. Eres responsable de la actividad de tu cuenta. Podemos suspender cuentas que abusen del servicio o incumplan estos Términos.',
				],
			},
			{
				heading: 'Uso aceptable',
				paragraphs: [
					'Aceptas no extraer ni interrumpir el servicio de forma ilícita; no subir contenido ilegal o infractor; no eludir cuotas de IA, bloqueos VIP ni sistemas de pago; no presentar Manna como asesoramiento profesional; ni usar la App para dañarte a ti u a otros. Si estás en crisis, contacta servicios de emergencia locales o las líneas de ayuda listadas.',
				],
			},
			{
				heading: 'Contenido, IA y suscripciones',
				paragraphs: [
					'El software, la marca y los catálogos curados pertenecen a Manna o a licenciantes. Conservas los derechos del texto que creas y nos concedes una licencia para alojarlo y operar el producto.',
					'Las respuestas de IA pueden ser inexactas. No sustituyen a clérigos, terapeutas, médicos ni abogados.',
					'Las funciones de pago son suscripciones de renovación automática facturadas por Apple o Google. Consulta los Términos de suscripción en la App y la ficha de la tienda. Los precios los fijan las tiendas.',
				],
			},
			{
				heading: 'Escritura y traducción automática',
				paragraphs: [
					'El texto bíblico en Manna se muestra desde ediciones licenciadas o de dominio público. La traducción opcional en pantalla se obtiene exclusivamente llamando a la API de Google Translate en tiempo real cuando lo pides. No es una traducción bíblica almacenada, oficial ni autorizada por un editor.',
					'La salida automática puede ser inexacta. No puedes extraer, redistribuir ni explotar comercialmente el renderizado como una nueva versión bíblica. Usa “Mostrar original” para volver al texto fuente.',
				],
			},
			{
				heading: 'Descargos',
				paragraphs: [
					'LA APP SE PROPORCIONA “TAL CUAL”, SIN GARANTÍAS DE NINGÚN TIPO, EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY.',
					'EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, MANNA Y {entity} NO SERÁN RESPONSABLES DE DAÑOS INDIRECTOS O CONSECUENTES DERIVADOS DEL USO DE LA APP.',
					'Contacto: {support}.',
				],
			},
		],
	},
	subscription: {
		titleKey: 'legal_subscription',
		fallbackTitle: 'Términos de suscripción',
		sections: [
			{
				heading: 'Productos y prueba',
				paragraphs: [
					'Manna VIP puede ofrecerse como suscripciones mensuales y/o anuales de renovación automática. Los IDs de producto y precios exactos los muestran Apple o Google al comprar y pueden variar por región.',
					'Cuando se ofrezca, una prueba gratuita de 3 días es una oferta introductoria oficial de la tienda. Si no se cancela a tiempo según las reglas de la tienda, la suscripción pasa a un plan de pago y se cobra tu método de pago.',
				],
			},
			{
				heading: 'Renovación, cancelación y restauración',
				paragraphs: [
					'Las suscripciones se renuevan automáticamente hasta que las canceles en los ajustes de Apple ID o en las suscripciones de Google Play. Borrar la App no cancela la suscripción.',
					'Usa Restaurar compras tras reinstalar o cambiar de dispositivo. Los derechos se validan con recibos de la tienda. Se recomienda vincular Google/Apple para que el VIP siga tu cuenta.',
					'Los reembolsos los gestionan Apple o Google según sus políticas.',
				],
			},
		],
	},
	help: {
		titleKey: 'legal_help',
		fallbackTitle: 'Ayuda y preguntas frecuentes',
		sections: [
			{
				heading: 'Primeros pasos',
				paragraphs: [
					'P: ¿Necesito una cuenta?\nR: Manna crea una cuenta ligera a partir de tu ID de dispositivo. Vincula Google o Apple para conservar favoritos tras reinstalar.',
					'P: ¿Qué incluye la versión gratuita?\nR: Afirmaciones diarias, cuota limitada de IA, fondos gratuitos y funciones básicas para compartir.',
					'P: ¿Qué desbloquea VIP?\nR: Límites de IA más altos, temas/fondos VIP donde estén configurados, control de marca de agua y los beneficios listados en la página VIP.',
				],
			},
			{
				heading: 'Check-in y soporte',
				paragraphs: [
					'P: ¿Cómo funcionan los check-ins?\nR: Haz check-in cada día para acumular racha. Los corazones pueden congelar ausencias cortas; faltar más días de los configurados puede reiniciar la racha. Los usuarios gratuitos pueden ganar cuota de IA con un check-in correcto.',
					'P: ¿Cómo contacto con soporte?\nR: Escribe a {support} e incluye tu ID de usuario desde Ajustes.',
					'Si estás en crisis, contacta servicios de emergencia locales. La App puede mostrar recursos regionales de ayuda.',
				],
			},
			{
				heading: 'Traducción bíblica',
				paragraphs: [
					'P: ¿Cómo funciona la traducción de versículos?\nR: Manna llama a la API de Google Translate cuando pulsas Traducir. El resultado se genera en tiempo real solo en esta página y no se guarda como Biblia traducida.',
					'P: ¿Por qué no es una traducción oficial?\nR: Las ediciones bíblicas con copyright no pueden sustituirse por una traducción automática almacenada. El texto fuente sigue siendo la copia licenciada; la salida de la API de Google Translate es una capa de conveniencia en vivo.',
				],
			},
		],
	},
}
