# RiTech SAS – Frontend

Frontend de RiTech: sistema de apoyo a decisiones de inversión que emite alertas de COMPRAR, VENDER o MANTENER sobre el NASDAQ 100 a partir del RSI (14), y permite simular inversiones con la regla ×2.

Hecho con React, Vite y TypeScript.

## Cómo correrlo

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción en dist/
npm run preview  # sirve la compilación localmente
```

## Configuración

Copia `.env.example` a `.env` y ajusta la URL del backend si hace falta:

```
VITE_API_URL=https://ritechbackend.onrender.com/api
```

Si la variable no está definida se usa `https://ritechbackend.onrender.com/api`. La documentación del backend está en https://ritechbackend.onrender.com/swagger-ui.html.

El backend corre en un servidor gratuito: la primera petición puede tardar hasta un minuto mientras despierta. La aplicación muestra un aviso de carga mientras tanto.

## Pantallas por rol

- **Usuario:** Panel, Alertas, Simulador y Mi historial.
- **Gerente de RiTech:** Panel, Alertas, Históricos y Estadísticas.

Una ruta de otro rol redirige al Panel.

## Estructura

- `src/api.ts`: acceso al backend, sesión y estado de carga global.
- `src/types.ts`: formas de las respuestas según Swagger.
- `src/util.ts`: formato de cifras (es-CO, signo explícito) y fechas en hora de Colombia.
- `src/validaciones.ts`: validación de login y del simulador en el cliente.
- `src/components.tsx`: componentes compartidos (gráficos, chips de señal, medidor de RSI).
- `src/pages/`: una página por pantalla.

Las credenciales no se guardan en el código.
