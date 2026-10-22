# Devpost submission text: Cuidadora+

Copy each section into the matching Devpost field.

---

## Project name
Cuidadora+

## Tagline (elevator pitch)
A simulated Alexa+ that lets Spanish-speaking home health caregivers talk in Spanish and hand off in English: meds, vitals with safe escalation, voice visit notes, and English shift reports.

## Track
Alexa+ (simulated path: a simulated Alexa+ experience in a web app)

## Built with
html5, css3, javascript, web-speech-api, speechsynthesis, localstorage, node.js, amazon-bedrock (optional adapter), playwright and ffmpeg (demo video)

---

## Inspiration
I'm Ileana, a Puerto Rican LPN who works as a home health caregiver in Winter Haven, Florida. Spanish is my first language, and my English is limited. Many of my patients and their families speak Spanish. But the agency, the supervising nurses and the paperwork are all in English. I once had to ask my agency to tell clients that my English is limited.

At the end of a long visit, writing a good shift note in English is slow and hard, so important details get lost: how much the patient ate, whether she complained of pain, whether a dose was really given. When a blood pressure reading looks scary, you don't want to be searching for the right English words before you call the nurse. Thousands of caregivers in the U.S. live this every day. I wanted an assistant that speaks our language and still gives the agency what it needs.

## What it does
Cuidadora+ is a simulated Alexa+ voice assistant for caregivers. You talk to it in Spanish (or English), and it acts across several tools during the shift:

- **Medication schedule:** "Alexa, ¿qué medicinas le tocan a Doña Carmen a las 8?" It reads back the 8 a.m. doses with instructions.
- **Dose tracking:** "Marca la metformina como dada." It remembers which time you meant, records it, tells you what's still pending, and warns you if the dose was already given.
- **Voice visit notes → English report:** You dictate a note naturally in Spanish. It structures the note into English fields (meals, fluids, mood, activity, pain, falls) and keeps your original words next to it.
- **Vitals with safe-range alerts:** "La presión está en 182 sobre 110." It tells you in Spanish to call the supervising nurse now, shows the number in big type, and says when to call 911. It never diagnoses.
- **Family updates:** It drafts a warm message for the family in Spanish and English. It's only a draft and is never sent without your approval.
- **Close the shift:** "Alexa, cierra el turno" chains two tools: the English shift report for the agency and nurse, and the family message.

The screen works like an Alexa+ device: voice chat on one side, visual cards (Patient, Meds, Vitals, Alerts, Note, Report, Family) on the other, and an agent trace showing the plan and each tool call. State is saved for the session in localStorage. It works with a microphone (Web Speech API) or by typing or tapping sample prompts.

## How we built it
- Plain **HTML, CSS and JavaScript** with no framework, no build step and no dependencies. It runs by opening `index.html` or with `npx serve`.
- **Web Speech API:** `SpeechRecognition` in `es-US` (switchable to `en-US`) for input, and `speechSynthesis` with a Spanish voice for replies, with a typed fallback.
- **A simulated Alexa+ agent loop:** understand → plan → call tools → respond. The offline planner is a bilingual rule-based router (language detection, patient, time, medication and vital-sign slot filling). It turns an utterance into an ordered list of tool calls.
- **Eight tools** with JSON-schema descriptions (`get_med_schedule`, `mark_dose_given`, `log_vitals`, `add_visit_note`, `generate_shift_report`, `draft_family_message`…). They export in Amazon Bedrock Converse `toolSpec` format, so an LLM can plan with the same tools. An optional adapter plus a small Node proxy for Bedrock is included as a reference. The demo runs fully offline with no API keys.
- **Safety in code, not in the model:** vital-sign thresholds and the escalation message are deterministic. Family messages are drafts only.
- **A bilingual bridge:** rule-based extraction maps Spanish food words, amounts, mood words, body parts, falls and negations ("no hubo caídas") into English report lines. Anything it can't classify is flagged as untranslated, and the original Spanish is attached.
- A Node smoke test runs the full demo flow without a browser. The demo video was generated from the real app with Playwright screenshots, neural text-to-speech and ffmpeg.

## Challenges we ran into
- **Spanish speech recognition is uneven.** `SpeechRecognition` only works in Chromium browsers, needs `localhost`/https and mic permission, and is missing in Firefox. That's why typed input and sample prompts are first-class features.
- **Translating without an API.** We wanted the demo to work offline, with no keys and no patient data leaving the device. So instead of machine translation we built targeted extraction for the things a shift report needs, and always keep the original Spanish so nothing is silently lost.
- **Being helpful without giving medical advice.** We had to word alerts carefully: say whom to call and when, but never what the condition might be.
- **Time pressure:** we built the whole project inside the submission window.

## Accomplishments that we're proud of
- A caregiver can go from a spoken Spanish note to a clean English shift report in one sentence: "Alexa, cierra el turno."
- The agent is easy to inspect: the trace shows every plan and tool call, so a nurse or agency can trust what happened.
- It runs anywhere with zero setup, including with no internet, no API keys, and no microphone.
- Large, high-contrast, bilingual design made for tired eyes at the end of a shift.

## What we learned
- A good voice assistant for caregivers depends on context (who, what time, already given?) more than on fancy language.
- Keeping safety rules deterministic and letting a model (optionally) handle planning is a good split for health-adjacent tools.
- Bilingual output matters both ways: Spanish for the caregiver and family, English for the agency.

## What's next for Cuidadora+
- Run it as a real Alexa+ experience, exposing the same tools through the Alexa+ / MCP integration path.
- Plug in Amazon Bedrock for open-ended notes and more natural translation, with the deterministic safety layer kept.
- Agency integration: send the approved report to the agency's EVV / documentation system.
- More languages (Haitian Creole, Portuguese) and real medication-reminder notifications.
- Pilot with caregivers at a Florida home health agency, with proper privacy review (HIPAA) before any real patient data.

---

## Product feedback (Amazon developer tools / Alexa+)
**What we used:** We chose the **simulated Alexa+ path**: a web app that simulates the Alexa+ experience (voice in, voice out, visual cards, agentic tool use). We did not deploy to a real Alexa+ device or connect an MCP server for this submission. We read the Alexa+ and MCP integration documentation to shape the tool design (tool names, descriptions, JSON schemas) so it could move to a real integration later. Voice in the browser uses the W3C Web Speech API. The optional planner adapter targets the Amazon Bedrock Converse API with tool use, but we did not run it in the demo.

**What worked well:**
- The simulated path made the challenge open to a non-traditional developer: no hardware, accounts, or certification needed to show the idea.
- Thinking in "tools with clear descriptions and schemas" (the MCP mindset) made the agent cleaner, even offline.
- The Bedrock Converse `toolSpec` format is simple, and our tool schemas map onto it directly.

**What needs work:**
- For a non-developer, it was hard to understand the path from "simulated" to "real Alexa+". The docs assume you already know MCP, servers, auth and hosting. A short "from your web prototype to Alexa+ in 5 steps" guide would help a lot.
- Spanish (es-US) is critical for this audience. Clear docs on Alexa+ language and locale support for agentic or MCP experiences, especially US Spanish, would help builders serve Hispanic users.
- A hosted Alexa+ simulator (text and voice) with a sample MCP server would make it much easier to test a real integration quickly.

**Onboarding:** Getting started on the simulated path was easy because it only needs a browser. Getting started with a real Alexa+ / MCP integration felt like a big jump for a first-time builder: many new concepts at once, and no single end-to-end example for a non-English skill.

**Would we build with it again?** Yes. We'd like to take Cuidadora+ to a real Alexa+ device, because a voice assistant that runs hands-free in the patient's home is exactly what a caregiver needs.

---

## Friction log

**Entry 1: Spanish speech recognition in the browser**
- **Task:** Let the caregiver speak Spanish to the simulated Alexa+.
- **Steps:** Used `webkitSpeechRecognition` with `lang = "es-US"` and interim results; tested opening `index.html` directly and through a local server.
- **Expected:** Spanish recognition working in any modern browser and from a file.
- **Actual:** Recognition exists only in Chromium-based browsers (not Firefox), needs mic permission and a secure context (`localhost`/https), and may send audio to a cloud service. Headless browsers have no mic or voices, so automated demos can't use it.
- **Severity:** Medium (core input for the experience).
- **Workaround:** Typed input and clickable sample prompts as first-class inputs; a language toggle (es-US / en-US); a clear message when the mic isn't supported; the demo video drives the real app with typed prompts plus TTS voices.
- **Suggestion:** In the Alexa+ simulated-path materials, provide a small official browser "voice harness" or simulator with reliable es-US recognition and Alexa-like TTS, so every simulated entry doesn't rebuild it.

**Entry 2: Understanding MCP / Alexa+ integration as a non-developer**
- **Task:** Decide how our tools would connect to a real Alexa+ experience.
- **Steps:** Read the hackathon track rules, then the MCP and Alexa+ integration docs, then tried to map our tools to an MCP server.
- **Expected:** A beginner-friendly, end-to-end example (one tool, one server, one utterance) with hosting and auth explained.
- **Actual:** The docs assume knowledge of servers, transports, auth and deployment. There was no single example for a non-English, voice-first experience. It was unclear which parts are needed for a real Alexa+ submission and which are optional.
- **Severity:** High for non-developers (it pushed us to the simulated path).
- **Workaround:** Built the tools with MCP-style names, descriptions and JSON schemas so they can move to a server later; chose the simulated path.
- **Suggestion:** A "Hello Alexa+ MCP" starter repo with one-click deploy and a Spanish-language example, plus a glossary of terms for first-time builders.

**Entry 3: Translating notes with no API key**
- **Task:** Turn a Spanish visit note into an English shift report, offline.
- **Steps:** Looked for a client-side translation option in the browser; considered calling a hosted model; checked what the rules allow.
- **Expected:** A simple, free, on-device way to translate short text, or a free tier for an LLM in the hackathon.
- **Actual:** No standard browser translation API that works across browsers; hosted models need keys, accounts and billing, and would send health-like data off the device.
- **Severity:** Medium.
- **Workaround:** Domain-specific extraction (meals, fluids, mood, pain, falls, vitals) plus always attaching the original Spanish; an optional Bedrock adapter for later.
- **Suggestion:** Hackathon credits or a sandbox for Amazon Bedrock with a "no-data-retention" demo mode, and a sample showing safe translation for healthcare-adjacent prototypes.

---

## Feature requests
1. **US Spanish (es-US) as a first-class Alexa+ locale for agentic/MCP experiences, with docs**, so voice agents can serve the millions of Spanish-speaking caregivers and families in the U.S.
2. **An official Alexa+ web simulator** (voice and text, with visual cards) that can call a local MCP server, so simulated-path projects can be tested exactly like the real experience and moved to a device with no rewrite.

---

## Mini challenges
- **Open Source:** The repository is public under the MIT license (`LICENSE`, copyright 2026 Ileana Guivas). *(Only claim this if the GitHub repo is public when you submit.)*

## Disclaimer (paste in the description if there's room)
Hackathon prototype, not medical advice. All patients and phone numbers are fictional demo data; no real PHI. Voices in the demo video are synthetic text-to-speech.
