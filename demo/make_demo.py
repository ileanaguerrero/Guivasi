#!/usr/bin/env python3
"""Builds demo/demo.mp4 by driving the REAL app in headless Chromium (Playwright),
taking screenshots at each step, voicing lines with neural TTS (edge-tts), and
stitching everything with ffmpeg. Optional tooling — the app itself needs none of this.

    pip install playwright edge-tts && python -m playwright install chromium
    python demo/make_demo.py          # needs ffmpeg on PATH

Voices (all synthetic): narrator en-US-AndrewNeural, caregiver es-PR-KarinaNeural,
Alexa+ (simulated) es-US-PalomaNeural.
"""
import asyncio, json, os, re, shutil, subprocess, sys
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BUILD = HERE / "build"
OUT = HERE / "demo.mp4"
CACHE = HERE / ".tts-cache"
APP = (ROOT / "index.html").as_uri() + "?time=08:05"
VOICES = {"narrator": ("en-US-AndrewNeural", "+6%"), "caregiver": ("es-PR-KarinaNeural", "+4%"), "alexa": ("es-US-PalomaNeural", "+6%")}
W, H, SCALE = 1440, 810, 4 / 3  # -> 1920x1080 frames

segments = []  # dicts: images[], audio(path|None), pad(sec)
n_audio = 0


def tts(role, text):
    global n_audio
    n_audio += 1
    voice, rate = VOICES[role]
    mp3 = BUILD / f"a{n_audio:02d}_{role}.mp3"
    import hashlib
    CACHE.mkdir(exist_ok=True)
    cached = CACHE / (hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest() + ".mp3")
    if cached.exists():
        shutil.copy(cached, mp3)
        return mp3
    env = {k: v for k, v in os.environ.items() if k.upper() not in ("HTTP_PROXY", "HTTPS_PROXY")}
    clean = text.replace("«", "").replace("»", "").replace("/", " sobre ") if role != "narrator" else text
    for _ in range(3):
        subprocess.run([sys.executable, "-m", "edge_tts", "--voice", voice, f"--rate={rate}", "--text", clean, "--write-media", str(mp3)], env=env, check=False, capture_output=True)
        if mp3.exists() and mp3.stat().st_size > 1000:
            shutil.copy(mp3, cached)
            return mp3
    raise RuntimeError("TTS failed for: " + text)


def first_sentences(s, n):
    parts = re.split(r"(?<=[.!?])\s+", s)
    return " ".join(parts[:n])


OVERLAY_CSS = """
.foot{display:none} body{padding-bottom:84px} .voice{max-height:calc(100vh - 210px)}
#demo-sub{position:fixed;left:50%;transform:translateX(-50%);bottom:10px;max-width:1180px;width:max-content;min-width:520px;
background:rgba(8,14,22,.92);color:#fff;border-radius:16px;padding:8px 22px;font:600 21px/1.3 'Segoe UI',system-ui,sans-serif;
box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:99;text-align:center}
#demo-sub .who{display:block;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7fdcff;margin-bottom:4px}
#demo-sub.cg .who{color:#ffd38a}
#demo-sub.step{background:rgba(11,122,117,.95)} #demo-sub.step .who{color:#d8fff9}
"""


async def overlay(page, kind=None, who="", text=""):
    await page.evaluate("""([kind, who, text]) => {
      let el = document.getElementById('demo-sub');
      if (!kind) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('div'); el.id = 'demo-sub'; document.body.appendChild(el); }
      el.className = kind; el.innerHTML = '<span class="who"></span><span class="t"></span>';
      el.querySelector('.who').textContent = who; el.querySelector('.t').textContent = text;
    }""", [kind, who, text])


shot_n = 0
async def shot(page):
    global shot_n
    shot_n += 1
    p = BUILD / f"s{shot_n:03d}.png"
    await page.screenshot(path=str(p))
    return p


async def card(page, html):
    await page.set_content(f"""<html><head><style>
    body{{margin:0;width:{W}px;height:{H}px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 30% 20%,#12355a,#0b2540 55%,#06172a);color:#fff;font-family:'Segoe UI',system-ui,sans-serif}}
    .w{{max-width:1100px;padding:40px}} h1{{font-size:76px;margin:0 0 6px;letter-spacing:-.02em}} h1 span{{color:#00caff}}
    h2{{font-size:32px;font-weight:600;color:#cfe6ff;margin:0 0 28px}} p,li{{font-size:27px;line-height:1.45;color:#e6f2ff}}
    ul{{padding-left:30px}} .tag{{display:inline-block;background:#00caff;color:#0b2540;font-weight:800;border-radius:999px;padding:6px 18px;font-size:20px;margin:0 8px 8px 0}}
    .bar{{height:10px;width:340px;border-radius:99px;background:linear-gradient(90deg,#0040ff,#00caff,#0040ff);margin:26px 0}}
    small{{color:#9fb7cf;font-size:20px}}
    </style></head><body><div class="w">{html}</div></body></html>""")
    await page.wait_for_timeout(150)
    return await shot(page)


def seg(images, audio=None, pad=0.5, min_dur=0.0):
    segments.append({"images": [str(i) for i in images], "audio": str(audio) if audio else None, "pad": pad, "min": min_dur})


async def say_and_send(page, prompt, prompt_en, n_alexa=None, type_frames=0):
    """Caregiver speaks (mic live) -> agent replies (spoken Spanish + English subtitle)."""
    await page.evaluate("""(t) => { const i = document.getElementById('composer-input'); i.value = t;
        document.getElementById('mic-btn').classList.add('live'); document.getElementById('lightbar').className = 'lightbar listening'; }""", prompt)
    await overlay(page, "cg", "Caregiver · Spanish", prompt_en)
    a_user = tts("caregiver", prompt)
    seg([await shot(page)], a_user, pad=0.3)
    await page.evaluate("document.getElementById('mic-btn').classList.remove('live')")
    r = await page.evaluate("async (t) => { const r = await CP.ui.send(t); return r.reply; }", prompt)
    await page.wait_for_timeout(350)
    await page.evaluate("document.getElementById('lightbar').className = 'lightbar speaking'")
    es, en = r["es"], r["en"]
    if n_alexa:
        es, en = first_sentences(es, n_alexa), first_sentences(en, n_alexa)
    await overlay(page, None)
    await overlay(page, "alexa", "Alexa+ (simulated) · Spanish", en)
    a = tts("alexa", es)
    seg([await shot(page)], a, pad=0.6)
    return r


async def narrate(page, text, step=None, images=None):
    if step:
        await overlay(page, "step", step[0], step[1])
    a = tts("narrator", text)
    imgs = images or [await shot(page)]
    seg(imgs, a, pad=0.35)


async def main():
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir(parents=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=SCALE)

        # 1. Title + problem
        t = await card(page, '<span class="tag">Amazon Developer Hackathon</span><span class="tag">Alexa+ · simulated track</span>'
                             '<h1>Cuidadora<span>+</span></h1><h2>A simulated Alexa+ for Spanish-speaking home health caregivers</h2>'
                             '<div class="bar"></div><p>Habla en español. The agency gets it in English.</p>')
        await narrate(page, "Meet Ileana: a nurse from Puerto Rico, now a home health caregiver in Florida. "
                            "She thinks in Spanish, but the agency, the nurses and the paperwork are all in English.", images=[t])
        t = await card(page, '<h2 style="color:#00caff">The problem</h2><ul>'
                             '<li>Thousands of U.S. home health aides speak Spanish first</li>'
                             '<li>Shift reports, nurse hand-offs and agency forms are in English</li>'
                             '<li>Details get lost: meds, meals, falls, out-of-range vitals</li>'
                             '<li>Escalation is late when the caregiver is unsure how to say it</li></ul>')
        await narrate(page, "That gap means lost details, medication mix-ups, and late calls to the nurse. So we built Cuidadora Plus.", images=[t])

        # 2. App
        await page.goto(APP)
        await page.evaluate("localStorage.clear()")
        await page.goto(APP)
        await page.add_style_tag(content=OVERLAY_CSS)
        await page.wait_for_timeout(400)
        await narrate(page, "A simulated Alexa Plus in a web app: voice on the left, visual cards on the right, and an agent trace of every tool call. It runs fully offline.",
                      step=("Simulated Alexa+ · web app", "Voice chat · visual cards · agent trace · works offline"))

        # 3. Meds due
        await narrate(page, "She asks, in Spanish, what Doña Carmen takes at eight.", step=("Step 1", "Medication schedule"))
        await say_and_send(page, "Alexa, ¿qué medicinas le tocan a Doña Carmen a las 8?", "Alexa, which medicines is Doña Carmen due for at 8?", n_alexa=1)

        # 4. Mark dose
        await narrate(page, "She confirms a dose. The agent remembers the time slot, records it, and says what's still pending.",
                      step=("Step 2", "Mark a dose as given"))
        await say_and_send(page, "Alexa, marca la metformina como dada", "Alexa, mark the metformin as given")

        # 5. Visit note -> structured English
        note = ("Alexa, nota de visita: Doña Carmen desayunó la mitad, avena y café con leche. Tomó dos vasos de agua. Estaba contenta pero un poco cansada. "
                "Caminamos diez minutos por la sala. Se quejó de dolor en la rodilla derecha. No hubo caídas.")
        await overlay(page, "step", "Step 3", "Dictate a visit note in Spanish")
        frames = []
        for frac in (0.25, 0.55, 0.8, 1.0):
            await page.evaluate("""(t) => { const i = document.getElementById('composer-input'); i.value = t; i.scrollLeft = 99999;
                document.getElementById('mic-btn').classList.add('live'); document.getElementById('lightbar').className = 'lightbar listening'; }""", note[: int(len(note) * frac)])
            frames.append(await shot(page))
        await narrate(page, "Then she dictates her visit note, naturally, in Spanish.", images=frames)
        await page.evaluate("document.getElementById('mic-btn').classList.remove('live')")
        r = await page.evaluate("async (t) => (await CP.ui.send(t)).reply", note)
        await page.wait_for_timeout(350)
        await page.evaluate("document.getElementById('lightbar').className = 'lightbar speaking'")
        await overlay(page, "alexa", "Alexa+ (simulated) · Spanish", first_sentences(r["en"], 1))
        seg([await shot(page)], tts("alexa", first_sentences(r["es"], 1)), pad=0.4)
        await overlay(page, None)
        await narrate(page, "It becomes structured English for the agency: meals, fluids, mood, activity, pain, falls. Her own words stay beside it.")

        # 6. High BP alert
        await narrate(page, "Now, a blood pressure of one eighty-two over one ten.", step=("Step 4", "Vitals with safe-range alerts"))
        await say_and_send(page, "Alexa, la presión de Doña Carmen está en 182 sobre 110", "Alexa, Doña Carmen's blood pressure is 182 over 110", n_alexa=2)
        await overlay(page, None)
        await narrate(page, "It never diagnoses. It tells her, in Spanish, to call the supervising nurse now, and when to call nine one one.")

        # 7. Family message
        await narrate(page, "A family update.", step=("Step 5", "Family message in Spanish and English"))
        await say_and_send(page, "Alexa, prepara un mensaje para la familia", "Alexa, draft a message for the family")
        await overlay(page, None)
        await narrate(page, "Drafted in Spanish and English, and never sent without her approval.")

        # 8. Close shift -> report
        await narrate(page, "Finally, close the shift.", step=("Step 6", "Close the shift → English report"))
        await say_and_send(page, "Alexa, cierra el turno", "Alexa, close the shift", n_alexa=1)
        await overlay(page, None)
        top = await shot(page)
        await page.evaluate("document.getElementById('stage').scrollTop = 99999")
        await page.wait_for_timeout(150)
        bottom = await shot(page)
        await narrate(page, "Two tools run in a chain: the English shift report for the nurse, with vitals, doses and follow-ups, plus the family message.", images=[top, bottom])

        # 9. Closing
        c = await card(page, '<h1>Cuidadora<span>+</span></h1><h2>Speak Spanish. Hand off in English. Escalate safely.</h2><div class="bar"></div>'
                             '<p>Open source (MIT) · HTML/CSS/JS · Web Speech API · offline tool-router agent<br>'
                             'Optional Amazon Bedrock planner adapter</p>'
                             '<p><small>Built during the hackathon submission window by Ileana Guivas. Demo data only — fictional patients. Not medical advice. '
                             'Voices in this video are synthetic (text-to-speech).</small></p>')
        await narrate(page, "Cuidadora Plus: an assistant that speaks the caregiver's language. Open source. Demo data only, not medical advice.", images=[c])
        await browser.close()

    # ---- stitch with ffmpeg ----
    clips = []
    for i, s in enumerate(segments):
        if s["audio"]:
            dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", s["audio"]]).decode().strip())
        else:
            dur = 0
        total = max(dur + s["pad"], s["min"], 1.0)
        per = total / len(s["images"])
        lst = BUILD / f"seg{i:02d}.txt"
        with open(lst, "w") as f:
            for img in s["images"]:
                f.write(f"file '{img}'\nduration {per:.3f}\n")
            f.write(f"file '{s['images'][-1]}'\n")
        out = BUILD / f"seg{i:02d}.mp4"
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst)]
        if s["audio"]:
            cmd += ["-i", s["audio"], "-filter_complex", f"[1:a]apad,atrim=0:{total:.3f},aresample=44100[a]", "-map", "0:v", "-map", "[a]"]
        else:
            cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-map", "0:v", "-map", "1:a"]
        cmd += ["-t", f"{total:.3f}", "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p,fps=30", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                "-tune", "stillimage", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "44100", str(out)]
        subprocess.run(cmd, check=True)
        clips.append(out)
    lst = BUILD / "all.txt"
    lst.write_text("".join(f"file '{c}'\n" for c in clips))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(OUT)], check=True)
    print("wrote", OUT)


if __name__ == "__main__":
    asyncio.run(main())
