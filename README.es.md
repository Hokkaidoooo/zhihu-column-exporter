# Exportador de columnas de Zhihu

[简体中文](README.md) · [English](README.en.md) · **Español** · [日本語](README.ja.md)

Guarda las columnas y los artículos de Zhihu que ya puedes leer con tu cuenta. La extensión crea un ZIP con Markdown, HTML sin conexión, un índice de lectura e imágenes para estudio personal o copia de seguridad. La interfaz está en chino.

## Instalar o actualizar

Usa Chrome 120 o posterior, o un navegador Chromium compatible con Manifest V3.

1. Descarga y descomprime el ZIP de [Releases](https://github.com/Hokkaidoooo/zhihu-column-exporter/releases/latest).
2. Abre `chrome://extensions/`, activa el **Modo de desarrollador** y pulsa **Cargar descomprimida**. Selecciona la carpeta `extension` del ZIP extraído. En Windows, `install-extension.cmd` abre la página de extensiones y la carpeta.
3. Fija **知乎付费专栏导出** en la barra. Para actualizar, sustituye la carpeta de la extensión, vuelve a cargarla en el navegador y cierra y vuelve a abrir la página de exportación.

## Exportar y leer sin conexión

1. Inicia sesión y abre el índice de una columna o un artículo al que tengas acceso. Pulsa el icono de la extensión y elige los formatos.
2. Pulsa **开始导出** (Iniciar exportación), deja visible la página de exportación y guarda el ZIP cuando se te solicite.
3. Descomprime el ZIP. Si elegiste HTML, abre `index.html`; el Markdown está en `articles/`. Consulta `export-info.json` para ver el resultado de cada artículo y su enlace original. Si falta contenido, pulsa **重试未完成** (Reintentar lo pendiente) en la página de exportación.

En las columnas estándar, la extensión recorre todas las páginas del catálogo y excluye las recomendaciones. Comprueba la respuesta de la API de artículos con tu sesión iniciada. Si la API no está disponible, devuelve solo una vista previa o presenta discrepancias, la extensión indica el motivo y lee la página normal con hasta cuatro pestañas en segundo plano. El ZIP puede contener resultados parciales: las imágenes que no se hayan podido descargar conservan su URL y requieren conexión. `complete: true` indica que se han guardado todos los artículos del catálogo completo y todas las imágenes seleccionadas para descarga local.

## Permisos y privacidad

La extensión solicita los permisos `downloads`, `scripting` y `tabs`, además de acceso a las páginas de Zhihu y a los dominios de imágenes de `zhimg.com` que utiliza. Las solicitudes usan la sesión habitual del navegador. La extensión no solicita acceso a cookies, no lee ni exporta cookies o tokens de sesión, y no envía artículos a terceros. No elude el inicio de sesión ni los controles de suscripción o pago. Exporta solo aquello que tienes derecho a leer y destínalo a un uso personal lícito.

## Compilación y licencia

Con Node.js 22 y npm, ejecuta desde la raíz del repositorio:

```sh
npm ci
npm run check
npm run package
```

El paquete y las sumas de verificación se guardan en `dist`. Las pruebas usan datos sintéticos, sin artículos de pago ni datos de cuentas. Consulta la [guía de desarrollo](DEVELOPMENT.md) y el [historial de cambios](CHANGELOG.md).

Los colaboradores de zhihu-column-exporter publican el código bajo la [licencia MIT](LICENSE). Los componentes incluidos figuran en los [avisos de terceros](THIRD_PARTY_NOTICES.md). La licencia del código no otorga derechos sobre los artículos de Zhihu.
