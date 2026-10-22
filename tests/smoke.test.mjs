// Offline smoke test for the agent (no browser needed): `node tests/smoke.test.mjs`
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const ctx = { console, URLSearchParams, Date, Math, JSON, Object, String, Number, Array, RegExp, Error, Promise };
ctx.window = ctx;
ctx.window.location = { search: "?time=08:05" };
ctx.window.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
vm.createContext(ctx);
for (const f of ["data", "store", "nlu", "notes", "tools", "agent"]) {
  vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), "utf8"), ctx, { filename: f + ".js" });
}
const CP = ctx.CP;
const state = CP.store.reset();
const say = async (t) => { const r = await CP.agent.handle(t, state); console.log(`\n> ${t}\n  [${r.intent}] ${r.steps.map(s => s.tool).join(" -> ")}\n  ES: ${r.reply.es}\n  EN: ${r.reply.en}`); return r; };

let r = await say("Alexa, ¿qué medicinas le tocan a Doña Carmen a las 8?");
assert.equal(r.intent, "meds_due"); assert.equal(r.results[0].out.due.length, 2);
r = await say("Alexa, marca la metformina como dada");
assert.equal(r.intent, "mark_dose"); assert.ok(state.doses.carmen["metformin@08:00"]);
r = await say("Alexa, ya le di el lisinopril");
assert.equal(r.intent, "mark_dose");
r = await say("Alexa, marca la metformina como dada");
assert.ok(r.results[0].out.alreadyGiven);
r = await say("Alexa, nota de visita: Doña Carmen desayunó la mitad, avena y café con leche. Tomó dos vasos de agua. Estaba contenta pero un poco cansada. Caminamos diez minutos por la sala. Se quejó de dolor en la rodilla derecha. No hubo caídas.");
assert.equal(r.intent, "note");
r = await say("Alexa, la presión de Doña Carmen está en 182 sobre 110");
assert.equal(r.intent, "vitals"); assert.equal(r.results[0].out.flags[0].level, "urgent");
r = await say("Alexa, escribe un mensaje para la familia");
assert.equal(r.intent, "family");
r = await say("Alexa, cierra el turno");
assert.equal(r.intent, "close_shift");
console.log("\n" + state.reports.carmen.text);
r = await say("Alexa, what meds is Don Ramón due for at noon?");
assert.equal(r.reply.speakLang, "en"); assert.equal(r.results.at(-1).out.due.length, 2);
r = await say("Alexa, glucosa 65");
assert.equal(r.results[0].out.flags[0].level, "urgent");
r = await say("Alexa, ayuda");
assert.equal(r.intent, "help");
console.log("\nAll smoke tests passed.");
