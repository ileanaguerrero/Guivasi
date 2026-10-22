/* Cuidadora+ — session state, persisted in localStorage. */
(function (CP) {
  var KEY = "cuidadora-plus-state-v1";

  function today() {
    var d = CP.clock.now();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function fresh() {
    return {
      caregiverName: "Ileana",
      day: today(),
      activePatientId: "carmen",
      lastTime: null,
      doses: {},      // patientId -> { "medId@HH:MM": isoTimestamp }
      vitals: {},     // patientId -> [ {ts, bp:{sys,dia}, hr, glucose, temp, spo2, flags:[]} ]
      notes: {},      // patientId -> [ {ts, text, structured} ]
      alerts: {},     // patientId -> [ {ts, level, es, en} ]
      reports: {},    // patientId -> {ts, text}
      familyMsgs: {}, // patientId -> {ts, es, en}
      transcript: []  // [{who:'user'|'alexa', text, sub}]
    };
  }

  var memory = null; // fallback when localStorage is unavailable

  CP.store = {
    load: function () {
      var s = null;
      try { s = JSON.parse(window.localStorage.getItem(KEY)); } catch (e) { s = memory; }
      if (!s) s = fresh();
      if (s.day !== today()) { // new day: keep caregiver + patient, reset shift data
        var keep = { caregiverName: s.caregiverName, activePatientId: s.activePatientId };
        s = Object.assign(fresh(), keep);
      }
      return s;
    },
    save: function (s) {
      memory = s;
      try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
    },
    reset: function () {
      memory = null;
      try { window.localStorage.removeItem(KEY); } catch (e) {}
      return fresh();
    }
  };

  /* Demo clock: ?time=08:05 pins the clock so demos are repeatable. */
  CP.clock = {
    fixed: null,
    now: function () {
      if (!this.fixed) return new Date();
      var d = new Date();
      d.setHours(this.fixed[0], this.fixed[1], 0, 0);
      return d;
    },
    hhmm: function () {
      var d = this.now();
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
  };
  try {
    var t = new URLSearchParams(window.location.search).get("time");
    if (t && /^\d{1,2}:\d{2}$/.test(t)) CP.clock.fixed = t.split(":").map(Number);
  } catch (e) {}
})(window.CP = window.CP || {});
