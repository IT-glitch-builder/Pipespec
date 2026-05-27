/* ai.js — PipeSpec AI assistant
   Adapted from Pipeline motor/Pipeline_Calculator_EN13480_Fixed.html
   Lines 3478–4216: full AI module
   Changes: removed ai-backdrop references; open/close now delegate to UI.openAI/closeAI;
   SYSTEM prompt kept verbatim; model-dropdown options kept as-is.
*/

const AI = (() => {
  const KEY_STORE = 'ew-ai-apikey';
  const API_URL   = 'https://api.anthropic.com/v1/messages';
  let _msgs        = [];
  let _attachments = [];
  let _attId       = 0;
  let _busy        = false;
  let _mc          = 0;

  const SYSTEM = `You are EdgeWay AI, the built-in AI assistant for PipeSpec — EdgeWay's pipeline dimensioning software. You were developed by EdgeWay as part of the PipeSpec platform. You are proactive, precise, and ALWAYS confirm data with the user before running calculations.

## IDENTITY — CRITICAL RULES:
- You are EdgeWay AI. Never say you are Claude, made by Anthropic, or built on any third-party AI.
- If asked who made you, what model you are, or what you are based on: answer only that you are EdgeWay AI, EdgeWay's own assistant built into PipeSpec.
- Never mention Anthropic, Claude, GPT, OpenAI, or any AI vendor under any circumstances.
- If pressed repeatedly, politely redirect: "Jeg er EdgeWay AI — lad mig hjælpe dig med din rørberegning."

## TWO-STEP WORKFLOW — MANDATORY:

### STEP 1: CONFIRM (status: "confirm")
When given a P&ID, drawing, or any request involving multiple pipes or sections:
- Extract all zones/conditions you can find
- List everything you found + everything you are unsure about
- Ask ALL needed questions upfront (flange type, material, DN range, etc.)
- NEVER run calculations in this step — always wait for user confirmation

### STEP 2: CALCULATE (status: "calculate")
Only after the user has confirmed the data and answered your questions:
- Return the complete sections array
- The calculator runs automatically and adds all results to the export queue

---

## RESPONSE FORMAT — return ONLY this JSON:

**Step 1 — Confirmation:**
{
  "status": "confirm",
  "new_project": null or "project name if requested",
  "found_sections": [
    { "name": "Rød zone", "pressure": 32.5, "temperature": 180, "material_suggestion": "1.4404", "dn_from": 15, "dn_to": 150 }
  ],
  "questions": [
    "question 1 text — be specific and give the user clear options to choose from",
    "question 2 text"
  ],
  "explanation": "Brief summary of what you found and what you need confirmed. In user's language."
}

**Step 2 — Calculate (after user confirms):**
{
  "status": "calculate",
  "new_project": null or "name",
  "sections": [
    {
      "name": "Sektion label",
      "fields": { "pressure": X, "temperature": Y, "matPreset": "...", "fluidType": "...", "jc": "...", "c0": X, "c2": X },
      "dn_from": 15,
      "dn_to": 150,
      "include_flanges": false,
      "flange_type": "11"
    }
  ],
  "explanation": "Starting calculations..."
}

---

## AVAILABLE FIELDS (inside sections[].fields):
pressure: bar — REQUIRED
temperature: °C — REQUIRED
fluidType: "gas1" (flammable/toxic gas), "gas2" (steam/air/N₂ — non-hazardous), "liq1" (hazardous liquid), "liq2" (water/glycol/oil — non-hazardous)
matPreset: Carbon: "P235GH","P265GH","P355GH","P355NH" | Austenitic SS: "1.4301"(304),"1.4306"(304L),"1.4401"(316),"1.4404"(316L),"1.4406","1.4429","1.4571"(316Ti),"1.4541"(321) | Duplex: "1.4462"(2205)
c0: mill tolerance mm — NEVER guess or use a default. ALWAYS ask the user. Typical options: 0 mm (ingen), 0.3 mm, 0.5 mm (rustfrit stål), 0.8 mm (kulstofstål), 1.0 mm. Omit this field entirely if the user has not answered.
c2: corrosion allowance mm — NEVER guess or use a default. ALWAYS ask the user. Typical options: 0 mm (rent vand/damp/SS), 0.5 mm, 1.0 mm, 1.5 mm, 2.0 mm, 3.0 mm. Omit this field entirely if the user has not answered.
jc: "1.0" (seamless or full NDT), "0.85" (random NDT), "0.7" (visual only)

## FLANGE TYPES — ALWAYS ASK BEFORE INCLUDING FLANGES:
flange_type values:
- "11" = Svejsehals — alle DN, alle PN-klasser (PN6–PN250). Standard valg.
- "01" = Plan/blind — alle DN, alle PN-klasser (PN6–PN250).
- "13" = Gevind BSP — DN10–DN150 KUN, MAX PN100 CLASS (DS/EN 1092-1:2018 Table 7j). Ikke anbefalet til damp eller høje temperaturer — brug Type 11.

PN-klassen beregnes automatisk fra tryk + temperatur — du behøver ikke angive den.
The calculator checks PN6, PN10, PN16, PN25, PN40, PN63, PN100, PN160, PN250 automatically.

CRITICAL — TYPE 13 PN LIMIT EXPLAINED:
"MAX PN100" means the HIGHEST PN CLASS available for Type 13 is PN100. It does NOT mean the pressure rating is 100 bar.
The actual PS_max at temperature is MUCH LOWER than the nominal PN number — for example:
- 316 SS (1.4401) PN100 at 160°C ≈ 82 bar → 41.8 bar is fine with PN100
- The PN class is determined by what ps_max(T) ≥ pc_bar — the calculator does this automatically
- NEVER reject Type 13 just because pc_bar is close to the PN number. The PN number is NOT the bar limit.
- Only reject Type 13 if: DN > 150 OR if pc_bar at the operating temperature would require PN160 or higher.
- To check: if pc_bar < ~75–85 bar at T ≤ 200°C for SS materials, PN100 Type 13 is almost certainly fine.

When flanges requested without specifying type, ask ONE short question:
"Flangetype? • Type 11 Svejsehals (standard, alle PN) • Type 01 Plan/blind (alle PN) • Type 13 Gevind (DN10–DN150, max PN100)"

NEVER write "max PN40" without specifying it only applies to Type 13.

## DN RANGE:
Available DN values: 6, 8, 10, 15, 20, 25, 32, 40, 50, 65, 80, 90, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 750, 900
dn_from and dn_to must be values from this list.

---

## READING P&ID DIAGRAMS — EXACT PROCEDURE:

Step 1 — COUNT ZONES: Identify every distinct colored background area. Each color = one zone. Count them all.

Step 2 — READ EACH BOX INDIVIDUALLY: For each zone, find its operating condition box. Read Temperature AND Pressure from that specific box. Do NOT copy values from another zone.

Step 3 — VERIFY: Two zones may share the same pressure (e.g. 20 bar) but must have different temperatures. If you find identical T+P for two different colored zones, re-read — you have made an error.

Step 4 — FLAG UNCERTAINTY: If a zone has no visible condition box, or if the text is too small to read clearly, list it in questions and ask the user.

CRITICAL: Never assign a temperature you read from one zone to a different zone.

---

## MATERIAL SELECTION GUIDE:
- Steam/condensate T ≤ 250°C: P265GH (carbon steel, cost-effective)
- Steam T 250–400°C: P355GH or P355NH
- Corrosive media or food/pharma: 1.4404 (316L) — most common SS choice
- High temperature + stainless (T > 200°C): 1.4401 or 1.4404
- Aggressive corrosion: 1.4462 (duplex 2205)
- When unsure: ask the user or suggest 1.4404 as safe default

---

## FLUID TYPE — DETERMINE AUTOMATICALLY, NEVER ASK:
Use steam saturation curve to auto-determine fluidType from pressure + temperature:
6 bar→159°C, 10 bar→180°C, 13 bar→191°C, 16 bar→201°C, 20 bar→212°C, 25 bar→224°C, 32.5 bar→237°C, 40 bar→250°C, 63 bar→278°C

Rule: if T < Tsat(p) → hot pressurised water → "liq2". If T ≥ Tsat(p) → steam → "gas2".
Only ask if media is clearly NOT water/steam (cooling fluid, CO₂, chemicals, oil). Note your determination in found_sections as a brief remark — do NOT add it as a question.

## MANDATORY QUESTIONS — always ask these in the confirm step, every time, no exceptions:
1. c0 (fabrikationstolerance): "Fabrikationstolerance (c₀)? • 0 mm • 0.3 mm • 0.5 mm (SS standard) • 0.8 mm (kulstofstål) • 1.0 mm"
2. c2 (korrosionsallowance): "Korrosionsallowance (c₂)? • 0 mm (ren vand/damp/SS) • 0.5 mm • 1.0 mm • 1.5 mm • 2.0 mm"
NEVER omit these two questions. NEVER set c0 or c2 yourself. If the user answers with a number (e.g. "0 vand"), parse "0" as c0=0 AND c2=0.

## STANDARD COMPLIANCE WARNINGS — mandatory when user deviates from normative requirements:
When the user's chosen values deviate from what the applicable standard requires or recommends, you MUST inform them clearly in the explanation field of the calculate response — but still use their chosen value. Never override the user's decision; only flag it.

Standard requirements to enforce as warnings:

**c0 — Fabrikationstolerance (EN 10216 / EN 13480-3 §4.3):**
- Seamless carbon steel tubes (EN 10216-1/-2): minimum c0 = 12.5% of nominal wall thickness, or fixed equivalent. If user selects 0 mm for a carbon steel material → WARN: "⚠ EN 10216-2 kræver min. 12,5 % fabrikationstolerance for sømløse kulstofstålrør — c₀ = 0 mm er under normkravet."
- Seamless SS tubes (EN 10216-5, Class T1): minimum c0 = 12.5% or 0.6 mm (hot-finished), or 10% / 0.2 mm (cold-finished). If user selects 0 mm for SS → WARN: "⚠ EN 10216-5 kræver min. fabrikationstolerance for sømløse SS-rør — c₀ = 0 mm er under normkravet. Typisk 0.5–0.8 mm afhængig af dimension."
- If user selects a value LOWER than the standard minimum → always warn, but proceed.
- If user selects the correct value or higher → no warning needed.

**jc — Samlingsfaktor (EN 13480-3 §4.5.3 Tabel 4.5-1):**
- jc = 1.0 requires: seamless pipe OR full volumetric NDT of all welds. If material/context suggests welded pipe with jc=1.0, warn: "⚠ jc = 1,0 kræver sømløst rør eller 100% NDT af alle samlinger — bekræft at dette er opfyldt."
- jc = 0.85 requires: random NDT (stikprøve). Fine for standard industrial use.
- jc = 0.7: visual inspection only — acceptable but conservative result.

**c2 — Korrosionsallowance (EN 13480-3 §4.3):**
- For carbon steel in water service: industry norm is minimum 1.0–2.0 mm. If user selects 0 mm for carbon steel in water → WARN: "⚠ c₂ = 0 mm er ualmindeligt for kulstofstål i vandservice — typisk anbefales min. 1,0–2,0 mm korrosionsallowance."
- For stainless steel in clean water/steam: 0 mm is fully acceptable — no warning.
- For aggressive media (acids, chlorides): warn if c2 < 1.0 mm.

**General rule:** In the explanation field of the calculate response, list ALL warnings compactly. Example: "Kører beregning — ⚠ c₀ = 0 mm er under EN 10216-2 normkravet på 12,5 %. Brugerdefineret værdi bruges."

## QUESTION STYLE — CRITICAL:
Questions must be SHORT — max 1 line each. Always give concrete options inline. NO long explanations.
Good: "Flangetype? • Type 11 Svejsehals (standard) • Type 01 Plan/blind • Type 13 Gevind (DN10–DN150, max PN100)"
Bad: "Medie? •..." — never ask about media for water/steam systems.

explanation field: MAX 1 sentence. Example: "Fandt 4 zoner — bekræft data og svar på spørgsmålene."

## NAMING CONVENTIONS — ALWAYS USE THESE FORMATS:
Materials: always write EN number + AISI/common name in parentheses:
  1.4301 → "1.4301 (AISI 304)"
  1.4306 → "1.4306 (AISI 304L)"
  1.4401 → "1.4401 (AISI 316)"
  1.4404 → "1.4404 (AISI 316L)"
  1.4571 → "1.4571 (AISI 316Ti)"
  1.4541 → "1.4541 (AISI 321)"
  1.4462 → "1.4462 (Duplex 2205)"
  P265GH → "P265GH" (no alias needed)
  P355GH → "P355GH"

Calculation summary (explanation after calculate): compact single line.

## RULES:
- ALWAYS use status:"confirm" first — NEVER go straight to status:"calculate" on first message
- Exception — go directly to status:"calculate" when: user says "ja", "kør", "bekræft", OR user's reply answers ALL open questions from the previous confirm card (even as a numbered list like "1. Ja 2. 316 3. DN125 4. 0.85 5. svejst")
- CRITICAL: After the user answers your questions, NEVER issue another status:"confirm" with new questions. Count what you know: if pressure ✓, temperature ✓, material ✓, DN ✓, jc ✓ → proceed to calculate immediately.
- NEVER ask follow-up questions about flange type if the user already told you (e.g. "svejst" = Type 11 Svejsehals, "plan" = Type 01, "gevind" = Type 13). Resolve it yourself and proceed.
- ONE confirm round max per request. If you still need something after the user's answer, pick the most reasonable default and proceed — do not ask again.
- CRITICAL — QUESTION DETECTION: If the user's message contains a "?" or words like "hvad", "hvad betyder", "forklar", "what", "explain" → the user is ASKING A QUESTION, not answering yours. Respond with a plain text explanation (status:"confirm" with questions repeated, or a direct answer). NEVER treat a message containing "?" as a confirmation to calculate.
- new_project: ALWAYS null unless user explicitly writes "opret nyt projekt" or "new project". NEVER auto-name from P&ID titles, drawing numbers or file names.
- Respond in the same language as the user (Danish if they write Danish)`;

  function open() {
    document.getElementById('ai-panel').classList.add('open');
    document.querySelector('.ai-open-btn')?.classList.add('on');
    setTimeout(() => { const t = document.getElementById('ai-input'); if (t) t.focus(); }, 250);
  }

  function close() {
    document.getElementById('ai-panel').classList.remove('open');
    document.querySelector('.ai-open-btn')?.classList.remove('on');
  }

  function saveKey(key) {
    key = (key || '').trim();
    if (!key) return;
    localStorage.setItem(KEY_STORE, key);
    const inp = document.getElementById('ai-apikey-input');
    if (inp) inp.value = '';
    _refreshKeyUI();
    _bubble('system', 'API-nøgle gemt.');
  }

  function _key() {
    if (typeof PIPESPEC_CONFIG !== 'undefined' && PIPESPEC_CONFIG.apiKey && !PIPESPEC_CONFIG.apiKey.startsWith('DIN-')) return PIPESPEC_CONFIG.apiKey;
    return localStorage.getItem(KEY_STORE) || '';
  }
  function _keySource() {
    if (typeof PIPESPEC_CONFIG !== 'undefined' && PIPESPEC_CONFIG.apiKey && !PIPESPEC_CONFIG.apiKey.startsWith('DIN-')) return 'file';
    return localStorage.getItem(KEY_STORE) ? 'local' : 'none';
  }
  // Auto-select model based on what the user is sending:
  // • Any image/PDF attachment → Opus 4.7 (best vision + long-context reasoning)
  // • Multi-word / multi-sentence text without attachments → Sonnet 4.6 (complex analysis)
  // • Short simple queries (≤ ~12 words, no special chars) → Haiku 4.5 (fast + cheap)
  function _pickModel(textContent, attachments) {
    const hasImage = attachments.some(a => a.kind === 'image');
    const hasPdf   = attachments.some(a => a.kind === 'pdf');
    if (hasImage || hasPdf) return { id: 'claude-opus-4-7', label: 'Opus', cls: 'opus' };
    const words = (textContent || '').trim().split(/\s+/).filter(Boolean).length;
    const isShort = words <= 12 && !/[.\n]/.test((textContent || '').trim());
    if (isShort) return { id: 'claude-haiku-4-5-20251001', label: 'Haiku', cls: 'haiku' };
    return { id: 'claude-sonnet-4-6', label: 'Sonnet', cls: 'sonnet' };
  }

  function _updateModelPill(cls, label) {
    const pill = document.getElementById('ai-model-pill');
    const lbl  = document.getElementById('ai-model-pill-label');
    if (!pill) return;
    pill.className = 'ai-model-pill ' + (cls || 'sonnet');
    if (lbl) lbl.textContent = label || 'Sonnet';
  }

  function _refreshKeyUI() {
    const el  = document.getElementById('ai-key-status');
    const src = _keySource();
    if (!el) return;
    if (src === 'file') {
      el.textContent = 'config.js ✓'; el.style.color = 'var(--ok)';
      const row = document.getElementById('ai-key-row');
      if (row) row.style.display = 'none';
    } else if (src === 'local') {
      el.textContent = 'Nøgle gemt ✓'; el.style.color = 'var(--ok)';
    } else {
      el.textContent = 'Ingen nøgle'; el.style.color = 'var(--warn)';
    }
  }

  let _chatLog = [];
  const MAX_LOG = 300;

  function _bubble(role, text, imgSrc) {
    const id = 'aim' + (++_mc);
    _chatLog.push({ role, text: (text || '').slice(0, 3000), hasImage: !!imgSrc, ts: Date.now() });
    if (_chatLog.length > MAX_LOG) _chatLog.splice(0, _chatLog.length - MAX_LOG);
    _renderBubble({ role, text, imgSrc }, id);
    const box = document.getElementById('ai-messages');
    if (box) box.scrollTop = box.scrollHeight;
    return id;
  }

  function _renderBubble(entry, id) {
    const box = document.getElementById('ai-messages'); if (!box) return;
    const d = document.createElement('div');
    if (id) d.id = id;
    d.className = 'ai-msg ai-msg-' + entry.role;
    if (entry.imgSrc) {
      const img = document.createElement('img');
      img.src = entry.imgSrc; img.style.cssText = 'max-width:100%;border-radius:6px;margin-bottom:6px;display:block';
      d.appendChild(img);
    } else if (entry.hasImage) {
      const ph = document.createElement('div');
      ph.style.cssText = 'background:var(--card-2);border-radius:4px;padding:4px 8px;font-size:10px;color:var(--text-3);margin-bottom:5px;font-family:var(--mono)';
      ph.textContent = '📎 [Fil vedhæftet]'; d.appendChild(ph);
    }
    const sp = document.createElement('span'); sp.textContent = entry.text || ''; d.appendChild(sp);
    box.appendChild(d);
  }

  function _setText(id, text) {
    const el = document.getElementById(id); if (!el) return;
    const sp = el.querySelector('span'); if (sp) sp.textContent = text;
    for (let i = _chatLog.length - 1; i >= 0; i--) {
      if (_chatLog[i].role === 'assistant') { _chatLog[i].text = (text || '').slice(0, 3000); break; }
    }
  }

  function _saveChat() {
    if (!window.PM || !PM.activeId || !PM.projects[PM.activeId]) return;
    try { PM.projects[PM.activeId].chatLog = _chatLog.slice(); PM.projects[PM.activeId].chatMsgs = _msgs.slice(); } catch(e) { console.warn('AI._saveChat:', e); }
  }

  function _loadChat(id) {
    const proj = window.PM && PM.projects[id];
    _msgs    = Array.isArray(proj?.chatMsgs) ? proj.chatMsgs : [];
    _chatLog = Array.isArray(proj?.chatLog)  ? proj.chatLog  : [];
    const box = document.getElementById('ai-messages'); if (!box) return;
    box.innerHTML = '';
    if (_chatLog.length === 0) { _showWelcome(); } else { _chatLog.forEach(e => _renderBubble(e)); box.scrollTop = box.scrollHeight; }
  }

  function _showWelcome() {
    _bubble('system', 'Hej! Upload P&ID-billeder, PDF-tegninger eller skriv rørdata direkte. Jeg udfylder beregneren og tilføjer alle resultater til eksportkøen automatisk.');
  }

  async function send() {
    if (_busy) return;
    const inp  = document.getElementById('ai-input');
    const text = inp ? inp.value.trim() : '';
    if (!text && _attachments.length === 0) return;
    const apiKey = _key();
    if (!apiKey) { _bubble('system', 'Tilføj en Claude API-nøgle i feltet øverst og tryk Gem.'); return; }

    const parts = [];
    for (const att of _attachments) {
      if (att.kind === 'image') parts.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.b64 } });
      else if (att.kind === 'pdf') parts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.b64 }, title: att.name });
      else if (att.kind === 'text') parts.push({ type: 'text', text: '[Fil: ' + att.name + ']\n' + att.content });
    }
    if (text) parts.push({ type: 'text', text });

    const firstImg = _attachments.find(a => a.kind === 'image');
    const attLabel = _attachments.length ? '(' + _attachments.length + ' fil' + (_attachments.length > 1 ? 'er' : '') + ' vedhæftet) ' : '';
    const chosen = _pickModel(text, _attachments);
    _bubble('user', attLabel + (text || ''), firstImg ? firstImg.preview : null);
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }
    _attachments = []; _renderAttachBar();

    _msgs.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? text : parts });
    _busy = true;
    const btn = document.getElementById('ai-send-btn'); if (btn) btn.disabled = true;
    const loadId = _bubble('assistant', '…');

    _updateModelPill(chosen.cls, chosen.label);

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: chosen.id, max_tokens: 4096, system: SYSTEM, messages: _msgs })
      });
      if (!resp.ok) { let em = 'HTTP ' + resp.status; try { const j = await resp.json(); em = j.error?.message || em; } catch(e) {} throw new Error(em); }
      const data  = await resp.json();
      const reply = data.content?.[0]?.text || '';
      _msgs.push({ role: 'assistant', content: reply });

      const applied = _tryApply(reply);
      if (applied.status === 'confirm' || applied.status === '_error') {
        const loadEl = document.getElementById(loadId); if (loadEl) loadEl.remove();
        _chatLog = _chatLog.filter(e => e.text !== '…');
      } else if (applied.status === 'text') {
        _setText(loadId, applied.explanation || reply);
      } else {
        _setText(loadId, applied.explanation || (reply.length < 300 ? reply : ''));
      }
    } catch(e) {
      _setText(loadId, 'Fejl: ' + e.message);
      console.error('AI.send:', e);
    } finally {
      _busy = false; if (btn) btn.disabled = false;
    }
  }

  function _tryApply(text) {
    const stripped = text.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();
    const m = stripped.match(/\{[\s\S]*\}/) || text.match(/\{[\s\S]*\}/);
    if (!m) return { status: 'text', explanation: text };
    let data;
    try { data = JSON.parse(m[0]); } catch(e) {
      _bubble('system', 'Svaret blev for langt og afskåret. Prøv at opdele i færre sektioner ad gangen, eller skriv sektionerne manuelt.');
      return { status: '_error' };
    }
    if (data.status === 'confirm') {
      _renderConfirmCard(data);
    } else if (data.status === 'calculate' || Array.isArray(data.sections)) {
      if (data.new_project) { PM.createProject(data.new_project); setTimeout(() => _bubble('system', 'Nyt projekt oprettet: "' + data.new_project + '"'), 60); }
      if (Array.isArray(data.sections) && data.sections.length > 0) setTimeout(() => _runSections(data.sections), 150);
    } else if (data.fields && Object.keys(data.fields).length > 0) {
      _applyFields(data.fields);
      const n = Object.keys(data.fields).length;
      setTimeout(() => _bubble('system', n + ' felt' + (n > 1 ? 'er' : '') + ' udfyldt.'), 120);
    }
    return data;
  }

  function _renderConfirmCard(data) {
    const box = document.getElementById('ai-messages'); if (!box) return;
    const id = 'aim' + (++_mc);
    const sections = data.found_sections || [];
    const tblRows  = sections.map(s =>
      '<tr><td>'+(s.name||'—')+'</td><td>'+(s.pressure!=null?s.pressure+' bar':'?')+'</td><td>'+(s.temperature!=null?s.temperature+'°C':'?')+'</td><td>'+(s.material_suggestion||'?')+'</td><td>'+(s.dn_from!=null?'DN'+s.dn_from+'–DN'+s.dn_to:'?')+'</td></tr>'
    ).join('');
    const qs = (data.questions || []).map((q, i) => '<div class="ai-confirm-q"><strong>' + (i+1) + '.</strong> ' + q.replace(/\n/g,'<br>') + '</div>').join('');
    const html =
      '<div class="ai-confirm" id="'+id+'">'
      +'<div class="ai-confirm-title">Fandt '+sections.length+' sektion'+(sections.length!==1?'er':'')+'  — bekræft</div>'
      +(tblRows?'<table class="ai-confirm-tbl"><thead><tr><th>Zone</th><th>Tryk</th><th>Temp.</th><th>Materiale</th><th>DN</th></tr></thead><tbody>'+tblRows+'</tbody></table>':'')
      +(qs?'<div class="ai-confirm-qs"><div class="ai-confirm-qs-title">Spørgsmål</div>'+qs+'</div>':'')
      +'<div class="ai-confirm-hint">Skriv "ja" + svar på spørgsmålene for at starte beregningerne.</div>'
      +'</div>';
    const wrap = document.createElement('div'); wrap.innerHTML = html;
    box.appendChild(wrap.firstChild); box.scrollTop = box.scrollHeight;
    const logText = (data.explanation || '')
      + (sections.length?'\n\nFundne sektioner:\n'+sections.map(s=>'• '+s.name+': '+s.pressure+' bar / '+s.temperature+'°C').join('\n'):'')
      + (data.questions?.length?'\n\nSpørgsmål:\n'+data.questions.map((q,i)=>(i+1)+'. '+q).join('\n'):'');
    _chatLog.push({ role: 'assistant', text: logText.slice(0,3000), hasImage: false, ts: Date.now() });
  }

  function _runSections(sections) {
    let totalAdded = 0;
    const errors = [];
    // If user loaded a queue item for editing, AI should update it — not add new entries
    const editIdx = (typeof _ACTIVE_QUEUE_IDX !== 'undefined' && _ACTIVE_QUEUE_IDX !== null) ? _ACTIVE_QUEUE_IDX : null;
    const preExisting = typeof REPORT_LIST !== 'undefined' ? REPORT_LIST.length : 0;
    for (const sec of sections) {
      if (sec.fields) _applyFields(sec.fields);
      const dnFrom = sec.dn_from != null ? sec.dn_from : 15;
      const dnTo   = sec.dn_to   != null ? sec.dn_to   : 150;
      const fromEl   = document.getElementById('batchDnFrom');
      const toEl     = document.getElementById('batchDnTo');
      const flangeEl = document.getElementById('batchFlangeEnabled');
      // Never touch the batch UI toggle — AI uses batch internals silently
      if (fromEl) fromEl.value = dnFrom;
      if (toEl)   toEl.value   = dnTo;
      if (flangeEl) flangeEl.checked = !!sec.include_flanges;
      if (sec.include_flanges && sec.flange_type) { const flTypeEl = document.getElementById('fl_type'); if (flTypeEl) flTypeEl.value = sec.flange_type; }
      try {
        const inp = (typeof _batchReadCommonInputs === 'function') ? _batchReadCommonInputs() : null;
        if (!inp) { errors.push(sec.name || 'Sektion'); continue; }
        const pipes = (typeof PIPES !== 'undefined') ? PIPES.filter(p => p.dn >= dnFrom && p.dn <= dnTo) : [];
        if (!pipes.length) { errors.push((sec.name||'Sektion') + ' (ingen rør fundet)'); continue; }
        const prefix = sec.name ? '[' + sec.name + '] ' : '';
        let skipped = 0;
        for (const pipeObj of pipes) {
          const r = _batchCalcOnePipe(pipeObj, inp);
          r._batchLabel = prefix + 'DN' + r.DN + ' / ' + r.pc_bar.toFixed(1) + ' bar / ' + r.tc + '°C [AI]';
          const formState = window.PM ? PM._captureForm() : {};
          if (editIdx !== null && pipes.length === 1) {
            // Single-DN edit: overwrite the active queue slot
            REPORT_LIST[editIdx] = { ...r, label: r._batchLabel, _formState: formState };
            totalAdded++;
          } else {
            const isDupPipe = REPORT_LIST.slice(0, preExisting).some(x => !x.type && x.DN === r.DN && Math.abs((x.pc_bar||0)-r.pc_bar)<0.05 && Math.abs((x.tc||0)-r.tc)<0.5);
            if (isDupPipe) { skipped++; } else { REPORT_LIST.push({ ...r, label: r._batchLabel, _formState: formState }); totalAdded++; }
          }
          if (sec.include_flanges && typeof _batchCalcOneFlange === 'function') {
            const fl = _batchCalcOneFlange(pipeObj.dn);
            if (fl) {
              fl._batchLabel = prefix + 'Flange DN' + fl.actualDN + ' / PN' + (fl.selectedPN||'?') + ' — ' + fl.pc_bar.toFixed(1) + ' bar / ' + fl.T + '°C [AI]';
              if (editIdx !== null && pipes.length === 1) {
                // For edit mode: find and overwrite the associated flange entry if it exists
                const flangeIdx = REPORT_LIST.findIndex((x, xi) => xi > editIdx && x.type === 'flange');
                if (flangeIdx !== -1) { REPORT_LIST[flangeIdx] = { ...fl, label: fl._batchLabel, type: 'flange' }; }
                else { REPORT_LIST.splice(editIdx + 1, 0, { ...fl, label: fl._batchLabel, type: 'flange' }); }
              } else {
                const isDupFlange = REPORT_LIST.slice(0, preExisting).some(x => x.type==='flange' && x.actualDN===fl.actualDN && Math.abs((x.pc_bar||0)-fl.pc_bar)<0.05 && Math.abs((x.T||0)-fl.T)<0.5);
                if (!isDupFlange) { REPORT_LIST.push({ ...fl, label: fl._batchLabel, type: 'flange' }); totalAdded++; } else { skipped++; }
              }
            }
          }
        }
        if (skipped > 0) setTimeout(() => _bubble('system', skipped + ' post allerede i kø sprunget over.'), 80);
      } catch(e) { errors.push((sec.name||'Sektion') + ': ' + e.message); console.error('_runSections error:', e); }
    }
    if (editIdx !== null && totalAdded > 0) {
      if (typeof _ACTIVE_QUEUE_IDX !== 'undefined') _ACTIVE_QUEUE_IDX = null;
    }
    if (typeof renderReportList === 'function') renderReportList();
    if (window.PM) PM.saveCurrentState();
    if (totalAdded > 0) {
      const msg = editIdx !== null
        ? 'Beregning opdateret i eksportkøen ✓'
        : totalAdded + ' beregninger tilføjet til eksportkøen. Klik "Export Report" øverst for at generere rapporten.';
      _bubble('system', msg);
    }
    if (errors.length) _bubble('system', 'Fejl i: ' + errors.join(', '));
  }

  function _applyFields(fields) {
    if (fields.inputMethod) { const el = document.getElementById('inputMethod'); if (el) el.value = fields.inputMethod; }
    if (typeof toggleMethod === 'function') toggleMethod();
    if (fields.matPreset) { const el = document.getElementById('matPreset'); if (el) el.value = fields.matPreset; if (typeof applyPreset === 'function') applyPreset(); }
    const done = new Set(['inputMethod', 'matPreset']);
    Object.entries(fields).forEach(([id, val]) => {
      if (done.has(id)) return;
      const el = document.getElementById(id); if (!el) return;
      el.value = String(val);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input',  { bubbles: true }));
    });
    if (typeof toggleSteelRows   === 'function') toggleSteelRows();
    if (typeof recomputeF        === 'function') recomputeF();
    if (typeof updateWaterPhase  === 'function') updateWaterPhase();
    if (typeof toggleCatOverride === 'function') toggleCatOverride();
    if (typeof toggleC1          === 'function') toggleC1();
    setTimeout(() => { if (window.PM) PM.saveCurrentState(); }, 300);
  }

  function openFilePicker() { const fi = document.getElementById('ai-file-input'); if (fi) fi.click(); }

  function handleFileUpload(file) {
    if (!file) return;
    const ext  = file.name.split('.').pop().toLowerCase();
    const type = file.type;
    if (ext === 'doc' || ext === 'docx') { _bubble('system', 'Word-filer understøttes ikke direkte. Gem dokumentet som PDF og upload det i stedet.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      const b64    = result.split(',')[1];
      const id     = 'att' + (++_attId);
      if (type.startsWith('image/')) { _attachments.push({ id, kind: 'image', name: file.name, b64, mediaType: type, preview: result }); }
      else if (type === 'application/pdf' || ext === 'pdf') { _attachments.push({ id, kind: 'pdf', name: file.name, b64, mediaType: 'application/pdf' }); }
      else if (type.startsWith('text/') || ext === 'txt' || ext === 'csv') { _attachments.push({ id, kind: 'text', name: file.name, content: atob(b64) }); }
      else { _bubble('system', '"' + file.name + '" — filtypen understøttes ikke. Brug billeder (PNG/JPG/WebP), PDF eller tekstfiler.'); return; }
      _renderAttachBar();
    };
    reader.readAsDataURL(file);
  }

  function removeFile(id) { _attachments = _attachments.filter(a => a.id !== id); _renderAttachBar(); }
  function clearImage()   { _attachments = []; _renderAttachBar(); }

  function _renderAttachBar() {
    const bar = document.getElementById('ai-attach-bar'); if (!bar) return;
    if (_attachments.length === 0) { bar.style.display = 'none'; bar.innerHTML = ''; }
    else { bar.style.display = 'flex'; }
    // Update pill to reflect current attachments
    const text = (document.getElementById('ai-input') || {}).value || '';
    const m = _pickModel(text, _attachments);
    _updateModelPill(m.cls, m.label);
    if (_attachments.length === 0) { bar.innerHTML = ''; return; }
    bar.innerHTML = _attachments.map(att => {
      const icon  = att.kind === 'pdf' ? '📄' : att.kind === 'text' ? '📝' : '';
      const thumb = att.kind === 'image' ? '<img class="ai-chip-thumb" src="' + att.preview + '" alt="">' : '<div class="ai-chip-ico">' + icon + '</div>';
      const typeLabel = att.kind === 'pdf' ? 'PDF' : att.kind === 'text' ? 'TXT' : 'Billede';
      return '<div class="ai-chip" id="' + att.id + '">' + thumb
        + '<div class="ai-chip-info"><span class="ai-chip-name">' + att.name + '</span><span class="ai-chip-type">' + typeLabel + '</span></div>'
        + '<button class="ai-chip-rm" onclick="AI.removeFile(\'' + att.id + '\')" title="Fjern">×</button></div>';
    }).join('');
  }

  function clearChat() {
    _msgs = []; _chatLog = [];
    const box = document.getElementById('ai-messages'); if (box) box.innerHTML = '';
    _showWelcome(); _saveChat();
  }

  function _initResize() {
    const handle = document.getElementById('ai-resize-handle');
    const panel  = document.getElementById('ai-panel');
    if (!handle || !panel) return;
    let dragging = false;
    handle.addEventListener('mousedown', e => { dragging = true; handle.classList.add('dragging'); document.body.style.cssText += ';cursor:ew-resize!important;user-select:none!important'; e.preventDefault(); });
    document.addEventListener('mousemove', e => { if (!dragging) return; const w = Math.max(340, Math.min(window.innerWidth - e.clientX, Math.floor(window.innerWidth * 0.88))); panel.style.width = w + 'px'; panel.style.transition = 'none'; });
    document.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; handle.classList.remove('dragging'); document.body.style.cursor = ''; document.body.style.userSelect = ''; panel.style.transition = ''; });
    panel.addEventListener('dragover', e => { e.preventDefault(); panel.style.outline = '2px dashed var(--acc)'; });
    panel.addEventListener('dragleave', () => { panel.style.outline = ''; });
    panel.addEventListener('drop', e => { e.preventDefault(); panel.style.outline = ''; Array.from(e.dataTransfer.files).forEach(f => handleFileUpload(f)); });
  }

  function _initInputResize() {
    const handle    = document.getElementById('ai-inp-resize');
    const inputArea = document.getElementById('ai-input-area');
    if (!handle || !inputArea) return;
    let dragging = false, startY = 0, startH = 0;
    handle.addEventListener('mousedown', e => { dragging = true; startY = e.clientY; startH = inputArea.offsetHeight; handle.classList.add('dragging'); document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); });
    document.addEventListener('mousemove', e => { if (!dragging) return; const newH = Math.max(90, Math.min(startH + (startY - e.clientY), 500)); inputArea.style.height = newH + 'px'; inputArea.style.flexShrink = '0'; });
    document.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; handle.classList.remove('dragging'); document.body.style.cursor = ''; document.body.style.userSelect = ''; });
  }

  function init() {
    _refreshKeyUI();
    _initResize();
    _initInputResize();
    _updateModelPill('sonnet', 'Sonnet');

    // Wire send button and file picker
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn && !sendBtn._aiWired) { sendBtn._aiWired = true; sendBtn.addEventListener('click', send); }
    const imgBtn = document.querySelector('.ai-img-btn');
    if (imgBtn && !imgBtn._aiWired) { imgBtn._aiWired = true; imgBtn.addEventListener('click', openFilePicker); }

    // Close settings drawer when clicking outside it
    document.addEventListener('mousedown', e => {
      const drawer = document.getElementById('ai-settings-drawer');
      if (drawer?.classList.contains('open') && !drawer.contains(e.target) && !e.target.closest('.ai-ph')) {
        drawer.classList.remove('open');
      }
    });

    // Update pill preview as user types / attaches files
    const inp = document.getElementById('ai-input');
    if (inp) {
      inp.addEventListener('input', () => {
        const text  = inp.value.trim();
        const m = _pickModel(text, _attachments);
        _updateModelPill(m.cls, m.label);
      });
    }

    // Clear static demo messages from HTML
    const box = document.getElementById('ai-messages');
    if (box) box.innerHTML = '';

    // Load history for current project or show welcome
    const activeId = window.PM && PM.activeId;
    if (activeId && PM.projects?.[activeId]?.chatLog?.length > 0) { _loadChat(activeId); } else { _showWelcome(); }
  }

  return { open, close, send, saveKey, openFilePicker, handleFileUpload, removeFile, clearImage, clearChat, init, _saveChat, _loadChat };
})();
window.AI = AI;
