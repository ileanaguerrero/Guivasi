/* Cuidadora+ — OPTIONAL LLM planner adapter (off by default).
 *
 * The app works fully offline with the rule-based router in agent.js. To let an LLM
 * (for example Amazon Bedrock via the Converse API with tool use) do the planning,
 * run the tiny proxy in server/bedrock-proxy.mjs (it keeps AWS credentials on the
 * server, never in the browser) and open the app with:
 *
 *     index.html?llm=http://localhost:8787/plan
 *
 * The proxy receives { text, state, tools } and must return a plan in the same shape
 * the offline router produces:
 *     { lang: "es"|"en", intent: "meds_due"|..., patientId: "carmen", steps: [{ tool, args }] }
 * Tool execution, safety checks and the spoken reply stay local and deterministic.
 * If the endpoint fails or returns nothing, the agent silently falls back to offline.
 */
(function (CP) {
  var url = null;
  try { url = new URLSearchParams(window.location.search).get("llm"); } catch (e) {}
  if (!url) return;

  CP.agent.useLLM(async function (text, state, tools) {
    var slim = { activePatientId: state.activePatientId, lastTime: state.lastTime, clock: CP.clock.hhmm(),
      patients: CP.DEMO_PATIENTS.map(function (p) { return { id: p.id, name: p.name, meds: p.meds.map(function (m) { return { id: m.id, name: m.name, times: m.times }; }) }; }) };
    var res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text, state: slim, tools: tools }) });
    if (!res.ok) throw new Error("LLM proxy HTTP " + res.status);
    var plan = await res.json();
    if (!plan || !Array.isArray(plan.steps)) return null;
    var known = CP.tools.TOOLS;
    plan.steps = plan.steps.filter(function (s) { return known[s.tool]; }); // only allow-listed tools
    plan.text = text;
    return plan;
  });
  console.info("Cuidadora+: LLM planner enabled at", url);
})(window.CP = window.CP || {});
