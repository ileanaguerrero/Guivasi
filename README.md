# Cuidadora+ 🩵

**A simulated Alexa+ voice assistant for Spanish-speaking home health caregivers and bilingual families.**

Caregivers speak Spanish (or English). Cuidadora+ answers by voice in Spanish, keeps track of the shift, and acts across several tools: medication schedules, dose tracking, vitals with safe-range escalation, visit notes, an **English shift report for the agency/nurse**, and a **bilingual family update**.

> Built for the **Build, Ship, Shape: Amazon Developer Hackathon** · **Alexa+ track, simulated path** ("build a simulated Alexa+ experience in a web app using your preferred agentic tool").

![Cuidadora+ screenshot](docs/screenshot.png)

---

## The problem

Ileana Guivas, who entered this project, is a Spanish-speaking home health caregiver in Florida. Her patients' families often speak Spanish too, but the **home health agency, the supervising nurses, and the shift paperwork are all in English**.

That gap is common across U.S. home care and it causes real problems:

- Shift notes are short or missing details because writing them in English is hard and slow.
- Medication times and "did she already take it?" questions get confusing across visits.
- When a vital sign is out of range, a caregiver who isn't sure how to say it in English may escalate late.
- Families want updates in Spanish; agencies need documentation in English.

**Cuidadora+ lets the caregiver just talk in Spanish, and turns that into safe actions and English documentation.**

## What it does

| Ask (Spanish or English) | What the agent does |
|---|---|
| "Alexa, ¿qué medicinas le tocan a Doña Carmen a las 8?" | Looks up the 8:00 doses, reads them back with instructions, highlights them on the Meds card |
| "Alexa, marca la metformina como dada" | Remembers you were talking about 8:00, records the dose, says what is still pending, **blocks duplicates** if you mark it twice |
| "Alexa, nota de visita: desayunó la mitad, tomó dos vasos de agua, estaba contenta…" | Saves the note and **structures it into English fields** (meals, fluids, mood, activity, pain, falls), keeping the original Spanish beside it |
| "Alexa, la presión está en 182 sobre 110" | Logs vitals, checks simple safe ranges, and if urgent tells the caregiver **in Spanish to call the supervising nurse now** (and when to call 911). **Never diagnoses.** |
| "Alexa, prepara un mensaje para la familia" | Drafts a warm update for the family in **Spanish and English**. Draft only, never sent without approval |
| "Alexa, cierra el turno" | Chains two tools: **English shift report** for the agency + family message |
| "Alexa, what meds is Don Ramón due for at noon?" | Works in English too (replies in English with a Spanish subtitle) |

Plus: 3 demo patients (Doña Carmen, 82, diabetes and hypertension; Don Ramón, 77, Parkinson's; Doña Gladys, 88, heart failure), Alexa+-style visual cards (Patient, Meds, Vitals, Alerts, Note, Report, Family), an **agent trace** that shows the plan and every tool call, large high-contrast text, and session state saved in `localStorage`.

## How it works (architecture)

```
 mic (Web Speech API, es-US / en-US)  ─┐
 typed input / sample prompts          ─┼─►  Agent (js/agent.js)
                                         │     1. Understand  (js/nlu.js: language, patient, time, med, vitals)
                                         │     2. Plan        ordered tool calls  ◄── optional LLM planner (js/llm-adapter.js → Amazon Bedrock proxy)
                                         │     3. Act         tools (js/tools.js) over session state (js/store.js → localStorage)
                                         │     4. Respond     Spanish/English reply + focus card + trace
                                         ▼
 speechSynthesis (es-US voice)  ◄── reply      Visual cards + agent trace (js/ui.js)
```

- **Simulated Alexa+ agent.** A plan → tools → respond loop. The offline planner is a rule-based bilingual router (regex + slot filling) so the demo is predictable and needs **no API keys and no network**.
- **Tools** (`js/tools.js`): `list_patients`, `get_patient_profile`, `get_med_schedule`, `mark_dose_given`, `log_vitals`, `add_visit_note`, `generate_shift_report`, `draft_family_message`. Each has a description and a JSON-schema, exported by `CP.tools.schemas()` in Bedrock Converse `toolSpec` format, so an LLM (or an MCP server later) can call the same tools.
- **Safety layer.** Vital-sign thresholds live in code (`checkVitals`), not in a model. Urgent readings always produce the same escalation message. Messages to families are drafts only.
- **Bilingual bridge** (`js/notes.js`). Rule-based extraction turns Spanish notes into English report fields (food words, amounts, mood words, body parts, falls, with negation such as "no hubo caídas"). Anything it can't classify goes in an "Other (untranslated)" line, and the original Spanish is always attached to the report.
- **Optional LLM planner.** `js/llm-adapter.js` + `server/bedrock-proxy.mjs` let Amazon Bedrock (Converse API with tool use) choose the tools. Tool execution and safety checks stay local. **This adapter was written as a reference and was not exercised in the demo.**
- **State.** `localStorage` holds doses, vitals, notes, alerts, reports and drafts for the current day (and resets on a new day).

## Run it

No build step and no dependencies.

**Option A, just open it:** double-click `index.html` (Chrome or Edge recommended for voice).

**Option B, local server (recommended for the microphone):**

```bash
git clone <this repo>
cd cuidadora-plus
npx serve .            # or: python3 -m http.server 3000
# open http://localhost:3000   (add ?time=08:05 to pin the demo clock)
```

**Test the agent without a browser:**

```bash
node tests/smoke.test.mjs     # or: npm test
```

**Voice notes.** Speech recognition uses the browser's Web Speech API (`es-US` by default; toggle 🎙️ to English). It works in Chrome and Edge and needs a mic permission, plus `localhost` or https. Firefox has no `SpeechRecognition`; the app falls back to typing and sample prompts. Spoken replies use `speechSynthesis` with a Spanish voice when the OS has one. Press **Ctrl+Space** to talk.

**Optional Bedrock planner:**

```bash
npm install @aws-sdk/client-bedrock-runtime
AWS_REGION=us-east-1 BEDROCK_MODEL_ID=<model-id-with-tool-use> node server/bedrock-proxy.mjs
# then open http://localhost:3000/?llm=http://localhost:8787/plan
```

## Demo script (about 2 minutes)

1. Open `http://localhost:3000/?time=08:05` and click **↺ Reset**.
2. "Alexa, ¿qué medicinas le tocan a Doña Carmen a las 8?" → Meds card highlights 8 a.m.
3. "Alexa, marca la metformina como dada" → ✓ Given. Say it again to see the duplicate warning.
4. "Alexa, nota de visita: Doña Carmen desayunó la mitad, avena y café con leche. Tomó dos vasos de agua. Estaba contenta pero un poco cansada. Caminamos diez minutos por la sala. Se quejó de dolor en la rodilla derecha. No hubo caídas." → Note card: Spanish original next to English fields.
5. "Alexa, la presión de Doña Carmen está en 182 sobre 110" → red call-the-nurse card.
6. "Alexa, prepara un mensaje para la familia" → ES + EN draft.
7. "Alexa, cierra el turno" → English shift report + family message (two chained tools in the trace).
8. Bonus: "Alexa, what meds is Don Ramón due for at noon?"

Every step also has a clickable sample chip under the input, so the demo works without a microphone. The demo video is in `demo/demo.mp4` and was generated from the real app by `demo/make_demo.py` (Playwright + edge-tts + ffmpeg; voices in the video are synthetic).

## Project structure

```
index.html            app shell
css/styles.css        warm, high-contrast, large-type UI
js/data.js            fictional demo patients
js/store.js           localStorage state + demo clock (?time=HH:MM)
js/nlu.js             Spanish/English understanding (language, patient, time, med, vitals)
js/tools.js           agent tools + safe-range checks + JSON schemas
js/notes.js           Spanish note → English report fields, shift report, family message
js/agent.js           plan → tools → respond loop
js/voice.js           Web Speech API (recognition + synthesis)
js/llm-adapter.js     optional LLM planner hook
js/ui.js              chat, cards, agent trace
server/bedrock-proxy.mjs  optional Amazon Bedrock planner proxy (reference)
tests/smoke.test.mjs  node test of the full demo flow
demo/                 demo video + generator script
```

## Hackathon

- **Event:** Build, Ship, Shape: Amazon Developer Hackathon (Devpost)
- **Track:** Alexa+, **simulated path**: a simulated Alexa+ experience in a web app.
- **Built during the submission window** (October 2026). All code in this repository was written for this hackathon.
- **License:** MIT (see `LICENSE`).

## Disclaimer

Cuidadora+ is a **hackathon prototype**. It is **not medical advice** and not a medical device. Vital-sign thresholds are generic demo escalation points, not clinical guidance. Always follow your agency's care plan and your supervising nurse. **All patients, people and phone numbers are fictional demo data; no real PHI is used or stored.** Data stays in your browser's `localStorage`. This project is not affiliated with or endorsed by Amazon; "Alexa" is used only to describe the simulated Alexa+ experience required by the hackathon track.

---

*Hecho con cariño para las cuidadoras y los cuidadores que hablan español.*
