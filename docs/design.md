# Diseño y Arquitectura - Vellum Canvas

## Estructura del Sistema
La aplicación sigue un modelo de arquitectura por capas para separar la lógica de negocio de la interfaz de usuario.

### Frontend (Client-side)
- **`src/components/`**: Componentes atómicos y modulares (Botones, Inputs, Cards).
- **`src/engine/`**: Lógica de renderizado de escenas y mapas.
- **`src/context/`**: Estado global para los datos del jugador (oro, nivel, inventario).
- **`src/types/`**: Definición estricta de interfaces para asegurar la integridad de los datos.

### Backend (Server-side)
- **API REST**: Endpoints estructurados para la persistencia de datos.
- **Controllers**: Lógica de validación (ej. verificar si un jugador tiene oro suficiente para una compra).
- **Services**: Interacción con la base de datos o sistema de persistencia.

## Flujo de Datos
1. El DM realiza un cambio (ej. mueve un personaje en el mapa).
2. El Frontend envía una petición al Backend.
3. El Backend valida y guarda el nuevo estado.
4. El sistema actualiza la vista de todos los usuarios conectados.