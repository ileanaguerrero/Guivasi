/* Cuidadora+ — UI: conversation, Alexa+-style visual cards, agent trace. */
(function (CP) {
  var $ = function (id) { return document.getElementById(id); };
  var state = CP.store.load();
  var activeCard = "meds";
  var busy = false;

  var SAMPLES = [
    "Alexa, ¿qué medicinas le tocan a Doña Carmen a las 8?",
    "Alexa, marca la metformina como dada",
    "Alexa, nota de visita: Doña Carmen desayunó la mitad, avena y café con leche. Tomó dos vasos de agua. Estaba contenta pero un poco cansada. Caminamos diez minutos por la sala. Se quejó de dolor en la rodilla derecha. No hubo caídas.",
    "Alexa, la presión de Doña Carmen está en 182 sobre 110",
    "Alexa, prepara un mensaje para la familia",
    "Alexa, cierra el turno",
    "Alexa, what meds is Don Ramón due for at noon?"
  ];
  var CARDS = [
    { id: "patient", es: "Paciente", en: "Patient" },
    { id: "meds", es: "Medicinas", en: "Meds" },
    { id: "vitals", es: "Signos", en: "Vitals" },
    { id: "alerts", es: "Alertas", en: "Alerts" },
    { id: "note", es: "Nota", en: "Note" },
    { id: "report", es: "Reporte", en: "Report" },
    { id: "family", es: "Familia", en: "Family" }
  ];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hhmm(iso) { var d = new Date(iso); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function P() { return CP.tools.patient(state.activePatientId); }

  /* ---------- header ---------- */
  function renderPatients() {
    $("patient-tabs").innerHTML = CP.DEMO_PATIENTS.map(function (p) {
      var a = (state.alerts[p.id] || []).some(function (x) { return x.level === "urgent"; });
      return '<button class="ptab' + (p.id === state.activePatientId ? " on" : "") + '" data-id="' + p.id + '" aria-pressed="' + (p.id === state.activePatientId) + '">' +
        '<span class="avatar">' + esc(p.shortName.split(" ").pop()[0]) + '</span>' + esc(p.shortName) + ' <small>' + p.age + '</small>' + (a ? ' <span class="dot" title="Alerta">!</span>' : "") + "</button>";
    }).join("");
  }
  function renderClock() { $("clock").textContent = CP.agent.fmt12(CP.clock.hhmm(), "en") + (CP.clock.fixed ? " · demo" : ""); }

  /* ---------- chat ---------- */
  function addBubble(who, text, sub, extra) {
    var li = document.createElement("li");
    li.className = "msg " + who + (extra ? " " + extra : "");
    li.innerHTML = '<div class="bubble"><p>' + esc(text) + "</p>" + (sub ? '<p class="sub" lang="en">' + esc(sub) + "</p>" : "") + "</div>";
    $("chat").appendChild(li);
    $("chat").scrollTop = $("chat").scrollHeight;
    return li;
  }
  function renderTranscript() {
    $("chat").innerHTML = "";
    if (!state.transcript.length) {
      addBubble("alexa", "¡Hola, " + state.caregiverName + "! Soy su asistente. Pregúnteme por las medicinas, dicte una nota de visita o pídame el reporte en inglés.",
        "Hi " + state.caregiverName + "! Ask me about meds, dictate a visit note, or ask for the English report.");
    }
    state.transcript.slice(-30).forEach(function (t) { addBubble(t.who, t.text, t.sub, t.cls); });
  }

  /* ---------- cards ---------- */
  function cardPatient(p) {
    return '<article class="card"><header><h2>' + esc(p.name) + '</h2><span class="chip">' + p.age + ' años · ' + p.age + ' yrs</span></header>' +
      '<div class="two"><div><h3>Condiciones <small>Conditions</small></h3><ul>' + p.conditions.es.map(function (c, i) { return "<li>" + esc(c) + ' <small lang="en">' + esc(p.conditions.en[i]) + "</small></li>"; }).join("") + "</ul>" +
      '<h3>Alergias <small>Allergies</small></h3><ul class="warn">' + p.allergies.es.map(function (c, i) { return "<li>⚠ " + esc(c) + ' <small lang="en">' + esc(p.allergies.en[i]) + "</small></li>"; }).join("") + "</ul></div>" +
      '<div><h3>Cuidado <small>Care notes</small></h3><p>' + esc(p.notes.es) + '</p><p class="en" lang="en">' + esc(p.notes.en) + "</p>" +
      '<h3>Familia <small>Family</small></h3><p>' + esc(p.family.name) + " (" + esc(p.family.relation.es) + ") · " + esc(p.family.phone) + "</p>" +
      '<h3>Supervisora <small>Nurse</small></h3><p>' + esc(CP.SUPERVISOR.name) + " · " + esc(CP.SUPERVISOR.phone) + "</p></div></div></article>";
  }
  function cardMeds(p) {
    var doses = state.doses[p.id] || {}, now = CP.clock.hhmm(), rows = [];
    p.meds.forEach(function (m) { m.times.forEach(function (t) { rows.push({ m: m, t: t, g: doses[m.id + "@" + t] }); }); });
    rows.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    var given = rows.filter(function (r) { return r.g; }).length;
    return '<article class="card"><header><h2>Medicinas de hoy <small>Today\'s meds</small></h2><span class="chip ok">' + given + " / " + rows.length + " dadas · given</span></header>" +
      '<ol class="meds">' + rows.map(function (r) {
        var st = r.g ? "given" : (r.t <= now ? "due" : "later");
        var lab = r.g ? "✓ Dada " + hhmm(r.g) + ' <small>Given</small>' : st === "due" ? "● Toca ahora <small>Due</small>" : "Más tarde <small>Later</small>";
        var hl = state.lastTime === r.t ? " hl" : "";
        return '<li class="' + st + hl + '"><span class="time">' + CP.agent.fmt12(r.t, "en") + '</span><span class="name"><b>' + esc(r.m.name) + "</b> " + esc(r.m.dose) +
          '<small>' + esc(r.m.instr.es) + " · " + esc(r.m.instr.en) + '</small></span><span class="status">' + lab + "</span></li>";
      }).join("") + "</ol></article>";
  }
  function cardVitals(p) {
    var v = state.vitals[p.id] || [];
    if (!v.length) return empty("Signos vitales", "Vitals", "Diga: «Alexa, la presión está en 130 sobre 80»", "Say: \"Alexa, blood pressure 130 over 80\"");
    return '<article class="card"><header><h2>Signos vitales <small>Vitals</small></h2></header><ol class="vitals">' + v.slice().reverse().map(function (x) {
      var lvl = x.flags.some(function (f) { return f.level === "urgent"; }) ? "urgent" : x.flags.length ? "watch" : "okv";
      return '<li class="' + lvl + '"><span class="time">' + hhmm(x.ts) + '</span><span class="big">' + esc(CP.notes.fmtVitals(x)) + '</span><span class="status">' +
        (lvl === "urgent" ? "Llamar a la enfermera · Call nurse" : lvl === "watch" ? "Vigilar · Recheck" : "Normal") + "</span></li>";
    }).join("") + "</ol></article>";
  }
  function cardAlerts(p) {
    var a = state.alerts[p.id] || [];
    var notes = state.notes[p.id] || [], flags = [];
    notes.forEach(function (n) { (n.structured.flags || []).forEach(function (f) { flags.push({ ts: n.ts, level: "watch", es: "Nota: revisar con la enfermera.", en: f }); }); });
    var all = a.concat(flags);
    if (!all.length) return empty("Alertas", "Alerts", "No hay alertas. ¡Todo bien!", "No alerts right now.");
    var urgent = all.filter(function (x) { return x.level === "urgent"; }).length;
    return '<article class="card alert-card"><header><h2>Alertas <small>Alerts</small></h2></header>' +
      (urgent ? '<div class="callbox" role="alert"><div class="callicon">📞</div><div><b>Llame a la enfermera supervisora</b><span lang="en">Call the supervising nurse: ' + esc(CP.SUPERVISOR.name) + "</span><span class=\"phone\">" + esc(CP.SUPERVISOR.phone) + "</span><small>Emergencia (dolor de pecho, falta de aire): 911 · No es un diagnóstico / Not a diagnosis</small></div></div>" : "") +
      '<ol class="alerts">' + all.slice().reverse().map(function (x) { return '<li class="' + x.level + '"><span class="time">' + hhmm(x.ts) + "</span><span>" + esc(x.es) + '<small lang="en">' + esc(x.en) + "</small></span></li>"; }).join("") + "</ol></article>";
  }
  function cardNote(p) {
    var n = (state.notes[p.id] || []).slice(-1)[0];
    if (!n) return empty("Nota de visita", "Visit note", "Diga: «Alexa, nota de visita: …» y hable normal, en español.", "Say \"Alexa, visit note: …\" and just talk in Spanish.");
    var s = n.structured, L = { meals: "Meals", hydration: "Fluids", mood: "Mood", activity: "Activity", pain: "Pain", incidents: "Falls / incidents", sleep: "Sleep", bathroom: "Elimination" };
    var rows = Object.keys(L).filter(function (k) { return s[k].length; }).map(function (k) { return "<tr><th>" + L[k] + "</th><td>" + esc(s[k].join("; ")) + "</td></tr>"; }).join("");
    if (s.vitals) rows += "<tr><th>Vitals</th><td>" + esc(CP.notes.fmtVitals(s.vitals)) + "</td></tr>";
    return '<article class="card"><header><h2>Nota de visita <small>Visit note → English</small></h2><span class="chip">' + hhmm(n.ts) + "</span></header>" +
      '<div class="two note"><div><h3>Lo que usted dijo <small>Spanish original</small></h3><blockquote>' + esc(n.text) + '</blockquote></div><div><h3>Para la agencia <small>Structured (English)</small></h3><table>' + rows + "</table></div></div></article>";
  }
  function cardReport(p) {
    var r = state.reports[p.id];
    if (!r) return empty("Reporte del turno", "Shift report", "Diga: «Alexa, cierra el turno» o «haz el reporte».", "Say \"Alexa, close the shift\" or \"make the report\".");
    return '<article class="card"><header><h2>Reporte en inglés <small>Shift report for agency / nurse</small></h2><button class="ghost copy" data-copy="report">Copiar · Copy</button></header><pre class="report" lang="en">' + esc(r.text) + "</pre></article>";
  }
  function cardFamily(p) {
    var m = state.familyMsgs[p.id];
    if (!m) return empty("Mensaje a la familia", "Family update", "Diga: «Alexa, prepara un mensaje para la familia».", "Say \"Alexa, draft a family message\".");
    return '<article class="card"><header><h2>Mensaje para ' + esc(p.family.name) + ' <small>Draft · not sent</small></h2><button class="ghost copy" data-copy="family">Copiar · Copy</button></header>' +
      '<div class="two"><div class="msgbox"><h3>Español</h3><p>' + esc(m.es) + '</p></div><div class="msgbox"><h3>English</h3><p lang="en">' + esc(m.en) + "</p></div></div>" +
      '<p class="hint">🔒 Borrador. Cuidadora+ nunca envía mensajes sin su aprobación. <span lang="en">Draft only — never sent without your approval.</span></p></article>';
  }
  function empty(es, en, hes, hen) {
    return '<article class="card empty"><header><h2>' + es + " <small>" + en + '</small></h2></header><p class="hint big">' + esc(hes) + '</p><p class="hint" lang="en">' + esc(hen) + "</p></article>";
  }
  var RENDER = { patient: cardPatient, meds: cardMeds, vitals: cardVitals, alerts: cardAlerts, note: cardNote, report: cardReport, family: cardFamily };

  function renderCards() {
    var p = P();
    $("card-tabs").innerHTML = CARDS.map(function (c) {
      var n = c.id === "alerts" ? (state.alerts[p.id] || []).length : 0;
      return '<button class="ctab' + (c.id === activeCard ? " on" : "") + '" data-card="' + c.id + '">' + c.es + " <small>" + c.en + "</small>" + (n ? ' <span class="dot">' + n + "</span>" : "") + "</button>";
    }).join("");
    $("stage").innerHTML = RENDER[activeCard](p);
  }

  function renderTrace(r) {
    var items = [];
    items.push('<li><b>Understand</b> intent=<code>' + esc(r.intent) + "</code> lang=<code>" + r.lang + "</code> patient=<code>" + esc(state.activePatientId) + "</code></li>");
    if (!r.results.length) items.push("<li><b>Plan</b> no tool needed</li>");
    r.results.forEach(function (x, i) {
      var a = Object.assign({}, x.args); if (a.text && a.text.length > 40) a.text = a.text.slice(0, 40) + "…";
      var summary = x.tool === "get_med_schedule" ? (x.out.due.length + " dose(s) @ " + x.out.time) :
        x.tool === "mark_dose_given" ? (x.out.alreadyGiven ? "already given — blocked duplicate" : "recorded " + x.out.med.id + "@" + x.out.time) :
        x.tool === "log_vitals" ? (x.out.flags.length ? x.out.flags.map(function (f) { return f.level.toUpperCase() + ": " + f.label; }).join(", ") : "in range") :
        x.tool === "add_visit_note" ? "structured " + Object.keys(x.out.structured).filter(function (k) { return Array.isArray(x.out.structured[k]) && x.out.structured[k].length; }).join(", ") :
        x.tool === "generate_shift_report" ? "report " + x.out.report.split("\n").length + " lines" :
        x.tool === "draft_family_message" ? "ES + EN draft (not sent)" : "ok";
      items.push("<li><b>Tool " + (i + 1) + "</b> <code>" + x.tool + "(" + esc(JSON.stringify(a)) + ")</code> → " + esc(summary) + "</li>");
    });
    items.push("<li><b>Reply</b> spoken in " + (r.reply.speakLang === "en" ? "English" : "Spanish") + ", subtitle in " + (r.reply.speakLang === "en" ? "Spanish" : "English") + "; card=<code>" + (r.focus || "—") + "</code></li>");
    $("trace-list").innerHTML = items.join("");
  }

  function setLight(mode) { $("lightbar").className = "lightbar " + (mode || ""); }

  /* ---------- main loop ---------- */
  async function send(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    $("composer-input").value = "";
    addBubble("user", text);
    state.transcript.push({ who: "user", text: text });
    setLight("thinking");
    var r;
    try { r = await CP.agent.handle(text, state); }
    catch (e) { console.error(e); r = null; }
    if (!r) { addBubble("alexa", "Perdón, algo falló. Intente otra vez.", "Sorry, something went wrong."); busy = false; setLight(""); return; }
    state.transcript.push({ who: "alexa", text: r.reply.speak, sub: r.reply.sub, cls: r.focus === "alerts" ? "urgent" : "" });
    CP.store.save(state);
    if (r.focus) activeCard = r.focus;
    renderPatients(); renderCards(); renderTrace(r);
    addBubble("alexa", r.reply.speak, r.reply.sub, r.focus === "alerts" ? "urgent" : "");
    setLight("speaking");
    CP.voice.speak(r.reply.speak, r.reply.speakLang, function () { setLight(""); });
    busy = false;
    return r;
  }

  function bind() {
    $("composer").addEventListener("submit", function (e) { e.preventDefault(); send($("composer-input").value); });
    $("samples").innerHTML = SAMPLES.map(function (s, i) { return '<button class="sample" data-i="' + i + '">' + esc(s.replace(/^Alexa, /, "").slice(0, 52) + (s.length > 60 ? "…" : "")) + "</button>"; }).join("");
    $("samples").addEventListener("click", function (e) { var b = e.target.closest(".sample"); if (b) send(SAMPLES[+b.dataset.i]); });
    $("patient-tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".ptab"); if (!b) return;
      state.activePatientId = b.dataset.id; state.lastTime = null; CP.store.save(state); activeCard = "patient"; renderPatients(); renderCards();
    });
    $("card-tabs").addEventListener("click", function (e) { var b = e.target.closest(".ctab"); if (b) { activeCard = b.dataset.card; renderCards(); } });
    $("stage").addEventListener("click", function (e) {
      var b = e.target.closest(".copy"); if (!b) return;
      var p = P(), txt = b.dataset.copy === "report" ? state.reports[p.id].text : state.familyMsgs[p.id].es + "\n\n" + state.familyMsgs[p.id].en;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { b.textContent = "✓ Copiado"; });
    });
    $("reset-btn").addEventListener("click", function () {
      if (!window.confirm("¿Borrar los datos del demo? / Reset demo data?")) return;
      state = CP.store.reset(); activeCard = "meds"; CP.store.save(state); renderAll(); $("trace-list").innerHTML = "";
    });
    $("mute-btn").addEventListener("click", function () {
      CP.voice.muted = !CP.voice.muted; CP.voice.stop();
      this.textContent = CP.voice.muted ? "🔇 Silencio" : "🔊 Voz"; this.setAttribute("aria-pressed", CP.voice.muted);
    });
    $("lang-btn").addEventListener("click", function () {
      CP.voice.recLang = CP.voice.recLang === "es-US" ? "en-US" : "es-US";
      this.textContent = CP.voice.recLang === "es-US" ? "🎙️ Español" : "🎙️ English"; this.setAttribute("aria-pressed", CP.voice.recLang !== "es-US");
    });
    var mic = $("mic-btn");
    if (!CP.voice.canListen) { mic.classList.add("off"); mic.title = "Micrófono no disponible en este navegador — escriba / Mic not supported in this browser — type instead"; }
    mic.addEventListener("click", function () {
      CP.voice.stop();
      CP.voice.listen({
        onStart: function () { mic.classList.add("live"); setLight("listening"); $("composer-input").placeholder = "Escuchando… / Listening…"; },
        onText: function (t, final) { $("composer-input").value = t; if (final) send(t); },
        onError: function (err) {
          addBubble("alexa", err === "unsupported" ? "Este navegador no tiene reconocimiento de voz. Puede escribir o tocar un ejemplo." : "No pude escuchar (" + err + "). Puede escribir su pregunta.",
            err === "unsupported" ? "This browser has no speech recognition. Type or tap an example." : "Couldn't hear you (" + err + "). You can type instead.");
        },
        onEnd: function () { mic.classList.remove("live"); setLight(""); $("composer-input").placeholder = "Diga «Alexa…» o escriba aquí / Type here"; }
      });
    });
    document.addEventListener("keydown", function (e) { if (e.key === " " && e.ctrlKey) { e.preventDefault(); mic.click(); } });
    setInterval(renderClock, 15000);
  }

  function renderAll() { renderClock(); renderPatients(); renderTranscript(); renderCards(); }

  CP.ui = { send: send, state: function () { return state; }, show: function (c) { activeCard = c; renderCards(); } };
  bind(); renderAll();
})(window.CP = window.CP || {});
