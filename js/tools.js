/* Cuidadora+ — the agent's tools. Each tool is a pure-ish function over session state
 * with a JSON-schema description, so the same tools can be exposed to an LLM planner
 * (e.g. Amazon Bedrock tool use) or to an MCP server later.
 */
(function (CP) {
  function patient(id) { return CP.DEMO_PATIENTS.filter(function (p) { return p.id === id; })[0] || null; }
  function list(obj, key) { if (!obj[key]) obj[key] = []; return obj[key]; }
  function nowISO() { return CP.clock.now().toISOString(); }
  function toMin(t) { var a = t.split(":"); return +a[0] * 60 + +a[1]; }

  /* Safe-range checks. These are generic caregiver escalation thresholds for a demo,
   * NOT clinical guidance. The assistant never diagnoses; it tells the caregiver whom to call. */
  function checkVitals(v) {
    var f = [];
    function add(level, label, es, en) { f.push({ level: level, label: label, es: es, en: en }); }
    if (v.bp) {
      var s = v.bp.sys, d = v.bp.dia;
      if (s >= 180 || d >= 110) add("urgent", "BP very high", "La presión " + s + "/" + d + " está muy alta.", "BP " + s + "/" + d + " is very high.");
      else if (s >= 140 || d >= 90) add("watch", "BP above usual range", "La presión " + s + "/" + d + " está más alta de lo normal.", "BP " + s + "/" + d + " is above the usual range.");
      else if (s < 90 || d < 60) add("urgent", "BP low", "La presión " + s + "/" + d + " está baja.", "BP " + s + "/" + d + " is low.");
    }
    if (v.glucose != null) {
      if (v.glucose < 70) add("urgent", "Glucose low", "El azúcar " + v.glucose + " está bajo.", "Blood glucose " + v.glucose + " is low.");
      else if (v.glucose > 300) add("urgent", "Glucose very high", "El azúcar " + v.glucose + " está muy alto.", "Blood glucose " + v.glucose + " is very high.");
      else if (v.glucose > 180) add("watch", "Glucose high", "El azúcar " + v.glucose + " está alto.", "Blood glucose " + v.glucose + " is high.");
    }
    if (v.hr != null && (v.hr < 50 || v.hr > 120)) add("urgent", "Pulse out of range", "El pulso " + v.hr + " está fuera de lo normal.", "Pulse " + v.hr + " is out of range.");
    if (v.temp != null && v.temp >= 100.4) add("watch", "Fever", "La temperatura " + v.temp + " indica fiebre.", "Temperature " + v.temp + " °F suggests fever.");
    if (v.spo2 != null && v.spo2 < 92) add("urgent", "Oxygen low", "El oxígeno " + v.spo2 + "% está bajo.", "SpO2 " + v.spo2 + "% is low.");
    return f;
  }

  var TOOLS = {
    list_patients: {
      description: "List the caregiver's patients for today.",
      params: {},
      run: function (state) { return { patients: CP.DEMO_PATIENTS.map(function (p) { return { id: p.id, name: p.name, age: p.age }; }) }; }
    },
    get_patient_profile: {
      description: "Get a patient's profile (conditions, allergies, care notes, family contact) and make them the active patient.",
      params: { patientId: "string" },
      run: function (state, a) { var p = patient(a.patientId); state.activePatientId = p.id; return { patient: p }; }
    },
    get_med_schedule: {
      description: "Get medications due for a patient at a given time (HH:MM, 24h) or the next due doses, including whether each dose was already given today.",
      params: { patientId: "string", time: "string|null" },
      run: function (state, a) {
        var p = patient(a.patientId), doses = state.doses[p.id] || {};
        var t = a.time;
        var all = [];
        p.meds.forEach(function (m) { m.times.forEach(function (tt) { all.push({ med: m, time: tt, given: doses[m.id + "@" + tt] || null }); }); });
        var due;
        if (t) {
          due = all.filter(function (d) { return d.time === t; });
          if (!due.length) { // nearest scheduled slot within 90 min
            var best = null;
            all.forEach(function (d) { var diff = Math.abs(toMin(d.time) - toMin(t)); if (diff <= 90 && (!best || diff < best)) best = diff; });
            if (best != null) due = all.filter(function (d) { return Math.abs(toMin(d.time) - toMin(t)) === best; });
          }
        } else {
          var now = CP.clock.hhmm();
          var pending = all.filter(function (d) { return !d.given; }).sort(function (x, y) { return toMin(x.time) - toMin(y.time); });
          var overdue = pending.filter(function (d) { return d.time <= now; });
          var next = pending.filter(function (d) { return d.time > now; });
          due = overdue.length ? overdue : (next.length ? next.filter(function (d) { return d.time === next[0].time; }) : []);
        }
        if (due.length) state.lastTime = due[0].time;
        return { patient: p, time: due.length ? due[0].time : t, due: due };
      }
    },
    mark_dose_given: {
      description: "Record that the caregiver assisted the patient with a scheduled medication dose.",
      params: { patientId: "string", medId: "string", time: "string|null" },
      run: function (state, a) {
        var p = patient(a.patientId), m = p.meds.filter(function (x) { return x.id === a.medId; })[0];
        var doses = state.doses[p.id] = state.doses[p.id] || {};
        var slot = a.time && m.times.indexOf(a.time) !== -1 ? a.time : null;
        if (!slot) { // nearest pending slot to now
          var now = toMin(CP.clock.hhmm());
          var cands = m.times.filter(function (t) { return !doses[m.id + "@" + t]; });
          cands.sort(function (x, y) { return Math.abs(toMin(x) - now) - Math.abs(toMin(y) - now); });
          slot = cands[0] || m.times[0];
        }
        var already = doses[m.id + "@" + slot] || null;
        if (!already) doses[m.id + "@" + slot] = nowISO();
        var remaining = [];
        p.meds.forEach(function (mm) { mm.times.forEach(function (t) { if (t === slot && !doses[mm.id + "@" + t]) remaining.push(mm); }); });
        return { patient: p, med: m, time: slot, alreadyGiven: !!already, remainingSameTime: remaining };
      }
    },
    log_vitals: {
      description: "Log vital signs (bp {sys,dia}, hr, glucose, temp °F, spo2) and check them against safe ranges. Returns escalation flags; never a diagnosis.",
      params: { patientId: "string", vitals: "object" },
      run: function (state, a) {
        var p = patient(a.patientId), flags = checkVitals(a.vitals);
        var rec = Object.assign({ ts: nowISO(), flags: flags }, a.vitals);
        list(state.vitals, p.id).push(rec);
        flags.forEach(function (f) {
          list(state.alerts, p.id).push({ ts: rec.ts, level: f.level, es: f.es, en: f.en + (f.level === "urgent" ? " Caregiver told to call the supervising nurse." : " Recheck advised.") });
        });
        return { patient: p, record: rec, flags: flags, supervisor: CP.SUPERVISOR };
      }
    },
    add_visit_note: {
      description: "Save a free-form visit note (Spanish or English) and auto-structure it into English shift-report fields.",
      params: { patientId: "string", text: "string" },
      run: function (state, a) {
        var p = patient(a.patientId), st = CP.notes.structure(a.text);
        list(state.notes, p.id).push({ ts: nowISO(), text: a.text, structured: st });
        return { patient: p, structured: st };
      }
    },
    generate_shift_report: {
      description: "Generate the English end-of-shift report for the agency / supervising nurse from today's notes, vitals and doses.",
      params: { patientId: "string" },
      run: function (state, a) {
        var p = patient(a.patientId), text = CP.notes.shiftReport(state, p);
        state.reports[p.id] = { ts: nowISO(), text: text };
        return { patient: p, report: text };
      }
    },
    draft_family_message: {
      description: "Draft (not send) a short update for the patient's family in Spanish and English.",
      params: { patientId: "string" },
      run: function (state, a) {
        var p = patient(a.patientId), msg = CP.notes.familyMessage(state, p);
        state.familyMsgs[p.id] = { ts: nowISO(), es: msg.es, en: msg.en };
        return { patient: p, message: msg };
      }
    }
  };

  CP.tools = {
    TOOLS: TOOLS,
    checkVitals: checkVitals,
    patient: patient,
    call: function (state, name, args) {
      if (!TOOLS[name]) throw new Error("Unknown tool " + name);
      return TOOLS[name].run(state, args || {});
    },
    /* JSON-schema style tool specs, e.g. for Bedrock Converse `toolConfig`. */
    schemas: function () {
      return Object.keys(TOOLS).map(function (k) {
        var props = {};
        Object.keys(TOOLS[k].params).forEach(function (p) { props[p] = { type: TOOLS[k].params[p].split("|")[0] }; });
        return { name: k, description: TOOLS[k].description, inputSchema: { json: { type: "object", properties: props } } };
      });
    }
  };
})(window.CP = window.CP || {});
