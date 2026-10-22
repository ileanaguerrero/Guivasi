/* Cuidadora+ — voice I/O with the Web Speech API.
 * SpeechRecognition (es-US / en-US) for input, speechSynthesis for spoken replies.
 * Everything degrades gracefully: no mic support → typed input; no voices → text only.
 */
(function (CP) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var synth = window.speechSynthesis || null;
  var rec = null, listening = false;

  function pickVoice(lang) {
    if (!synth) return null;
    var voices = synth.getVoices() || [];
    var prefs = lang === "en" ? ["en-US", "en-"] : ["es-US", "es-MX", "es-PR", "es-419", "es-"];
    for (var i = 0; i < prefs.length; i++) {
      var hit = voices.filter(function (v) { return v.lang && v.lang.indexOf(prefs[i]) === 0; });
      if (hit.length) {
        var nice = hit.filter(function (v) { return /natural|neural|google|paulina|paloma|monica|samantha|aria|jenny/i.test(v.name); });
        return (nice[0] || hit[0]);
      }
    }
    return null;
  }

  CP.voice = {
    canListen: !!SR,
    canSpeak: !!synth,
    muted: false,
    recLang: "es-US",
    listen: function (handlers) {
      if (!SR) { handlers.onError && handlers.onError("unsupported"); return; }
      if (listening && rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = this.recLang;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = function () { listening = true; handlers.onStart && handlers.onStart(); };
      rec.onresult = function (e) {
        var txt = "", final = false;
        for (var i = e.resultIndex; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
        handlers.onText && handlers.onText(txt, final);
      };
      rec.onerror = function (e) { handlers.onError && handlers.onError(e.error); };
      rec.onend = function () { listening = false; handlers.onEnd && handlers.onEnd(); };
      try { rec.start(); } catch (e) { handlers.onError && handlers.onError(String(e)); }
    },
    speak: function (text, lang, done) {
      if (!synth || this.muted) { setTimeout(function () { done && done(); }, Math.min(4000, 400 + text.length * 25)); return; }
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text.replace(/[«»"]/g, ""));
      u.lang = lang === "en" ? "en-US" : "es-US";
      var v = pickVoice(lang); if (v) u.voice = v;
      u.rate = lang === "en" ? 1 : 0.95;
      u.onend = function () { done && done(); };
      u.onerror = function () { done && done(); };
      synth.speak(u);
    },
    stop: function () { if (synth) synth.cancel(); }
  };
  if (synth && synth.onvoiceschanged !== undefined) synth.onvoiceschanged = function () { synth.getVoices(); };
})(window.CP = window.CP || {});
