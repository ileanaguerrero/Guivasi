// OPTIONAL: Amazon Bedrock planner proxy for Cuidadora+ (not needed for the demo).
//
// The web app runs fully offline. This tiny server lets an LLM on Amazon Bedrock do the
// *planning* step (choose tools + arguments) while tool execution, safety checks and the
// spoken reply stay deterministic in the browser. AWS credentials stay on the server.
//
//   npm install @aws-sdk/client-bedrock-runtime
//   AWS_REGION=us-east-1 BEDROCK_MODEL_ID=<a Bedrock model id that supports tool use> node server/bedrock-proxy.mjs
//   open http://localhost:3000/?llm=http://localhost:8787/plan   (serve the app with `npx serve .`)
//
// Status: reference implementation, written during the hackathon but NOT exercised in the
// demo video (the demo uses the offline router). Treat it as a starting point.
import http from "node:http";

const PORT = process.env.PORT || 8787;
const MODEL = process.env.BEDROCK_MODEL_ID;
const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

const SYSTEM = `You are the planner for Cuidadora+, a voice assistant for Spanish-speaking home health caregivers.
Given the caregiver's utterance and session state, call the tools needed to fulfil it (in order).
Never diagnose. Never invent medications. Use patient ids and med ids from the state only.
Times are 24h "HH:MM". If the caregiver refers to "the 8 o'clock meds" use "08:00".`;

async function plan({ text, state, tools }) {
  const res = await client.send(new ConverseCommand({
    modelId: MODEL,
    system: [{ text: SYSTEM }],
    messages: [{ role: "user", content: [{ text: `STATE: ${JSON.stringify(state)}\nUTTERANCE: ${text}` }] }],
    toolConfig: { tools: tools.map((t) => ({ toolSpec: t })) },
    inferenceConfig: { maxTokens: 512, temperature: 0 }
  }));
  const content = res.output?.message?.content || [];
  const steps = content.filter((c) => c.toolUse).map((c) => ({ tool: c.toolUse.name, args: c.toolUse.input }));
  const map = { get_med_schedule: "meds_due", mark_dose_given: "mark_dose", log_vitals: "vitals", add_visit_note: "note",
    generate_shift_report: "report", draft_family_message: "family", get_patient_profile: "profile", list_patients: "list" };
  const names = steps.map((s) => s.tool);
  let intent = names.includes("generate_shift_report") && names.includes("draft_family_message") ? "close_shift"
    : names.includes("add_visit_note") ? "note" : map[names[names.length - 1]] || "unknown";
  const lang = /\b(what|which|the|meds?|report|please)\b/i.test(text) ? "en" : "es";
  return { lang, intent, patientId: steps[0]?.args?.patientId || state.activePatientId, steps };
}

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.end();
  if (req.method !== "POST" || req.url !== "/plan") { res.statusCode = 404; return res.end(); }
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const out = await plan(JSON.parse(body));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out));
  } catch (e) {
    console.error(e);
    res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(PORT, () => console.log(`Cuidadora+ Bedrock planner proxy on http://localhost:${PORT}/plan (model: ${MODEL})`));
