/* Cuidadora+ — demo data.
 * ALL PATIENTS, PHONE NUMBERS AND PEOPLE BELOW ARE FICTIONAL. No real PHI.
 */
(function (CP) {
  CP.DEMO_PATIENTS = [
    {
      id: "carmen",
      name: "Doña Carmen Rivera",
      shortName: "Doña Carmen",
      aliases: ["carmen", "dona carmen", "carmen rivera", "senora rivera", "mrs rivera"],
      age: 82,
      gender: "f",
      conditions: { es: ["Diabetes tipo 2", "Presión alta"], en: ["Type 2 diabetes", "Hypertension"] },
      allergies: { es: ["Penicilina"], en: ["Penicillin"] },
      notes: { es: "Usa andador. Le gusta el café con leche.", en: "Uses a walker. Likes café con leche." },
      family: { name: "Marisol", relation: { es: "hija", en: "daughter" }, phone: "(555) 010-2231" },
      meds: [
        { id: "metformin", name: "Metformina", en: "Metformin", dose: "500 mg", times: ["08:00", "18:00"], instr: { es: "con comida", en: "with food" }, aliases: ["metformina", "metformin", "glucophage"] },
        { id: "lisinopril", name: "Lisinopril", en: "Lisinopril", dose: "10 mg", times: ["08:00"], instr: { es: "en la mañana", en: "in the morning" }, aliases: ["lisinopril"] },
        { id: "atorvastatin", name: "Atorvastatina", en: "Atorvastatin", dose: "20 mg", times: ["21:00"], instr: { es: "antes de dormir", en: "at bedtime" }, aliases: ["atorvastatina", "atorvastatin", "lipitor"] }
      ]
    },
    {
      id: "ramon",
      name: "Don Ramón Ortiz",
      shortName: "Don Ramón",
      aliases: ["ramon", "don ramon", "ramon ortiz", "senor ortiz", "mr ortiz"],
      age: 77,
      gender: "m",
      conditions: { es: ["Parkinson", "Artritis"], en: ["Parkinson's disease", "Arthritis"] },
      allergies: { es: ["Ninguna conocida"], en: ["No known allergies"] },
      notes: { es: "Riesgo de caídas. Caminar despacio con él.", en: "Fall risk. Walk slowly with him." },
      family: { name: "Luis", relation: { es: "hijo", en: "son" }, phone: "(555) 010-7782" },
      meds: [
        { id: "levodopa", name: "Carbidopa/Levodopa", en: "Carbidopa/Levodopa", dose: "25/100 mg", times: ["08:00", "12:00", "16:00", "20:00"], instr: { es: "a la hora exacta", en: "on time, every time" }, aliases: ["levodopa", "carbidopa", "sinemet"] },
        { id: "vitd", name: "Vitamina D", en: "Vitamin D", dose: "1000 UI", times: ["08:00"], instr: { es: "con el desayuno", en: "with breakfast" }, aliases: ["vitamina d", "vitamin d"] },
        { id: "acetaminophen", name: "Acetaminofén", en: "Acetaminophen", dose: "500 mg", times: ["12:00"], instr: { es: "para el dolor de artritis", en: "for arthritis pain" }, aliases: ["acetaminofen", "acetaminophen", "tylenol"] }
      ]
    },
    {
      id: "gladys",
      name: "Sra. Gladys Torres",
      shortName: "Doña Gladys",
      aliases: ["gladys", "dona gladys", "gladys torres", "senora torres", "mrs torres"],
      age: 88,
      gender: "f",
      conditions: { es: ["Insuficiencia cardíaca"], en: ["Heart failure"] },
      allergies: { es: ["Sulfa"], en: ["Sulfa drugs"] },
      notes: { es: "Pesarla cada mañana. Poca sal.", en: "Weigh every morning. Low-salt diet." },
      family: { name: "Ana", relation: { es: "nieta", en: "granddaughter" }, phone: "(555) 010-4410" },
      meds: [
        { id: "furosemide", name: "Furosemida", en: "Furosemide", dose: "20 mg", times: ["08:00"], instr: { es: "en la mañana", en: "in the morning" }, aliases: ["furosemida", "furosemide", "lasix"] },
        { id: "metoprolol", name: "Metoprolol", en: "Metoprolol", dose: "25 mg", times: ["08:00", "20:00"], instr: { es: "con comida", en: "with food" }, aliases: ["metoprolol"] },
        { id: "apixaban", name: "Apixabán", en: "Apixaban", dose: "5 mg", times: ["08:00", "20:00"], instr: { es: "no saltar dosis", en: "do not skip doses" }, aliases: ["apixaban", "eliquis"] }
      ]
    }
  ];

  CP.SUPERVISOR = { name: "Nurse Jennifer Adams, RN", phone: "(555) 010-9000" };
})(window.CP = window.CP || {});
