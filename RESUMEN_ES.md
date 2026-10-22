# Resumen en español: Cuidadora+

**Para Ileana: qué es este proyecto y qué vas a entregar.**

## ¿Qué es?
**Cuidadora+** es un asistente de voz tipo "Alexa+" (simulado en una página web) para cuidadoras de salud en el hogar que hablan español. Tú le hablas en español y el asistente:

1. **Te dice qué medicinas le tocan** a cada paciente y a qué hora.
2. **Marca las dosis como dadas** y te avisa si ya estaba dada (para no repetirla).
3. **Guarda tu nota de visita hablada en español** y la convierte en un **reporte en inglés** para la agencia y la enfermera (comidas, líquidos, ánimo, actividad, dolor, caídas). Tus palabras originales en español también quedan en el reporte.
4. **Revisa los signos vitales.** Si la presión está muy alta (por ejemplo, 182/110), te dice en español que **llames a la enfermera supervisora** y cuándo llamar al 911. **Nunca da diagnósticos.**
5. **Prepara un mensaje para la familia** en español y en inglés. Es solo un borrador: **no se envía sin tu permiso**.
6. Con **"Alexa, cierra el turno"** hace el reporte en inglés y el mensaje para la familia, todo de una vez.

Los pacientes son **inventados** (Doña Carmen, Don Ramón, Doña Gladys). No hay datos reales de nadie.

## ¿Por qué?
La idea viene de tu experiencia: eres LPN puertorriqueña y cuidadora en Winter Haven. Tu primer idioma es el español, pero la agencia, las enfermeras y los papeles están en inglés. Muchas cuidadoras viven lo mismo.

## ¿Qué se entrega en Devpost?
- **Concurso:** Build, Ship, Shape: Amazon Developer Hackathon.
- **Categoría (track):** Alexa+, **camino simulado** (una experiencia de Alexa+ simulada en una página web). Está permitido por las reglas.
- **Fecha límite:** viernes 23 de octubre de 2026, 3:00 PM hora del Este.
- **Lo que se sube:**
  - El **código completo** en un repositorio público (GitHub) con licencia **MIT** a tu nombre (Ileana Guivas, 2026).
  - Un **video de demostración** de unos 2 minutos, en inglés, con la app funcionando. Las voces del video son **voces de computadora** (texto a voz), no tu voz.
  - Los **textos en inglés** para cada parte del formulario de Devpost (están en `DEVPOST.md`), incluyendo:
    - La historia del proyecto (inspiración, qué hace, cómo se hizo, retos, logros, lo aprendido, lo próximo).
    - **Comentarios honestos sobre las herramientas de Amazon.** Decimos claramente que usamos el camino **simulado**, que no conectamos un dispositivo Alexa real, y que la documentación de MCP fue difícil para alguien que no es programadora.
    - **Registro de problemas** ("friction log"): reconocimiento de voz en español en el navegador, documentación de MCP difícil para principiantes y traducción sin conexión.
    - **Peticiones de mejoras:** soporte de español de EE. UU. en Alexa+ y un simulador oficial de Alexa+ en la web.
    - **Mini reto "Open Source":** solo si el repositorio es público con licencia MIT.

## Cosas importantes que debes saber
- **No es consejo médico.** Es un prototipo para el concurso.
- La parte de **Amazon Bedrock** (inteligencia artificial en la nube) está incluida como **opcional** y **no se usó** en el video. La app funciona sin internet y sin claves.
- El texto dice que el proyecto se hizo **durante el período del concurso** (octubre de 2026).
- En la historia del proyecto ("Inspiration") se menciona que tu inglés es limitado y que eres LPN de Puerto Rico. Si prefieres no compartir algo de eso, dímelo y lo cambiamos antes de enviarlo.

## Cómo probarla
Abre el archivo `index.html` en Chrome, o en una terminal escribe `npx serve .` y abre `http://localhost:3000`. Puedes tocar los ejemplos de abajo del cuadro de texto, escribir o usar el micrófono.
