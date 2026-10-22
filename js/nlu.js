/* Cuidadora+ — lightweight bilingual (Spanish/English) language understanding.
 * Rule-based on purpose: runs offline, no API keys, predictable for a safety-sensitive domain.
 */
(function (CP) {
  var NUM_WORDS = {
    un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, media: 0.5,
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30
  };

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿¡]/g, "").replace(/\s+/g, " ").trim();
  }

  function stripWake(s) {
    return String(s).replace(/^\s*(hey\s+|oye\s+)?alexa[\s,.:!]*/i, "");
  }

  function wordsToNumbers(n) {
    return n.replace(/\b([a-z]+)\b/g, function (w) {
      return Object.prototype.hasOwnProperty.call(NUM_WORDS, w) && w !== "una" && w !== "un" && w !== "media" && w !== "once" ? String(NUM_WORDS[w]) : w;
    });
  }

  var EN_HINTS = /\b(what|which|the|is|are|give|gave|mark|meds?|medications?|pills?|due|blood pressure|report|family|message|note|patient|please|help|today|for|at|she|he|her|his)\b/g;
  var ES_HINTS = /\b(que|cual|le|la|el|los|las|tocan?|medicinas?|pastillas?|presion|nota|reporte|informe|familia|mensaje|ayuda|hoy|para|esta|dada|dado|marca|ella|el|su|de|por favor)\b/g;
  function detectLang(raw) {
    var n = norm(raw);
    var en = (n.match(EN_HINTS) || []).length, es = (n.match(ES_HINTS) || []).length;
    return en > es ? "en" : "es";
  }

  function findPatient(n, patients) {
    var best = null, bestLen = 0;
    patients.forEach(function (p) {
      p.aliases.forEach(function (a) {
        if (new RegExp("\\b" + a + "\\b").test(n) && a.length > bestLen) { best = p; bestLen = a.length; }
      });
    });
    return best;
  }

  function findMed(n, patient) {
    if (!patient) return null;
    for (var i = 0; i < patient.meds.length; i++) {
      var m = patient.meds[i];
      for (var j = 0; j < m.aliases.length; j++) if (n.indexOf(m.aliases[j]) !== -1) return m;
    }
    return null;
  }

  /* "a las 8", "8 de la noche", "8 pm", "20:00", "mediodia", "ahora/now". Returns "HH:MM" or null. */
  function parseTime(n) {
    if (/\b(mediodia|noon|midday)\b/.test(n)) return "12:00";
    if (/\b(ahora|ahorita|now|right now)\b/.test(n)) return "now";
    var m = n.match(/\b(?:a las|a la|at|las|para las)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(\s+de la (manana|tarde|noche))?/) ||
            n.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/) ||
            n.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = 0, ampm = null, part = null;
    if (m.length >= 3 && m[2] && /^\d{2}$/.test(m[2])) min = parseInt(m[2], 10);
    m.slice(2).forEach(function (x) {
      if (!x) return;
      if (/^(am|a\.m\.)$/.test(x)) ampm = "am";
      if (/^(pm|p\.m\.)$/.test(x)) ampm = "pm";
      if (/^(tarde|noche)$/.test(x)) part = "pm";
      if (x === "manana") part = "am";
    });
    if (/\b(de la noche|tonight|in the evening|de la tarde|this evening|in the afternoon)\b/.test(n)) part = "pm";
    if ((ampm === "pm" || part === "pm") && h < 12) h += 12;
    if ((ampm === "am" || part === "am") && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
  }

  /* Vital signs: "presion 180/110", "180 sobre 110", "pulso 88", "azucar 250", "temperatura 101", "oxigeno 95" */
  function parseVitals(n) {
    var t = wordsToNumbers(n), v = {}, m;
    m = t.match(/\b(\d{2,3})\s*(?:\/|sobre|over)\s*(\d{2,3})\b/);
    if (m) v.bp = { sys: +m[1], dia: +m[2] };
    m = t.match(/\b(?:pulso|ritmo cardiaco|frecuencia cardiaca|pulse|heart rate)\D{0,12}(\d{2,3})/);
    if (m) v.hr = +m[1];
    m = t.match(/\b(?:azucar|glucosa|glucose|blood sugar|sugar)\D{0,12}(\d{2,3})/);
    if (m) v.glucose = +m[1];
    m = t.match(/\b(?:temperatura|fiebre|temperature|temp)\D{0,12}(\d{2,3}(?:[.,]\d)?)/);
    if (m) v.temp = parseFloat(m[1].replace(",", "."));
    m = t.match(/\b(?:oxigeno|saturacion|oxygen|spo2|o2)\D{0,12}(\d{2,3})/);
    if (m) v.spo2 = +m[1];
    return Object.keys(v).length ? v : null;
  }

  CP.nlu = {
    norm: norm, stripWake: stripWake, detectLang: detectLang, findPatient: findPatient,
    findMed: findMed, parseTime: parseTime, parseVitals: parseVitals, wordsToNumbers: wordsToNumbers, NUM_WORDS: NUM_WORDS
  };
})(window.CP = window.CP || {});
