/* Cuidadora+ — the simulated Alexa+ agent.
 * Loop: understand → plan (list of tool calls) → execute tools → compose a spoken
 * reply (Spanish or English) + visual cards + a visible trace of what it did.
 * An optional LLM planner (see llm-adapter.js) can replace `plan()`; the tools,
 * safety checks and responses stay the same.
 */
(function (CP) {
  var nlu = CP.nlu;

  function fmt12(t, lang) {
    if (!t) return "";
    var a = t.split(":"), h = +a[0], m = a[1];
    var suf = lang === "en" ? (h < 12 ? " a.m." : " p.m.") : (h < 12 ? " de la mañana" : h === 12 ? " del mediodía" : h < 19 ? " de la tarde" : " de la noche");
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + (m !== "00" ? ":" + m : "") + suf;
  }
  function joinList(arr, lang) {
    if (arr.length <= 1) return arr.join("");
    return arr.slice(0, -1).join(", ") + (lang === "en" ? " and " : " y ") + arr[arr.length - 1];
  }

  /* ---------- 1. Plan: intent + slots -> ordered tool calls ---------- */
  function plan(text, state) {
    var raw = nlu.stripWake(text), n = nlu.norm(raw), lang = nlu.detectLang(raw);
    var mentioned = nlu.findPatient(n, CP.DEMO_PATIENTS);
    var p = mentioned || CP.tools.patient(state.activePatientId);
    var steps = [], intent = "unknown";
    if (mentioned && mentioned.id !== state.activePatientId) steps.push({ tool: "get_patient_profile", args: { patientId: p.id }, silent: true });

    var vitals = nlu.parseVitals(n);
    var time = nlu.parseTime(n);
    if (time === "now") time = null;
    var med = nlu.findMed(n, p);

    if (/^(nota|anota|apunta|nota de visita|visit note|note)\b/.test(n) || /\b(nota de (la )?visita|anota que|add a note)\b/.test(n)) {
      intent = "note";
      var body = raw.replace(/^\s*(nota de (la )?visita|nota|anota( que)?|apunta( que)?|visit note|add a note|note)\s*[:,.-]?\s*/i, "");
      steps.push({ tool: "add_visit_note", args: { patientId: p.id, text: body } });
      if (vitals) steps.push({ tool: "log_vitals", args: { patientId: p.id, vitals: vitals } });
    } else if (/\b(cierra|cerrar|termina|terminar|fin|close|end|finish)\b.*\b(turno|shift|visita|visit)\b/.test(n)) {
      intent = "close_shift";
      steps.push({ tool: "generate_shift_report", args: { patientId: p.id } });
      steps.push({ tool: "draft_family_message", args: { patientId: p.id } });
    } else if (/\b(reporte|informe|report|resumen del turno|shift summary)\b/.test(n)) {
      intent = "report";
      steps.push({ tool: "generate_shift_report", args: { patientId: p.id } });
    } else if (/\b(familia|family|mensaje|message|hija|hijo|nieta|daughter|son|granddaughter)\b/.test(n)) {
      intent = "family";
      steps.push({ tool: "draft_family_message", args: { patientId: p.id } });
    } else if (med && /\b(marca|marcar|marque|ya (se )?(la |el |le )?(di|dio|tomo)|dada|dado|tomada|tomado|administr|gave|given|mark|took)\b/.test(n)) {
      intent = "mark_dose";
      steps.push({ tool: "mark_dose_given", args: { patientId: p.id, medId: med.id, time: time || state.lastTime } });
    } else if (vitals) {
      intent = "vitals";
      steps.push({ tool: "log_vitals", args: { patientId: p.id, vitals: vitals } });
    } else if (/\b(medicinas?|medicamentos?|pastillas?|pildoras?|dosis|meds?|medications?|medicines?|pills?|doses?)\b/.test(n) || med) {
      intent = "meds_due";
      steps.push({ tool: "get_med_schedule", args: { patientId: p.id, time: time } });
    } else if (/\b(pacientes|patients|a quien|who do i)\b/.test(n)) {
      intent = "list";
      steps.push({ tool: "list_patients", args: {} });
    } else if (/\b(ayuda|que puedes|help|what can you)\b/.test(n)) {
      intent = "help";
    } else if (mentioned || /\b(perfil|informacion|profile|alergias?|allerg|quien es|tell me about|hablame)\b/.test(n)) {
      intent = "profile";
      steps = [{ tool: "get_patient_profile", args: { patientId: p.id } }];
    }
    return { lang: lang, intent: intent, patientId: p.id, steps: steps, text: raw };
  }

  /* ---------- 2+3. Execute and compose ---------- */
  function compose(pl, results, state) {
    var es = "", en = "", cards = [], focus = null, p = CP.tools.patient(state.activePatientId), sup = CP.SUPERVISOR;
    var R = function (tool) { for (var i = results.length - 1; i >= 0; i--) if (results[i].tool === tool) return results[i].out; return null; };

    switch (pl.intent) {
      case "meds_due": {
        var r = R("get_med_schedule");
        if (!r.due.length) {
          es = "No encuentro medicinas programadas para " + p.shortName + (r.time ? " a las " + fmt12(r.time, "es") : " por ahora") + ".";
          en = "I don't see any medications scheduled for " + p.shortName + (r.time ? " at " + fmt12(r.time, "en") : " right now") + ".";
        } else {
          var pending = r.due.filter(function (d) { return !d.given; }), done = r.due.filter(function (d) { return d.given; });
          var itemsEs = r.due.map(function (d) { return d.med.name + " " + d.med.dose + " " + d.med.instr.es + (d.given ? " (ya dada)" : ""); });
          var itemsEn = r.due.map(function (d) { return d.med.en + " " + d.med.dose + " " + d.med.instr.en + (d.given ? " (already given)" : ""); });
          es = "A las " + fmt12(r.time, "es") + ", a " + p.shortName + " le " + (r.due.length > 1 ? "tocan " : "toca ") + joinList(itemsEs, "es") + ".";
          en = "At " + fmt12(r.time, "en") + ", " + p.shortName + " is due for " + joinList(itemsEn, "en") + ".";
          if (pending.length && !done.length) { es += " Dígame cuando se " + (r.due.length > 1 ? "las" : "la") + " dé y yo " + (r.due.length > 1 ? "las" : "la") + " marco."; en += " Tell me when each one is given and I'll mark it."; }
          if (!pending.length) { es += " Todas ya fueron dadas. ¡Buen trabajo!"; en += " All of them were already given. Nice work!"; }
        }
        focus = "meds"; break;
      }
      case "mark_dose": {
        var m = R("mark_dose_given");
        if (m.alreadyGiven) {
          es = "Ojo: la dosis de " + m.med.name + " de las " + fmt12(m.time, "es") + " ya estaba marcada como dada. No la repita.";
          en = "Heads up: the " + fmt12(m.time, "en") + " " + m.med.en + " was already marked as given. Do not give it again.";
        } else {
          es = "Listo. Marqué la dosis de " + m.med.name + " " + m.med.dose + " de las " + fmt12(m.time, "es") + " como dada.";
          en = "Done. I marked the " + fmt12(m.time, "en") + " " + m.med.en + " " + m.med.dose + " as given.";
          if (m.remainingSameTime.length) {
            es += " Todavía falta" + (m.remainingSameTime.length > 1 ? "n " : " ") + joinList(m.remainingSameTime.map(function (x) { return x.name; }), "es") + ".";
            en += " Still pending: " + joinList(m.remainingSameTime.map(function (x) { return x.en; }), "en") + ".";
          } else { es += " Ya completó todas las medicinas de esa hora."; en += " That completes every dose for that time."; }
        }
        focus = "meds"; break;
      }
      case "vitals": {
        var v = R("log_vitals");
        var vs = CP.notes.fmtVitals(v.record);
        var urgent = v.flags.filter(function (f) { return f.level === "urgent"; }), watch = v.flags.filter(function (f) { return f.level === "watch"; });
        if (urgent.length) {
          es = urgent.map(function (f) { return f.es; }).join(" ") + " Llame ahora a la enfermera supervisora, " + sup.name.replace("Nurse ", "").replace(", RN", "") + ", al " + sup.phone + ". Si tiene dolor de pecho, falta de aire o confusión, llame al 911. Quédese con " + (p.gender === "m" ? "él" : "ella") + " y vuelva a medir en 5 minutos. Yo no doy diagnósticos.";
          en = urgent.map(function (f) { return f.en; }).join(" ") + " Call the supervising nurse, " + sup.name + ", now at " + sup.phone + ". If there is chest pain, shortness of breath or confusion, call 911. Stay with the patient and recheck in 5 minutes. I don't give diagnoses.";
          focus = "alerts";
        } else if (watch.length) {
          es = "Anoté: " + vs + ". " + watch.map(function (f) { return f.es; }).join(" ") + " Vuelva a medir en 15 minutos y lo pongo en el reporte para la enfermera.";
          en = "Logged: " + vs + ". " + watch.map(function (f) { return f.en; }).join(" ") + " Recheck in 15 minutes; I'll flag it in the nurse's report.";
          focus = "vitals";
        } else {
          es = "Anoté los signos vitales de " + p.shortName + ": " + vs.replace("BP", "presión").replace("HR", "pulso") + ". Todo dentro del rango normal.";
          en = "Logged " + p.shortName + "'s vitals: " + vs + ". All within the usual range.";
          focus = "vitals";
        }
        break;
      }
      case "note": {
        var nt = R("add_visit_note").structured, lv = R("log_vitals");
        var parts = [];
        ["meals", "hydration", "mood", "activity", "pain", "incidents"].forEach(function (k) { if (nt[k].length) parts.push(k); });
        var labelsEs = { meals: "comidas", hydration: "líquidos", mood: "ánimo", activity: "actividad", pain: "dolor", incidents: "caídas" };
        es = "Guardé la nota de visita y la organicé en inglés para la agencia: " + joinList(parts.map(function (k) { return labelsEs[k]; }), "es") + (nt.vitals ? " y signos vitales" : "") + ".";
        en = "I saved the visit note and structured it in English for the agency: " + joinList(parts, "en") + (nt.vitals ? " and vitals" : "") + ".";
        var fl = nt.flags.concat(lv ? lv.flags.filter(function (f) { return f.level === "urgent"; }).map(function (f) { return f.en; }) : []);
        if (fl.length) { es += " Importante: hay algo para avisar a la enfermera supervisora."; en += " Important: " + fl.join(" "); focus = "alerts"; }
        else { es += " Diga «Alexa, cierra el turno» cuando termine."; en += " Say \"Alexa, close the shift\" when you're done."; focus = "note"; }
        break;
      }
      case "report": {
        es = "Aquí está el reporte del turno de " + p.shortName + " en inglés, listo para la agencia. Lo puede copiar o enviar cuando usted lo apruebe.";
        en = "Here is " + p.shortName + "'s shift report in English, ready for the agency. Copy it or send it once you approve it.";
        focus = "report"; break;
      }
      case "family": {
        var fm = R("draft_family_message");
        es = "Preparé un mensaje para " + p.family.name + ", " + p.family.relation.es + " de " + p.shortName + ", en español y en inglés. No lo envío sin su permiso.";
        en = "I drafted a message for " + p.family.name + ", " + p.shortName + "'s " + p.family.relation.en + ", in Spanish and English. I won't send it without your OK.";
        focus = "family"; break;
      }
      case "close_shift": {
        es = "Cerré el turno de " + p.shortName + ": el reporte en inglés para la agencia y el mensaje para " + p.family.name + " están listos para revisar. ¡Gracias por su trabajo de hoy!";
        en = "Shift closed for " + p.shortName + ": the English agency report and the message for " + p.family.name + " are ready for review. Thank you for today's work!";
        focus = "report"; break;
      }
      case "profile": {
        es = p.name + ", " + p.age + " años. Condiciones: " + joinList(p.conditions.es, "es") + ". Alergias: " + joinList(p.allergies.es, "es") + ". " + p.notes.es;
        en = p.name + ", " + p.age + ". Conditions: " + joinList(p.conditions.en, "en") + ". Allergies: " + joinList(p.allergies.en, "en") + ". " + p.notes.en;
        focus = "patient"; break;
      }
      case "list": {
        es = "Hoy tiene " + CP.DEMO_PATIENTS.length + " pacientes: " + joinList(CP.DEMO_PATIENTS.map(function (x) { return x.shortName; }), "es") + ".";
        en = "You have " + CP.DEMO_PATIENTS.length + " patients today: " + joinList(CP.DEMO_PATIENTS.map(function (x) { return x.shortName; }), "en") + ".";
        focus = "patient"; break;
      }
      case "help":
        es = "Puedo decirle qué medicinas tocan, marcar dosis, anotar signos vitales, guardar notas de visita, hacer el reporte en inglés para la agencia y preparar mensajes para la familia.";
        en = "I can tell you which meds are due, mark doses, log vitals, save visit notes, write the English report for the agency, and draft family messages.";
        break;
      default:
        es = "Perdón, no entendí. Puede decir, por ejemplo: «¿Qué medicinas le tocan a Doña Carmen a las 8?»";
        en = "Sorry, I didn't catch that. Try: \"Which meds is Doña Carmen due for at 8?\"";
    }
    return { es: es, en: en, focus: focus };
  }

  var llmPlanner = null; // set by CP.agent.useLLM(fn)

  CP.agent = {
    plan: plan,
    fmt12: fmt12,
    useLLM: function (fn) { llmPlanner = fn; },
    /* Returns { lang, intent, steps, results, reply:{es,en,speak,sub}, focus } */
    handle: async function (text, state) {
      var pl = null;
      if (llmPlanner) { try { pl = await llmPlanner(text, state, CP.tools.schemas()); } catch (e) { console.warn("LLM planner failed, using offline router", e); } }
      if (!pl) pl = plan(text, state);
      var results = [];
      for (var i = 0; i < pl.steps.length; i++) {
        var s = pl.steps[i];
        results.push({ tool: s.tool, args: s.args, out: CP.tools.call(state, s.tool, s.args), silent: s.silent });
      }
      var c = compose(pl, results, state);
      var speakLang = pl.lang;
      return {
        lang: pl.lang, intent: pl.intent, steps: pl.steps, results: results, focus: c.focus,
        reply: { es: c.es, en: c.en, speak: speakLang === "en" ? c.en : c.es, sub: speakLang === "en" ? c.es : c.en, speakLang: speakLang }
      };
    }
  };
})(window.CP = window.CP || {});
