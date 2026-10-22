/* Cuidadora+ — turns a free-form Spanish (or English) visit note into structured,
 * English shift-report fields. Rule-based extraction (offline). The caregiver's
 * original words are always kept next to the summary so nothing is lost in translation.
 */
(function (CP) {
  var N = function (s) { return CP.nlu.norm(s); };

  var FOODS = {
    avena: "oatmeal", cafe: "coffee", "cafe con leche": "coffee with milk", pan: "bread", tostada: "toast", huevo: "eggs", huevos: "eggs",
    arroz: "rice", habichuelas: "beans", frijoles: "beans", sopa: "soup", caldo: "broth", pollo: "chicken", carne: "meat",
    pescado: "fish", ensalada: "salad", fruta: "fruit", guineo: "banana", platano: "plantain", manzana: "apple",
    jugo: "juice", leche: "milk", galletas: "crackers", yogur: "yogurt", queso: "cheese", vegetales: "vegetables", pasta: "pasta"
  };
  var MEALS = [
    { re: /\b(desayuno|desayunó|desayunó|breakfast)\b/, en: "Breakfast" },
    { re: /\b(almuerzo|almorzo|lunch)\b/, en: "Lunch" },
    { re: /\b(cena|ceno|dinner|supper)\b/, en: "Dinner" },
    { re: /\b(merienda|snack)\b/, en: "Snack" }
  ];
  var AMOUNTS = [
    { re: /\b(todo|toda|completo|all of it|everything)\b/, en: "ate all" },
    { re: /\b(la mitad|mitad|half)\b/, en: "ate about half" },
    { re: /\b(poquito|muy poco|poco|a little|little)\b/, en: "ate a little" },
    { re: /\b(nada|no quiso comer|no comio|nothing|refused)\b/, en: "did not eat / refused" }
  ];
  var MOODS = [
    { re: /\b(contenta|contento|alegre|feliz|happy|cheerful)\b/, en: "happy" },
    { re: /\b(tranquila|tranquilo|calmada|calmado|calm)\b/, en: "calm" },
    { re: /\b(cansada|cansado|tired)\b/, en: "tired" },
    { re: /\b(triste|deprimida|deprimido|sad)\b/, en: "sad" },
    { re: /\b(confundida|confundido|desorientada|desorientado|confused)\b/, en: "confused (new or worse confusion should be reported)" },
    { re: /\b(ansiosa|ansioso|nerviosa|nervioso|anxious)\b/, en: "anxious" },
    { re: /\b(irritable|molesta|molesto|enojada|enojado|agitated)\b/, en: "irritable" }
  ];
  var BODY = {
    rodilla: "knee", espalda: "back", cabeza: "head", pecho: "chest", estomago: "stomach", barriga: "stomach",
    pierna: "leg", brazo: "arm", cadera: "hip", pie: "foot", hombro: "shoulder", cuello: "neck", mano: "hand",
    knee: "knee", back: "back", head: "head", chest: "chest", stomach: "stomach", hip: "hip", leg: "leg"
  };

  function sentences(text) {
    return String(text).split(/(?<=[.!?;])\s+|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function num(n) {
    var m = n.match(/\b(\d+)\b/);
    if (m) return +m[1];
    var w = n.match(/\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|one|two|three|four|five|six|eight|ten|fifteen|twenty|thirty)\b/);
    return w ? CP.nlu.NUM_WORDS[w[1]] : null;
  }

  function structure(text) {
    var out = { meals: [], hydration: [], mood: [], activity: [], pain: [], incidents: [], sleep: [], bathroom: [], other: [], vitals: null, flags: [] };
    sentences(text).forEach(function (raw) {
      var s = N(raw), used = false;

      // Meals
      MEALS.forEach(function (m) {
        if (!m.re.test(s) && !(m.en === "Breakfast" && /\bdesayun/.test(s)) && !(m.en === "Lunch" && /\balmorz/.test(s)) && !(m.en === "Dinner" && /\bcen(o|a)\b/.test(s))) return;
        var amt = "ate (amount not stated)";
        for (var i = 0; i < AMOUNTS.length; i++) if (AMOUNTS[i].re.test(s)) { amt = AMOUNTS[i].en; break; }
        var foods = [];
        var hits = [];
        Object.keys(FOODS).sort(function (a, b) { return b.length - a.length; }).forEach(function (f) {
          var mm = new RegExp("\\b" + f + "\\b").exec(s);
          if (mm && !hits.some(function (h) { return mm.index >= h.i && mm.index < h.i + h.len; })) hits.push({ i: mm.index, len: f.length, en: FOODS[f] });
        });
        hits.sort(function (a, b) { return a.i - b.i; }).forEach(function (h) { if (foods.indexOf(h.en) === -1) foods.push(h.en); });
        out.meals.push(m.en + ": " + amt + (foods.length ? " (" + foods.join(", ") + ")" : ""));
        if (amt === "did not eat / refused") out.flags.push("Refused a meal — monitor intake.");
        used = true;
      });

      // Hydration
      if (/\b(agua|liquidos|vasos?|water|fluids|glass)\b/.test(s) && /\b(tomo|bebio|tomamos|drank|had)\b/.test(s)) {
        var g = num(s);
        out.hydration.push(g ? g + " glass" + (g === 1 ? "" : "es") + " of water" : "drank water");
        used = true;
      }

      // Mood
      MOODS.forEach(function (m) {
        if (m.re.test(s)) {
          var q = /\b(un poco|algo|a bit|slightly)\b/.test(s) && s.search(m.re) > s.search(/\b(un poco|algo|a bit|slightly)\b/) ? "slightly " : "";
          out.mood.push(q + m.en); used = true;
          if (m.en.indexOf("confused") === 0) out.flags.push("Confusion noted — inform the supervising nurse.");
        }
      });

      // Activity
      if (/\b(camino|caminamos|caminar|paseo|walk(ed)?|ejercicio|exercise|terapia)\b/.test(s)) {
        var mins = s.match(/\b(\d+|[a-z]+)\s*(minutos|minutes|min)\b/);
        var mm = mins ? (/^\d+$/.test(mins[1]) ? +mins[1] : CP.nlu.NUM_WORDS[mins[1]]) : null;
        var where = /\bsala\b/.test(s) ? " in the living room" : /\b(afuera|patio|jardin|outside)\b/.test(s) ? " outside" : "";
        out.activity.push("Walked" + (mm ? " " + mm + " minutes" : "") + where); used = true;
      }
      if (/\b(bano|banamos|ducha|bath(ed)?|shower(ed)?)\b/.test(s) && !/\b(fue al bano|went to the bathroom)\b/.test(s)) { out.activity.push("Bath / personal hygiene completed"); used = true; }

      // Pain
      if (/\b(dolor|duele|pain|hurts|ache)\b/.test(s)) {
        if (/\b(sin dolor|no (tiene|tuvo|siente) dolor|no pain)\b/.test(s)) out.pain.push("No pain reported");
        else {
          var part = null;
          Object.keys(BODY).forEach(function (b) { if (!part && new RegExp("\\b" + b + "\\b").test(s)) part = BODY[b]; });
          var side = /\b(derecha|derecho|right)\b/.test(s) ? "right " : /\b(izquierda|izquierdo|left)\b/.test(s) ? "left " : "";
          out.pain.push((part ? side + part + " pain" : "Pain reported (location not stated)") + (/\bse quejo\b/.test(s) ? " (patient complained)" : ""));
          if (part === "chest") out.flags.push("CHEST PAIN reported — call the supervising nurse now; call 911 if severe or with shortness of breath.");
        }
        used = true;
      }

      // Falls / incidents
      if (/\b(cayo|caida|caidas|resbalo|fall|fell)\b/.test(s)) {
        if (/\b(no hubo caidas?|no se cayo|sin caidas?|ninguna caida|no falls?)\b/.test(s)) out.incidents.push("No falls");
        else { out.incidents.push("FALL reported: \"" + raw + "\""); out.flags.push("Fall reported — notify the supervising nurse and complete an incident report."); }
        used = true;
      }
      if (/\b(mareo|mareada|mareado|dizzy)\b/.test(s)) { out.incidents.push("Dizziness reported"); out.flags.push("Dizziness — inform the supervising nurse."); used = true; }

      // Sleep
      if (/\b(durmio|siesta|slept|nap)\b/.test(s)) {
        out.sleep.push(/\b(mal|poco|no durmio|badly|poorly)\b/.test(s) ? "Slept poorly" : /\bsiesta|nap\b/.test(s) ? "Took a nap" : "Slept well"); used = true;
      }
      // Bathroom
      if (/\b(fue al bano|evacuo|orino|bowel|urinated|went to the bathroom)\b/.test(s)) { out.bathroom.push("Bathroom: normal elimination reported"); used = true; }

      // Vitals inside the note
      var v = CP.nlu.parseVitals(s);
      if (v) { out.vitals = Object.assign(out.vitals || {}, v); used = true; }

      if (!used) out.other.push(raw);
    });
    return out;
  }

  function fmtVitals(v) {
    if (!v) return "";
    var p = [];
    if (v.bp) p.push("BP " + v.bp.sys + "/" + v.bp.dia + " mmHg");
    if (v.hr) p.push("HR " + v.hr + " bpm");
    if (v.glucose) p.push("Blood glucose " + v.glucose + " mg/dL");
    if (v.temp) p.push("Temp " + v.temp + " °F");
    if (v.spo2) p.push("SpO2 " + v.spo2 + "%");
    return p.join(" · ");
  }

  function hhmm(iso) { var d = new Date(iso); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  function shiftReport(state, patient) {
    var notes = state.notes[patient.id] || [], vit = state.vitals[patient.id] || [], alerts = state.alerts[patient.id] || [];
    var doses = state.doses[patient.id] || {};
    var merged = { meals: [], hydration: [], mood: [], activity: [], pain: [], incidents: [], sleep: [], bathroom: [], other: [], flags: [] };
    notes.forEach(function (n) { Object.keys(merged).forEach(function (k) { merged[k] = merged[k].concat(n.structured[k] || []); }); });
    var L = [];
    var d = CP.clock.now();
    L.push("SHIFT REPORT — " + patient.name + " (" + patient.age + ")");
    L.push("Date: " + d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) + " · Caregiver: " + state.caregiverName + " (HHA)");
    L.push("Diagnoses on file: " + patient.conditions.en.join(", ") + " · Allergies: " + patient.allergies.en.join(", "));
    L.push("");
    L.push("VITALS: " + (vit.length ? vit.map(function (x) { return hhmm(x.ts) + " " + fmtVitals(x) + (x.flags.length ? " [" + x.flags.map(function (f) { return f.label; }).join("; ") + "]" : ""); }).join(" | ") : "Not recorded this shift"));
    var medLines = [];
    patient.meds.forEach(function (m) {
      m.times.forEach(function (t) {
        var k = m.id + "@" + t;
        medLines.push("  - " + m.en + " " + m.dose + " @ " + t + ": " + (doses[k] ? "GIVEN " + hhmm(doses[k]) : (t <= CP.clock.hhmm() ? "NOT CONFIRMED" : "due later")));
      });
    });
    L.push("MEDICATIONS (caregiver-assisted, per schedule):");
    L = L.concat(medLines);
    function sec(label, arr, empty) { L.push(label + ": " + (arr.length ? arr.join("; ") : empty)); }
    sec("MEALS", merged.meals, "Not documented");
    sec("FLUIDS", merged.hydration, "Not documented");
    sec("MOOD / BEHAVIOR", merged.mood, "Not documented");
    sec("ACTIVITY / ADLs", merged.activity, "Not documented");
    sec("PAIN / COMPLAINTS", merged.pain, "None reported");
    sec("FALLS / INCIDENTS", merged.incidents, "None reported");
    if (merged.sleep.length) sec("SLEEP", merged.sleep, "");
    if (merged.bathroom.length) sec("ELIMINATION", merged.bathroom, "");
    if (merged.other.length) sec("OTHER (untranslated, see original)", merged.other, "");
    var follow = merged.flags.concat(alerts.map(function (a) { return a.en; }));
    follow = follow.filter(function (x, i) { return follow.indexOf(x) === i; });
    L.push("FOLLOW-UP FOR NURSE: " + (follow.length ? "" : "None"));
    follow.forEach(function (f) { L.push("  ! " + f); });
    if (notes.length) {
      L.push("");
      L.push("Caregiver's original note(s), Spanish:");
      notes.forEach(function (n) { L.push("  [" + hhmm(n.ts) + "] \"" + n.text + "\""); });
    }
    L.push("");
    L.push("Auto-structured by Cuidadora+ from the caregiver's voice notes. Observations only — not a clinical assessment.");
    return L.join("\n");
  }

  function familyMessage(state, patient) {
    var notes = state.notes[patient.id] || [], vit = state.vitals[patient.id] || [], doses = state.doses[patient.id] || {};
    var total = 0, given = 0, now = CP.clock.hhmm();
    patient.meds.forEach(function (m) { m.times.forEach(function (t) { if (t <= now || doses[m.id + "@" + t]) { total++; if (doses[m.id + "@" + t]) given++; } }); });
    var merged = { meals: [], mood: [], activity: [] };
    notes.forEach(function (n) { ["meals", "mood", "activity"].forEach(function (k) { merged[k] = merged[k].concat(n.structured[k] || []); }); });
    var male = patient.gender === "m", she = male ? "he" : "she", her = male ? "His" : "Her";
    var moodEs = male ? { happy: "contento", calm: "tranquilo", tired: "cansado", sad: "triste", anxious: "ansioso", irritable: "irritable" }
                      : { happy: "contenta", calm: "tranquila", tired: "cansada", sad: "triste", anxious: "ansiosa", irritable: "irritable" };
    var f = patient.family, rel = f.relation, cg = state.caregiverName;
    var lastBP = null; vit.forEach(function (v) { if (v.bp) lastBP = v.bp; });
    var es = "Hola " + f.name + ", le escribe " + cg + ", la cuidadora de " + patient.shortName + ". ";
    var en = "Hi " + f.name + ", this is " + cg + ", " + patient.shortName + "'s caregiver. ";
    if (merged.mood.length) {
      var m0 = merged.mood.map(function (m) { var k = m.replace("slightly ", ""); return (m.indexOf("slightly") === 0 ? "un poco " : "") + (moodEs[k] || k); });
      es += "Hoy estuvo " + m0.join(" y ") + ". "; en += "Today " + she + " was " + merged.mood.join(" and ") + ". ";
    }
    if (merged.meals.length) { var ateAll = merged.meals.every(function (m) { return /ate all/.test(m); }); es += ateAll ? "Comió bien. " : "Comió un poco menos de lo normal, pero comió. "; en += "Meals: " + merged.meals.join("; ").toLowerCase() + ". "; }
    if (merged.activity.length) { es += "Hicimos un poco de actividad y caminamos " + (male ? "juntos" : "juntas") + ". "; en += merged.activity.join("; ") + ". "; }
    if (total) { es += "Medicinas: " + given + " de " + total + " dosis de hoy fueron dadas a tiempo. "; en += "Medications: " + given + " of " + total + " doses so far were given on time. "; }
    var alertsN = (state.alerts[patient.id] || []).length;
    if (lastBP && !alertsN) { es += "Su presión fue " + lastBP.sys + "/" + lastBP.dia + ". "; en += her + " blood pressure was " + lastBP.sys + "/" + lastBP.dia + ". "; }
    var alerts = state.alerts[patient.id] || [];
    if (alerts.length) { es += "La enfermera supervisora ya fue informada de un valor fuera de lo normal. "; en += "The supervising nurse has been informed about an out-of-range reading. "; }
    es += "Cualquier pregunta, estoy a la orden. ¡Bendiciones!";
    en += "Any questions, I'm here to help. Blessings!";
    return { es: es, en: en };
  }

  CP.notes = { structure: structure, shiftReport: shiftReport, familyMessage: familyMessage, fmtVitals: fmtVitals };
})(window.CP = window.CP || {});
