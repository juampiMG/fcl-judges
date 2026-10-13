# FCL Judge Desk · GitHub Pages

Web estática de jueces con 228 Teams y 231 parejas. El contador y resultados se guardan en IndexedDB, y la pantalla actual en sessionStorage.

## Publicar

En GitHub: Settings → Pages → Build and deployment → Source → GitHub Actions.
El workflow `.github/workflows/pages.yml` ejecuta las pruebas, compila y publica con cada push a `main`. También admite ejecución manual desde Actions.
URL prevista: https://juampiMG.github.io/fcl-judges/

## Desarrollo

Node.js 22 o posterior. Sin dependencias de instalación.

```sh
npm test
npm run build
npm start
```

Abre http://127.0.0.1:4173. Los archivos fuente están en `web/`; `dist/` es generado.

## Acceso

La contraseña acordada se comprueba en el navegador; su huella está en `web/access.js`. La cookie recuerda el acceso 30 días. Es una barrera de cortesía, no autenticación segura: los archivos son públicos y se puede eludir. No se deben publicar secretos en este repositorio. La implementación anterior de servidor queda como referencia en `worker/`, pero no se publica ni se ejecuta en Pages.

Las rutas relativas admiten `/fcl-judges/`. No hay integración con Drive. Abrir o recargar requiere conexión. Cambiar de dominio no transfiere los resultados guardados: permanecen en el navegador y dominio donde se registraron.
