/* engine.js — PipeSpec calculation engine
   PIPES og MATS er flyttet til materials.js (skal loades før denne fil).
*/

// ── INTERPOLATION ─────────────────────────────────────────────────────────────
function interpStrength(mat,tc){
  const td=mat.tempData;
  if(!td||!td.length)return null;
  if(tc<=td[0][0])return{Rp02:td[0][1],Rp10:td[0][2],Rm:td[0][3],t_used:td[0][0],interp:false,note:'T ≤ '+td[0][0]+'°C — using first table entry'};
  const last=td[td.length-1];
  if(tc>last[0])return{Rp02:null,Rp10:null,Rm:null,t_used:tc,interp:false,note:'T = '+tc+'°C exceeds max table temperature '+last[0]+'°C — no data'};
  const exact=td.find(r=>r[0]===tc);
  if(exact)return{Rp02:exact[1],Rp10:exact[2],Rm:exact[3],t_used:tc,interp:false,note:'T = '+tc+'°C — exact table value'};
  for(let i=0;i<td.length-1;i++){
    const[t1,rp02_1,rp10_1,rm1]=td[i],[t2,rp02_2,rp10_2,rm2]=td[i+1];
    if(tc>t1&&tc<t2){
      const k=(tc-t1)/(t2-t1),lerp=(a,b)=>(a!==null&&b!==null)?+(a+k*(b-a)).toFixed(1):null;
      return{Rp02:lerp(rp02_1,rp02_2),Rp10:lerp(rp10_1,rp10_2),Rm:lerp(rm1,rm2),
        t_low:t1,t_high:t2,ratio:k,t_used:tc,interp:true,
        Rp02_t_low:rp02_1,Rp10_t_low:rp10_1,Rm_t_low:rm1,
        Rp02_t_high:rp02_2,Rp10_t_high:rp10_2,Rm_t_high:rm2,
        note:'Linear interpolation between '+t1+'°C and '+t2+'°C (ratio='+(k*100).toFixed(1)+'%)'};
    }
  }
  return null;
}

function computeF_from_mat(mat,tc,sfRe,sfRm,aust522opt){
  const s=interpStrength(mat,tc);
  if(!s)return null;
  const steps=[],isAust=(mat.type==='austenitic');
  let f_re=null,f_rm=null,f=null,governs='';
  if(isAust){
    if(aust522opt==='opt1'){
      if(s.Rp10!==null){f_re=s.Rp10/1.5;steps.push('Option 1 (Eq. 5.2.2-1): f = Rp1,0t / 1,5 = '+s.Rp10+' / 1.5 = '+f_re.toFixed(2)+' MPa');}
      f=f_re;governs='Rp1,0t / 1.5';
    } else {
      if(s.Rp10!==null){f_re=s.Rp10/1.2;steps.push('Option 2 — Rp1,0t / 1,2 = '+s.Rp10+' / 1.2 = '+f_re.toFixed(2)+' MPa');}
      if(s.Rm!==null){f_rm=s.Rm/3.0;steps.push('Option 2 — Rm_t / 3 = '+s.Rm+' / 3.0 = '+f_rm.toFixed(2)+' MPa');}
      if(f_re!==null&&f_rm!==null){f=Math.min(f_re,f_rm);governs=f===f_re?'Rp1,0t / 1.2':'Rm_t / 3';}
      else if(f_re!==null){f=f_re;governs='Rp1,0t / 1.2 (Rm not available)';}
      else if(f_rm!==null){f=f_rm;governs='Rm_t / 3';}
    }
  } else {
    if(s.Rp02!==null){f_re=s.Rp02/sfRe;steps.push('f_ReH = Rp0.2t / '+sfRe+' = '+s.Rp02+' / '+sfRe+' = '+f_re.toFixed(2)+' MPa');}
    if(s.Rm!==null){f_rm=s.Rm/sfRm;steps.push('f_Rm = Rm_t / '+sfRm+' = '+s.Rm+' / '+sfRm+' = '+f_rm.toFixed(2)+' MPa');}
    if(f_re!==null&&f_rm!==null){f=Math.min(f_re,f_rm);governs=f===f_re?'Rp0.2t / '+sfRe:'Rm_t / '+sfRm;}
    else if(f_re!==null){f=f_re;governs='Rp0.2t / '+sfRe;}
    else if(f_rm!==null){f=f_rm;governs='Rm_t / '+sfRm;}
  }
  return{f:f?+(f.toFixed(2)):null,f_re,f_rm,governs,
    Rp02_t:s.Rp02,Rp10_t:s.Rp10,Rm_t:s.Rm,
    sfRe,sfRm,steps,interpNote:s.note,interpData:s,aust522opt};
}

// ── PED CATEGORY — PED 2014/68/EU Annex II ────────────────────────────────────
function pedClassify(fluid, PS, DN) {
  const psDN = PS * DN;
  let cat = 'Art 4,3';
  let annex2table = '—';
  const isGas = (fluid === 'gas1' || fluid === 'gas2');
  const isGroup1 = (fluid === 'gas1' || fluid === 'liq1');
  if (isGas) {
    annex2table = isGroup1 ? 'Annex II Tabel 6' : 'Annex II Tabel 7';
    if (isGroup1) {
      if (psDN > 3500 || PS > 200)       cat = 'III';
      else if (psDN > 1000 || PS > 50)   cat = 'II';
      else if (psDN > 350)               cat = 'I';
    } else {
      // PED Annex II Table 7 — Group 2 gases (steam, air, N₂)
      if (psDN > 3500)                   cat = 'III';
      else if (psDN > 2000 || PS > 10)   cat = 'II';
      else if (psDN > 1000)              cat = 'I';
    }
  } else {
    annex2table = isGroup1 ? 'Annex II Tabel 8' : 'Annex II Tabel 9';
    if (isGroup1) {
      if (psDN > 3500 || PS > 500)       cat = 'III';
      else if (psDN > 2000 || PS > 25)   cat = 'II';
      else if (psDN > 350 || PS > 10)    cat = 'I';
    } else {
      // PED Annex II Table 9 — Group 2 liquids (water, glycol, oil)
      // PED Art.4(1)(c)(ii): scope entry requires PS>10 AND DN>200 AND PS×DN>5000
      // PS>500 bar is always Category II minimum regardless of DN
      if (PS > 500 && psDN > 5000)                 cat = 'III';
      else if (psDN > 5000 || PS > 500)            cat = 'II';
      else if (PS > 10 && DN > 200 && psDN > 1000) cat = 'I';
    }
  }
  let kontrolklasse = (cat === 'III') ? 'B' : 'C';
  const catDesc = {
    'Art 4,3': 'Under klassificeringstærsklen — ingen CE-mærkning krævet (PED Art. 4 §3). God ingeniørpraksis skal overholdes. Kontrolklasse C (DK).',
    'I':       'Kategori I — lavest regulerede kategori. Intern produktionskontrol (Modul A). Producenten udsteder selv overensstemmelseserklæring (DoC). CE-mærkning krævet. Kontrolklasse C (DK).',
    'II':      'Kategori II — Notified Body (NB) involveret i produktionskontrol. Moduler: D1, E1, B+D, B+E eller B+F. CE-mærkning krævet. Kontrolklasse C (DK).',
    'III':     'Kategori III — skærpet NB-kontrol af design og produktion. Moduler: B+D, B+F, G eller H1. CE-mærkning krævet. Kontrolklasse B (DK).',
  };
  return { cat, psDN, annex2table, kontrolklasse, catDesc: catDesc[cat] || '' };
}

// ── WATER SATURATION TEMPERATURE (Antoine) ────────────────────────────────────
function waterSatTemp(P_bar) {
  const P_mmHg = P_bar * 750.062;
  return +(1810.94 / (8.14019 - Math.log10(P_mmHg)) - 244.485).toFixed(1);
}

function updateWaterPhase() {
  const P_bar = parseFloat(document.getElementById('pressure').value);
  const T_C   = parseFloat(document.getElementById('temperature').value);
  const fluid = document.getElementById('fluidType').value;
  const box   = document.getElementById('waterPhaseBox');
  const res   = document.getElementById('waterPhaseResult');
  const isLiq = (fluid === 'liq1' || fluid === 'liq2');
  if (!isLiq || !P_bar || isNaN(P_bar) || P_bar <= 0 || isNaN(T_C)) { box.style.display = 'none'; return; }
  box.style.display = '';
  const T_sat = waterSatTemp(P_bar);
  if (T_C < T_sat) {
    const margin = (T_sat - T_C).toFixed(1);
    res.innerHTML = 'T<sub>sat</sub> ved '+P_bar+' bar = <span style="color:#e8c56c">'+T_sat+' °C</span><br>'
      +'T<sub>design</sub> = '+T_C+' °C  →  <span style="color:#2ecc71;font-weight:bold">FLYDENDE VAND (subcooled liquid)</span><br>'
      +'<span style="color:var(--mute);font-size:10px">Margin til kogepunktet: '+margin+' °C  |  Brug Liquid Group 2</span>';
    box.style.borderLeftColor = '#27ae60';
  } else if (T_C === T_sat) {
    res.innerHTML = 'T<sub>sat</sub> ved '+P_bar+' bar = <span style="color:#e8c56c">'+T_sat+' °C</span><br>'
      +'T<sub>design</sub> = '+T_C+' °C  →  <span style="color:#f39c12;font-weight:bold">MÆTTET DAMP / KOGEPUNKT</span><br>'
      +'<span style="color:var(--mute);font-size:10px">Klassificér som Gas Group 2 (damp er ikke-farlig)</span>';
    box.style.borderLeftColor = '#f39c12';
  } else {
    const margin = (T_C - T_sat).toFixed(1);
    res.innerHTML = 'T<sub>sat</sub> ved '+P_bar+' bar = <span style="color:#e8c56c">'+T_sat+' °C</span><br>'
      +'T<sub>design</sub> = '+T_C+' °C  →  <span style="color:#e74c3c;font-weight:bold">DAMP (superheated steam)</span><br>'
      +'<span style="color:var(--mute);font-size:10px">'+margin+' °C over kogepunktet  |  Brug Gas Group 2</span>';
    box.style.borderLeftColor = '#e74c3c';
  }
}

function updatePedDisplay() {
  const el = document.getElementById('catAutoDisplay');
  if (!el || document.getElementById('catOverride')?.checked) return;
  const P_bar = parseFloat(document.getElementById('pressure')?.value);
  const fluid = document.getElementById('fluidType')?.value || 'gas2';
  const npsVal = document.getElementById('npsSelect')?.value;
  const pipeObj = npsVal ? PIPES.find(p => p.nps === npsVal) : null;
  const dn_input = parseFloat(document.getElementById('dn_input')?.value);
  const do_val = parseFloat(document.getElementById('man_od')?.value || document.getElementById('man_od_v')?.value);
  const DN = pipeObj ? pipeObj.dn : (dn_input > 0 ? dn_input : (do_val > 0 ? Math.round(do_val * 0.85) : null));
  const textEl = el.querySelector('.apple-select-text') || el;
  if (!P_bar || isNaN(P_bar) || P_bar <= 0 || !DN) {
    textEl.textContent = 'Auto fra DN × PS';
    return;
  }
  const ped = pedClassify(fluid, P_bar, DN);
  textEl.textContent = ped.cat;
}

// ── UI TOGGLE HELPERS ─────────────────────────────────────────────────────────
function toggleMethod() {
  const m = document.getElementById('inputMethod').value;
  document.getElementById('npsBlock').style.display  = m === 'nps'    ? '' : 'none';
  document.getElementById('odBlock').style.display   = m === 'od_only'? '' : 'none';
  document.getElementById('manBlock').style.display  = m === 'manual' ? '' : 'none';
}
function toggleCatOverride() {
  const on = document.getElementById('catOverride').checked;
  document.getElementById('catAutoDisplay').style.display  = on ? 'none' : '';
  document.getElementById('catManualSelect').style.display = on ? '' : 'none';
}
function toggleC1() {
  const t = document.getElementById('c1Type').value;
  document.getElementById('c1pRow').style.display = t === 'percent' ? '' : 'none';
  document.getElementById('c1fRow').style.display = t === 'fixed'   ? '' : 'none';
}
function toggleAust522() {
  const opt   = document.getElementById('aust522opt').value;
  const desc  = document.getElementById('aust522desc');
  const sfRe  = document.getElementById('sf_re');
  const sfRm  = document.getElementById('sf_rm');
  const sfNote= document.getElementById('sf_note');
  if (opt === 'opt1') {
    if(desc)  desc.textContent = 'Option 1: f = Rp1,0t / 1,5. Rmᵢ not required per this option.';
    if(sfRe)  sfRe.value = '1.5';
    if(sfRm) { sfRm.value = '3.0'; sfRm.style.opacity = '0.4'; sfRm.style.pointerEvents = 'none'; }
    if(sfNote) sfNote.innerHTML = '§5.2.2 Opt.1: <span style="color:var(--info)">Rp1,0t÷1.5</span> — Rm_t not used';
  } else {
    if(desc)  desc.textContent = 'Option 2: f = min(Rp1,0t / 1,2 , Rm_t / 3). Both values required.';
    if(sfRe)  sfRe.value = '1.2';
    if(sfRm) { sfRm.value = '3.0'; sfRm.style.opacity = '1'; sfRm.style.pointerEvents = 'auto'; }
    if(sfNote) sfNote.innerHTML = '§5.2.2 Opt.2: <span style="color:var(--info)">Rp1,0t÷1.2</span> &amp; <span style="color:var(--info)">Rm_t÷3.0</span> — f = min of both';
  }
  recomputeF();
}
function toggleSteelRows() {
  const a = document.getElementById('steelType').value === 'austenitic';
  document.getElementById('row_ferritic').style.display   = a ? 'none' : 'grid';
  document.getElementById('row_aust').style.display       = a ? 'grid' : 'none';
  document.getElementById('aust522block').style.display   = a ? 'block': 'none';
  if (a) { toggleAust522(); }
  else {
    const sfRe = document.getElementById('sf_re'); if(sfRe) sfRe.value = '1.5';
    const sfRm = document.getElementById('sf_rm');
    if(sfRm) { sfRm.value = '2.4'; sfRm.style.opacity = '1'; sfRm.style.pointerEvents = 'auto'; }
    const sfNote = document.getElementById('sf_note');
    if(sfNote) sfNote.innerHTML = '§5.2.1 Ferritic: <span style="color:var(--info)">Re÷1.5 / Rm÷2.4</span>';
  }
  recomputeF();
}
function recomputeF() {
  if (activeTab !== 'compute') return;
  const st    = document.getElementById('steelType').value;
  const opt   = document.getElementById('aust522opt')?.value || 'opt1';
  const Rm    = parseFloat(document.getElementById('Rm').value);
  const ReH   = parseFloat(document.getElementById('ReH').value);
  const Rp10  = parseFloat(document.getElementById('Rp10').value);
  const sfRe  = parseFloat(document.getElementById('sf_re').value) || 1.5;
  const sfRm  = parseFloat(document.getElementById('sf_rm').value) || 2.4;
  let f = null;
  if (st === 'ferritic' && Rm && ReH) f = Math.min(Rm / sfRm, ReH / sfRe);
  if (st === 'austenitic' && Rp10) {
    if (opt === 'opt1') f = Rp10 / 1.5;
    else { f = Rp10 / 1.2; if (Rm) f = Math.min(f, Rm / 3.0); }
  }
  if (f) document.getElementById('designStress').value = f.toFixed(1);
}
function applyPreset() {
  const k = document.getElementById('matPreset').value;
  if (k === 'custom') return;
  const m = MATS[k]; if (!m) return;
  document.getElementById('steelType').value = m.type;
  toggleSteelRows();
  if (m.Rm_rt)   document.getElementById('Rm').value  = m.Rm_rt;
  if (m.Re_rt)   document.getElementById('ReH').value = m.Re_rt;
  if (m.Rp10_rt) document.getElementById('Rp10').value= m.Rp10_rt;
  document.getElementById('designStress').value = '';
  // Switch to Compute tab
  const btns = document.querySelectorAll('.row-segmented button');
  const computeBtn = Array.from(btns).find(b => b.textContent.trim().toLowerCase().includes('compute'));
  if (computeBtn) { activeTab = 'compute'; computeBtn.closest('.row-segmented').querySelectorAll('button').forEach(b=>b.classList.remove('on')); computeBtn.classList.add('on'); }
  document.getElementById('tp_manual').classList.remove('on');
  document.getElementById('tp_compute').classList.add('on');
}

let activeTab = 'manual';
function switchTab(t, btn) {
  activeTab = t;
  // Remove 'on' from siblings
  if (btn) {
    const siblings = btn.closest('.row-segmented')?.querySelectorAll('button') || btn.closest('.tabs')?.querySelectorAll('.tb');
    if (siblings) siblings.forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
  document.getElementById('tp_manual').classList.toggle('on', t === 'manual');
  document.getElementById('tp_compute').classList.toggle('on', t === 'compute');
  recomputeF();
}

// ── CALCULATION CORE ──────────────────────────────────────────────────────────
function calcE(pc, Do, f, z) {
  const e_thin = (pc * Do) / (2 * f * z + pc);
  const ratio  = Do / (Do - 2 * e_thin);
  if (ratio <= 1.7) return { e: e_thin, formula: 'thin-wall (Eq. 6.1-1)', ratio };
  const e_lame = (Do / 2) * (1 - Math.sqrt((f * z - pc) / (f * z + pc)));
  return { e: e_lame, formula: 'Lam\xe9 thick-wall (Eq. 6.1-3)', ratio };
}
function calcEord(e, c0, c1Type, c1val, c2) {
  return c1Type === 'percent' ? (e + c0 + c2) / (1 - c1val) : e + c0 + c1val + c2;
}
function calcEa(en, c0, c1Type, c1val, c2) {
  return c1Type === 'percent' ? en * (1 - c1val) - c0 - c2 : en - c1val - c0 - c2;
}
function calcPmax(ea, Do, f, z) { return (2 * f * z * ea) / (Do - ea); }

// ── KPI BOX HELPER ────────────────────────────────────────────────────────────
function kpiBox(label, cls, val, unit) {
  return '<div class="kpi ' + (cls || '') + '"><div class="kpi-l">' + label + '</div><div class="kpi-v">' + val + '</div><div class="kpi-u">' + unit + '</div></div>';
}

// ── GLOBALS ───────────────────────────────────────────────────────────────────
let LAST = null, LAST_FLANGE = null, REPORT_LIST = [];

// Resets the input form to the clean HTML defaults (matches what PipeSpec.html looks like on first load)
function _resetFormToDefaults() {
  // Geometry
  const inputMethod = document.getElementById('inputMethod'); if (inputMethod) inputMethod.value = 'nps';
  document.getElementById('npsBlock').style.display = ''; document.getElementById('odBlock').style.display = 'none'; document.getElementById('manBlock').style.display = 'none';
  document.getElementById('npsInfo').style.display = 'none';
  ['npsSelect','man_od','dn_input','man_od_v','man_wt'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.value = '';
    el.dispatchEvent(new Event('change', { bubbles: true })); // refresh Apple trigger label
  });
  // Conditions
  ['pressure'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const temp = document.getElementById('temperature'); if (temp) temp.value = '20';
  const fluidType = document.getElementById('fluidType');
  if (fluidType) { fluidType.value = 'gas2'; fluidType.dispatchEvent(new Event('change', { bubbles: true })); }
  document.getElementById('waterPhaseBox').style.display = 'none';
  document.getElementById('catAutoDisplay').style.display = '';
  document.getElementById('catManualSelect').style.display = 'none';
  const catOverride = document.getElementById('catOverride'); if (catOverride) catOverride.checked = false;
  // Material
  const matPreset = document.getElementById('matPreset');
  if (matPreset) { matPreset.value = 'custom'; matPreset.dispatchEvent(new Event('change', { bubbles: true })); }
  const steelType = document.getElementById('steelType');
  if (steelType) { steelType.value = 'ferritic'; steelType.dispatchEvent(new Event('change', { bubbles: true })); }
  document.getElementById('aust522block').style.display = 'none';
  // Stress entry → Direct tab
  document.getElementById('tp_manual').classList.add('on'); document.getElementById('tp_compute').classList.remove('on');
  activeTab = 'manual';
  const btns = document.querySelectorAll('.row-segmented button');
  if (btns.length >= 2) { btns[0].classList.add('on'); btns[1].classList.remove('on'); }
  document.getElementById('row_ferritic').style.display = 'grid'; document.getElementById('row_aust').style.display = 'none';
  ['designStress','Rm','ReH','Rp10'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  // Safety factors defaults
  const sfRe = document.getElementById('sf_re'); if (sfRe) sfRe.value = '1.5';
  const sfRm = document.getElementById('sf_rm'); if (sfRm) { sfRm.value = '2.4'; sfRm.style.opacity = '1'; sfRm.style.pointerEvents = 'auto'; }
  const sfNote = document.getElementById('sf_note'); if (sfNote) sfNote.innerHTML = 'Standard ferritic: <span style="color:var(--info)">Re÷1.5</span> · <span style="color:var(--info)">Rm÷2.4</span>';
  const sfReLabel = document.getElementById('sf_re_label'); if (sfReLabel) sfReLabel.textContent = 'SF on yield (Re)';
  // Allowances
  const c0 = document.getElementById('c0'); if (c0) c0.value = '0.0';
  const c1Type = document.getElementById('c1Type'); if (c1Type) c1Type.value = 'percent';
  const c1pct = document.getElementById('c1pct'); if (c1pct) c1pct.value = '12.5';
  const c1pv  = document.getElementById('c1pv');  if (c1pv)  c1pv.textContent = '12.5%';
  document.getElementById('c1pRow').style.display = ''; document.getElementById('c1fRow').style.display = 'none';
  const c1fix = document.getElementById('c1fix'); if (c1fix) c1fix.value = '1.0';
  const c2    = document.getElementById('c2');    if (c2)    c2.value = '0.0';
  // Joint
  const jc = document.getElementById('jc');
  if (jc) { jc.value = '1.0'; jc.dispatchEvent(new Event('change', { bubbles: true })); }
  // Batch
  const batchEnabled = document.getElementById('batchEnabled'); if (batchEnabled) batchEnabled.checked = false;
  document.getElementById('batchUI').style.display = 'none';
}

// ── MAIN CALCULATE ────────────────────────────────────────────────────────────
function calculate() {
  const method = document.getElementById('inputMethod').value;
  let Do, en_actual = null, pipeObj = null;
  if (method === 'nps') {
    const nps = document.getElementById('npsSelect').value;
    if (!nps) { alert('Vælg en NPS størrelse.'); return; }
    pipeObj = PIPES.find(p => p.nps === nps); Do = pipeObj.od;
  } else if (method === 'manual') {
    Do = parseFloat(document.getElementById('man_od_v').value);
    en_actual = parseFloat(document.getElementById('man_wt').value);
    if (!Do || !en_actual) { alert('Angiv OD og vægtykkelse.'); return; }
  } else {
    Do = parseFloat(document.getElementById('man_od').value);
    if (!Do) { alert('Angiv ydre diameter (Do).'); return; }
  }
  const dn_input = parseFloat(document.getElementById('dn_input')?.value);
  const DN = pipeObj ? pipeObj.dn : (dn_input > 0 ? dn_input : Math.round(Do * 0.85));

  const pc_bar = parseFloat(document.getElementById('pressure').value);
  if (isNaN(pc_bar) || pc_bar < 0) { alert('Enter calculation pressure in bar.'); return; }
  const pc  = pc_bar / 10;
  const tc  = parseFloat(document.getElementById('temperature').value) || 20;
  const z   = parseFloat(document.getElementById('jc').value);
  const c0  = parseFloat(document.getElementById('c0').value) || 0;
  const c2  = parseFloat(document.getElementById('c2').value) || 0;
  const c1Type = document.getElementById('c1Type').value;
  const c1val  = c1Type === 'percent' ? parseFloat(document.getElementById('c1pct').value) / 100 : parseFloat(document.getElementById('c1fix').value) || 0;
  const c1_str = c1Type === 'percent' ? ((c1val * 100).toFixed(1) + '% \xd7 eord') : (c1val.toFixed(2) + ' mm (fixed)');
  const sfRe   = parseFloat(document.getElementById('sf_re').value) || 1.5;
  const sfRm   = parseFloat(document.getElementById('sf_rm').value) || 2.4;
  const selectedPreset = document.getElementById('matPreset').value;
  const matObj = (selectedPreset !== 'custom') ? MATS[selectedPreset] : null;
  const aust522opt = document.getElementById('aust522opt')?.value || 'opt1';

  let f, fDerivation = null;
  if (activeTab === 'compute' && matObj) {
    const fResult = computeF_from_mat(matObj, tc, sfRe, sfRm, aust522opt);
    if (!fResult || fResult.f === null) {
      alert('Temperature ' + tc + '°C is outside the standard data range for ' + matObj.name + '.\nMax temperature: ' + matObj.tempData[matObj.tempData.length - 1][0] + '°C');
      return;
    }
    f = fResult.f; fDerivation = fResult;
    document.getElementById('designStress').value = f.toFixed(2);
  } else if (activeTab === 'compute') {
    const st   = document.getElementById('steelType').value;
    const Rm   = parseFloat(document.getElementById('Rm').value);
    const ReH  = parseFloat(document.getElementById('ReH').value);
    const Rp10 = parseFloat(document.getElementById('Rp10').value);
    if (st === 'ferritic') {
      if (!Rm || !ReH) { alert('Enter Rm and ReH.'); return; }
      f = Math.min(Rm / sfRm, ReH / sfRe);
    } else {
      if (!Rp10) { alert('Enter Rp1.0t.'); return; }
      if (aust522opt === 'opt1') f = Rp10 / 1.5;
      else { f = Rp10 / 1.2; if (Rm) f = Math.min(f, Rm / 3.0); }
    }
    document.getElementById('designStress').value = f.toFixed(2);
  } else {
    f = parseFloat(document.getElementById('designStress').value);
    if (!f) { alert('Enter design stress f (MPa).'); return; }
  }

  const { e, formula, ratio } = calcE(pc, Do, f, z);
  const er   = calcEord(e, c0, c1Type, c1val, c2);
  const c1_mm= c1Type === 'percent' ? er * c1val : c1val;

  const lookupPipe = pipeObj || (() => {
    const cl = PIPES.reduce((a, b) => Math.abs(b.od - Do) < Math.abs(a.od - Do) ? b : a);
    return Math.abs(cl.od - Do) < 6 ? cl : null;
  })();

  let schedRows = [];
  if (lookupPipe) {
    Object.entries(lookupPipe.sch).forEach(([s, wt]) => {
      const ea_s = calcEa(wt, c0, c1Type, c1val, c2);
      const ok = ea_s >= e;
      schedRows.push({ sch: s, wt, ea_s, margin: ea_s - e, pmax: ea_s > 0 ? calcPmax(ea_s, lookupPipe.od, f, z) : 0, ok });
    });
  }

  let ea = null, margin = null, pass = null, pmax = null;
  if (en_actual !== null) {
    ea = calcEa(en_actual, c0, c1Type, c1val, c2);
    margin = ea - e; pass = ea >= e;
    pmax = ea > 0 ? calcPmax(ea, Do, f, z) : 0;
  } else {
    const ea_calc = calcEa(er, c0, c1Type, c1val, c2);
    pmax = ea_calc > 0 ? calcPmax(ea_calc, Do, f, z) : null;
  }

  const fluid = document.getElementById('fluidType').value;
  const catIsOverride = document.getElementById('catOverride').checked;
  let pedResult;
  if (catIsOverride) {
    const manCat = document.getElementById('catManual').value;
    const kontrolMap = { 'Art 4,3': 'C', 'I': 'C', 'II': 'C', 'III': 'B' };
    const descMap = {
      'Art 4,3': 'Under klassificeringstærsklen — ingen CE-mærkning krævet (PED Art. 4 §3). God ingeniørpraksis skal overholdes. Kontrolklasse C (DK).',
      'I':   'Kategori I — lavest regulerede kategori. Intern produktionskontrol (Modul A). CE-mærkning krævet. Kontrolklasse C (DK).',
      'II':  'Kategori II — Notified Body (NB) involveret i produktionskontrol. CE-mærkning krævet. Kontrolklasse C (DK).',
      'III': 'Kategori III — skærpet NB-kontrol af design og produktion. CE-mærkning krævet. Kontrolklasse B (DK).',
    };
    pedResult = { cat: manCat, psDN: pc_bar * DN, annex2table: 'Manuel override', kontrolklasse: kontrolMap[manCat] || 'C', catDesc: descMap[manCat] || '' };
  } else {
    pedResult = pedClassify(fluid, pc_bar, DN);
  }

  const sf_info = { steelType: document.getElementById('steelType').value, sfRe, sfRm, aust522opt };
  renderResults({ Do, en_actual, e, er, c0, c1_mm, c1_str, c2, ea, margin, pass, pmax, f, z,
    pc_bar, pc, tc, ratio, formula, DN, fluid, schedRows, lookupPipe, method,
    sf_info, fDerivation, matObj, catIsOverride, pedResult });
}

// ── DERIVATION CARD ───────────────────────────────────────────────────────────
function buildDerivationCard(r) {
  const fd = r.fDerivation, mat = r.matObj;
  if (!fd || !mat) return '';
  const td = mat.tempData, isAust = mat.type === 'austenitic', iData = fd.interpData;
  const opt = fd.aust522opt || 'opt1';
  let tblRows = '';
  if (iData && iData.interp) {
    const r1 = td.find(x => x[0] === iData.t_low) || [], r2 = td.find(x => x[0] === iData.t_high) || [];
    tblRows = '<tr style="color:#7dd3fc"><td>' + iData.t_low + '&deg;C</td><td>' + (r1[1] || '&mdash;') + '</td><td>' + (r1[2] || '&mdash;') + '</td><td>' + (r1[3] || '&mdash;') + '</td></tr>'
      + '<tr style="color:#7dd3fc"><td>' + iData.t_high + '&deg;C</td><td>' + (r2[1] || '&mdash;') + '</td><td>' + (r2[2] || '&mdash;') + '</td><td>' + (r2[3] || '&mdash;') + '</td></tr>'
      + '<tr style="background:rgba(230,126,34,.1);color:var(--acc-2);font-weight:bold"><td>&rarr;' + r.tc + '&deg;C</td><td>' + (fd.Rp02_t || '&mdash;') + '</td><td>' + (fd.Rp10_t || '&mdash;') + '</td><td>' + (fd.Rm_t || '&mdash;') + '</td></tr>';
  } else {
    tblRows = '<tr style="background:rgba(230,126,34,.1);color:var(--acc-2);font-weight:bold"><td>' + r.tc + '&deg;C</td><td>' + (fd.Rp02_t || '&mdash;') + '</td><td>' + (fd.Rp10_t || '&mdash;') + '</td><td>' + (fd.Rm_t || '&mdash;') + '</td></tr>';
  }
  let f_check = null;
  if (isAust) {
    if (opt === 'opt1') f_check = fd.Rp10_t ? +(fd.Rp10_t / 1.5).toFixed(2) : null;
    else { const a = fd.Rp10_t ? fd.Rp10_t / 1.2 : null, b = fd.Rm_t ? fd.Rm_t / 3.0 : null; f_check = (a && b) ? Math.min(a, b) : (a || b); }
  } else {
    const a = fd.Rp02_t ? +(fd.Rp02_t / fd.sfRe).toFixed(2) : null, b = fd.Rm_t ? +(fd.Rm_t / fd.sfRm).toFixed(2) : null;
    f_check = (a && b) ? Math.min(a, b) : (a || b);
  }
  const v1ok = f_check !== null && Math.abs(f_check - r.f) < 0.06;
  const e_v  = (r.pc * r.Do) / (2 * r.f * r.z + r.pc);
  const v2ok = Math.abs(e_v - r.e) < 0.002;
  const optLabel = isAust ? (opt === 'opt1' ? 'Option 1 — f = Rp1,0t / 1,5 &nbsp;[Eq. 5.2.2-1]' : 'Option 2 — f = min(Rp1,0t / 1,2 , Rm_t / 3) &nbsp;[Eq. 5.2.2-1+Rm]') : '§5.2.1 Ferritic';
  const stepLines = fd.steps.map(s => '<span class="fd">' + s + '</span>').join('<br>');
  return '<div class="rcard">'
    + '<div class="rcard-h"><h2>&#9656; Design Stress Derivation &mdash; EN 13480-3:2024 &sect;5.2 + EN 10028-7:2016 Table 13</h2></div>'
    + '<div class="rcard-b"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
    + '<div><div class="fbox" style="margin-bottom:10px"><div class="ftit">Material: ' + mat.name + '</div>'
    + 'Type: <span class="fd">' + (isAust ? 'Austenitic &sect;5.2.2' : 'Ferritic &sect;5.2.1') + '</span><br>'
    + '<span style="color:#3498db">' + optLabel + '</span><br>T: <span class="fd">' + r.tc + '&deg;C</span><br>'
    + '<span style="color:var(--mute);font-size:10px">' + iData.note + '</span></div>'
    + '<div style="font-family:var(--mono);font-size:10px;color:var(--acc-2);letter-spacing:2px;margin-bottom:6px">TABLE 13 EXTRACT (MPa)</div>'
    + '<table class="stbl" style="margin-bottom:10px"><thead><tr><th>T (&deg;C)</th><th>Rp0.2</th><th>Rp1.0</th><th>Rm</th></tr></thead><tbody>' + tblRows + '</tbody></table>'
    + '<div class="fbox"><div class="ftit">f calculation</div>' + stepLines + '<br>f = <span class="fr">' + r.f.toFixed(2) + ' MPa</span><br>Governing: <span style="color:#f39c12">' + fd.governs + '</span></div></div>'
    + '<div><div style="font-family:var(--mono);font-size:10px;color:var(--acc-2);letter-spacing:2px;margin-bottom:8px">VERIFICATION</div>'
    + '<div class="fbox" style="margin-bottom:8px;border-left-color:' + (v1ok ? '#27ae60' : '#e74c3c') + '">'
    + '<div class="ftit" style="color:' + (v1ok ? '#2ecc71' : '#e74c3c') + '">CHECK 1 &mdash; Re-derive f</div>'
    + 'f_check = <span class="fv">' + (f_check || '&mdash;') + ' MPa</span> vs f = <span class="fr">' + r.f.toFixed(2) + ' MPa</span>'
    + '&nbsp;<span style="color:' + (v1ok ? '#2ecc71' : '#e74c3c') + '">' + (v1ok ? '&#10003; MATCH' : '&#10007; MISMATCH') + '</span></div>'
    + '<div class="fbox" style="border-left-color:' + (v2ok ? '#27ae60' : '#e74c3c') + '">'
    + '<div class="ftit" style="color:' + (v2ok ? '#2ecc71' : '#e74c3c') + '">CHECK 2 &mdash; Back-calculate e</div>'
    + 'e = ' + e_v.toFixed(4) + ' mm vs stored ' + r.e.toFixed(4) + ' mm'
    + '&nbsp;<span style="color:' + (v2ok ? '#2ecc71' : '#e74c3c') + '">' + (v2ok ? '&#10003; MATCH' : '&#10007; MISMATCH') + '</span></div>'
    + (isAust ? '<div style="background:rgba(52,152,219,.07);border:1px solid rgba(52,152,219,.3);border-left:3px solid #3498db;border-radius:3px;padding:12px 14px;margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--mute);line-height:1.7">'
      + '<div style="color:#3498db;font-size:10px;letter-spacing:2px;margin-bottom:6px">EN 13480-3:2024 &sect;5.2.2 &mdash; CORRECTED</div>'
      + '<b style="color:#e8c56c">Option 1:</b> f = Rp1,0t / 1,5 &mdash; Rm_t not used<br>'
      + '<b style="color:#7dd3fc">Option 2:</b> f = min(Rp1,0t / 1,2 &nbsp;,&nbsp; Rm_t / 3)</div>' : '')
    + '</div></div></div></div>';
}

// ── RENDER RESULTS ────────────────────────────────────────────────────────────
function renderResults(r) {
  LAST = r;
  if (document.getElementById('tab-fittings').style.display !== 'none') populateFittingsFromPipe();
  const area = document.getElementById('tab-pipe');
  let stCls, stTxt;
  if (r.pass === null) { stCls = 'info'; stTxt = 'Beregnet krævet vægtykkelse: eord = ' + r.er.toFixed(2) + ' mm'; }
  else { stCls = r.pass ? 'pass' : 'fail'; stTxt = r.pass ? '✓ VÆGTYKKELSE TILSTRÆKKELIG — opfylder EN 13480-3:2024 §6.1' : '✗ VÆGTYKKELSE UTILSTRÆKKELIG — øg tykkelsen eller reducér tryk'; }

  const svgRo = 70, sf = svgRo / (r.Do / 2), svgRi = r.en_actual ? (r.Do / 2 - r.en_actual) * sf : (r.Do / 2 - r.e) * sf, svgRreq = (r.Do / 2 - r.e) * sf;
  const ped = r.pedResult || { cat: '—', psDN: 0, annex2table: '—', kontrolklasse: '—', catDesc: '' };
  const catCls = { 'III': 'cat-III', 'II': 'cat-II', 'I': 'cat-I', '0': 'cat-0', 'Art 4,3': 'cat-art43' }[ped.cat] || 'cat-0';
  const fLabel = { gas1: 'Gas Gr.1 (brandfarlig/giftig)', gas2: 'Gas Gr.2 (ikke-farlig)', liq1: 'Liquid Gr.1 (farlig)', liq2: 'Liquid Gr.2 (ikke-farlig)' }[r.fluid] || r.fluid;

  const schTbl = r.schedRows.length > 0
    ? '<div class="rcard"><div class="rcard-h"><h2>&#9658; Alle schedules &mdash; NPS ' + (r.lookupPipe ? r.lookupPipe.nps : '') + ' (OD ' + r.Do + ' mm)</h2></div><div class="rcard-b" style="padding:0"><table class="stbl"><thead><tr><th>Schedule</th><th>en (mm)</th><th>ea (mm)</th><th>e req (mm)</th><th>Margin (mm)</th><th>pmax (bar)</th><th>Status</th></tr></thead><tbody>'
      + r.schedRows.map(row => '<tr class="' + (row.ok ? 'pass-row' : 'fail-row') + '"><td>SCH ' + row.sch + '</td><td>' + row.wt.toFixed(2) + '</td><td>' + row.ea_s.toFixed(2) + '</td><td>' + r.e.toFixed(2) + '</td><td style="color:' + (row.margin >= 0 ? '#27ae60' : '#e74c3c') + '">' + (row.margin >= 0 ? '+' : '') + row.margin.toFixed(2) + '</td><td>' + (row.pmax > 0 ? (row.pmax * 10).toFixed(2) : '—') + '</td><td style="color:' + (row.ok ? '#27ae60' : '#e74c3c') + '">' + (row.ok ? '✓' : '✗') + '</td></tr>').join('')
      + '</tbody></table></div></div>'
    : '';

  area.innerHTML =
    '<div class="sbanner ' + stCls + '"><span class="sdot"></span>' + stTxt + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
    + '<button id="queue-action-btn" onclick="_ACTIVE_QUEUE_IDX!==null?saveQueueItem(_ACTIVE_QUEUE_IDX):addToReportList()" style="background:rgba(39,174,96,.15);border:1px solid rgba(39,174,96,.5);color:var(--ok);font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:8px 16px;cursor:pointer;border-radius:3px;">'
    + (_ACTIVE_QUEUE_IDX !== null ? '✎ GEM ÆNDRINGER' : '+ TILFØJ TIL RAPPORT')
    + '</button>'
    + '<span id="add-confirm" style="font-family:var(--mono);font-size:10px;color:var(--ok);display:none">✓ Tilføjet</span></div>'
    + '<div class="kgrid">'
    + '<div class="kpi"><div class="kpi-l">CALC. PRESSURE (pc)</div><div class="kpi-v">' + r.pc_bar.toFixed(2) + '</div><div class="kpi-u">bar</div></div>'
    + '<div class="kpi ' + (r.pass === true ? 'ok' : r.pass === false ? 'bad' : '') + '"><div class="kpi-l">MIN. REQ. THICKNESS (e)</div><div class="kpi-v">' + r.e.toFixed(2) + '</div><div class="kpi-u">mm</div></div>'
    + '<div class="kpi"><div class="kpi-l">REQ. ORDERED (eord)</div><div class="kpi-v">' + r.er.toFixed(2) + '</div><div class="kpi-u">mm</div></div>'
    + (r.ea !== null ? '<div class="kpi ' + (r.pass ? 'ok' : 'bad') + '"><div class="kpi-l">ANALYSIS (ea)</div><div class="kpi-v">' + r.ea.toFixed(2) + '</div><div class="kpi-u">mm</div></div>' : '')
    + (r.pmax !== null ? '<div class="kpi ok"><div class="kpi-l">pmax</div><div class="kpi-v">' + ((r.pmax || 0) * 10).toFixed(2) + '</div><div class="kpi-u">bar</div></div>' : '')
    + '<div class="kpi inf"><div class="kpi-l">DESIGN STRESS (f)</div><div class="kpi-v">' + r.f.toFixed(2) + '</div><div class="kpi-u">MPa @ ' + r.tc + '&deg;C</div></div>'
    + '<div class="kpi"><div class="kpi-l">JOINT COEFF. (z)</div><div class="kpi-v">' + r.z + '</div><div class="kpi-u">&mdash;</div></div>'
    + '</div>'
    + buildDerivationCard(r)
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">'
    + '<div class="rcard"><div class="rcard-h"><h2>&#9658; Calculation &mdash; EN 13480-3:2024</h2></div><div class="rcard-b">'
    + '<div class="fbox"><div class="ftit">&sect;6.1 Minimum Required Wall Thickness [' + r.formula + ']</div>'
    + 'e = (pc &times; Do) / (2&middot;f&middot;z + pc)<br>'
    + 'e = (' + r.pc.toFixed(4) + ' &times; ' + r.Do + ') / (2 &times; ' + r.f.toFixed(1) + ' &times; ' + r.z + ' + ' + r.pc.toFixed(4) + ')<br>'
    + 'e = <span class="fr">' + r.e.toFixed(3) + ' mm</span></div>'
    + '<div class="fbox"><div class="ftit">&sect;4.3 Thickness Allowances</div>'
    + 'c&#8320; = <span class="fd">' + r.c0 + ' mm</span> &nbsp;|&nbsp; c&#8321; = <span class="fd">' + r.c1_str + '</span> &asymp; <span class="fd">' + r.c1_mm.toFixed(3) + ' mm</span> &nbsp;|&nbsp; c&#8322; = <span class="fd">' + r.c2 + ' mm</span><br>'
    + 'eord &ge; <span class="fr">' + r.er.toFixed(3) + ' mm</span></div>'
    + (r.ea !== null ? '<div class="fbox"><div class="ftit">Verification &mdash; Actual Pipe</div>'
      + 'ea = en &minus; c&#8320; &minus; c&#8321; &minus; c&#8322; = <span class="fr">' + r.ea.toFixed(3) + ' mm</span><br>'
      + 'ea ' + (r.ea >= r.e ? '&ge;' : '&lt;') + ' e_req &rarr; <span style="color:' + (r.pass ? '#2ecc71' : '#e74c3c') + '">' + (r.pass ? 'PASS ✓' : 'FAIL ✗') + '</span></div>' : '')
    + '<div class="fbox"><div class="ftit">Geometry Check</div>'
    + 'Do/Di = <span class="fd">' + r.ratio.toFixed(3) + '</span> &rarr; ' + (r.ratio <= 1.7 ? '<span style="color:#27ae60">Thin-wall &le; 1.7 ✓</span>' : '<span style="color:#e67e22">Thick-wall > 1.7 &mdash; Lam&eacute; applied</span>')
    + '</div></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:14px">'
    + '<div class="rcard"><div class="rcard-h"><h2>&#9658; Cross Section</h2></div><div class="rcard-b" style="display:flex;justify-content:center">'
    + '<svg width="190" height="190" viewBox="-100 -100 200 200">'
    + '<defs><radialGradient id="pg"><stop offset="0%" stop-color="#3d5068"/><stop offset="100%" stop-color="#1c2a3a"/></radialGradient></defs>'
    + '<circle cx="0" cy="0" r="' + svgRo + '" fill="url(#pg)" stroke="#4a6080" stroke-width="1.2"/>'
    + '<circle cx="0" cy="0" r="' + svgRi.toFixed(1) + '" fill="#0d1117" stroke="#2d3748" stroke-width="1"/>'
    + (svgRreq < svgRi - 1 ? '<circle cx="0" cy="0" r="' + svgRreq.toFixed(1) + '" fill="none" stroke="#e74c3c" stroke-width="0.8" stroke-dasharray="3,2"/>' : '')
    + '<text x="0" y="-82" text-anchor="middle" fill="#e67e22" font-size="8" font-family="monospace">OD ' + r.Do + ' mm</text>'
    + '<line x1="' + svgRi.toFixed(1) + '" y1="0" x2="' + svgRo + '" y2="0" stroke="#3498db" stroke-width="1.5"/>'
    + '<text x="' + ((svgRi + svgRo) / 2).toFixed(1) + '" y="13" text-anchor="middle" fill="#3498db" font-size="8" font-family="monospace">eord=' + r.er.toFixed(2) + ' mm</text>'
    + '<circle cx="0" cy="0" r="2" fill="#666"/>'
    + '</svg></div></div>'
    + '<div class="rcard"><div class="rcard-h"><h2>&#9658; PED-klassificering &mdash; Annex II</h2></div><div class="rcard-b">'
    + '<div style="text-align:center;margin-bottom:12px"><span class="cat-chip ' + catCls + '">KATEGORI ' + ped.cat + '</span>' + (r.catIsOverride ? '<span style="font-family:var(--mono);font-size:9px;color:var(--acc);margin-left:8px">MANUEL</span>' : '') + '</div>'
    + '<div class="irow"><span class="ik">DN</span><span class="iv">' + r.DN + '</span></div>'
    + '<div class="irow"><span class="ik">PS (bar)</span><span class="iv">' + r.pc_bar.toFixed(2) + '</span></div>'
    + '<div class="irow"><span class="ik">PS &times; DN</span><span class="iv">' + ped.psDN.toFixed(0) + '</span></div>'
    + '<div class="irow"><span class="ik">Fluidtype</span><span class="iv">' + fLabel + '</span></div>'
    + '<div class="irow"><span class="ik">Annex II ref.</span><span class="iv" style="color:var(--acc-2)">' + ped.annex2table + '</span></div>'
    + '<div class="irow"><span class="ik">Kontrolklasse (DK)</span><span class="iv" style="color:#3498db">Klasse ' + ped.kontrolklasse + '</span></div>'
    + (ped.catDesc ? '<div class="ped-cat-note">' + ped.catDesc + '</div>' : '')
    + '</div></div>'
    + '</div></div>'
    + schTbl;
}

// ── REPORT LIST ───────────────────────────────────────────────────────────────
let _ACTIVE_QUEUE_IDX = null; // index of the queue item currently loaded for editing

function addToReportList() {
  if (!LAST) return;
  const r = LAST;
  const dn = r.lookupPipe ? r.lookupPipe.dn : Math.round(r.Do * 0.8);
  const label = 'DN' + dn + ' / ' + r.pc_bar.toFixed(1) + ' bar / ' + r.tc + '°C';
  const formState = window.PM ? PM._captureForm() : {};
  REPORT_LIST.push({ ...r, label, _formState: formState });
  _ACTIVE_QUEUE_IDX = null;
  renderReportList();
  const el = document.getElementById('add-confirm');
  if (el) { el.style.display = ''; setTimeout(() => el.style.display = 'none', 2000); }
}
function addFlangeToReport() {
  if (!LAST_FLANGE) return;
  const f = LAST_FLANGE;
  const label = 'Flange DN' + f.actualDN + ' / PN' + f.selectedPN + ' — ' + f.pc_bar.toFixed(1) + ' bar / ' + f.T + '°C';
  REPORT_LIST.push({ ...f, label, type: 'flange' });
  renderReportList();
  const el = document.getElementById('flange-add-confirm');
  if (el) { el.style.display = ''; setTimeout(() => el.style.display = 'none', 2000); }
}
function removeFromReportList(idx) {
  if (_ACTIVE_QUEUE_IDX === idx) _ACTIVE_QUEUE_IDX = null;
  else if (_ACTIVE_QUEUE_IDX > idx) _ACTIVE_QUEUE_IDX--;
  REPORT_LIST.splice(idx, 1);
  renderReportList();
}
function clearReportList() { REPORT_LIST = []; _ACTIVE_QUEUE_IDX = null; renderReportList(); }

function loadFromQueue(idx) {
  const entry = REPORT_LIST[idx];
  if (!entry || entry.type === 'flange') return;
  _ACTIVE_QUEUE_IDX = idx;
  // Restore form state if saved
  if (entry._formState && window.PM) {
    PM._restoreForm(entry._formState);
  }
  // Render the stored result directly
  renderResults(entry);
  // Scroll results into view
  const main = document.getElementById('mainArea');
  if (main) main.scrollTop = 0;
  // Switch to pipe tab
  if (typeof UI !== 'undefined') UI.switchMainTab('pipe');
  renderReportList();
}

function saveQueueItem(idx) {
  // Recalculate with current form state and overwrite the queue entry
  calculate();
  if (!LAST) return;
  const dn = LAST.lookupPipe ? LAST.lookupPipe.dn : Math.round(LAST.Do * 0.8);
  const label = 'DN' + dn + ' / ' + LAST.pc_bar.toFixed(1) + ' bar / ' + LAST.tc + '°C';
  const formState = window.PM ? PM._captureForm() : {};
  REPORT_LIST[idx] = { ...LAST, label, _formState: formState };
  _ACTIVE_QUEUE_IDX = null;
  renderReportList();
  if (window.PM) PM.saveCurrentState();
  // Brief confirm flash
  const el = document.getElementById('add-confirm');
  if (el) { el.textContent = 'Gemt ✓'; el.style.display = ''; setTimeout(() => { el.style.display = 'none'; el.textContent = 'Tilføjet ✓'; }, 1800); }
}

function renderReportList() {
  const panel = document.getElementById('rapport-liste-panel');
  const items = document.getElementById('rapport-liste-items');
  if (!REPORT_LIST.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  // Save button row shown when a queue item is loaded for editing
  const saveRow = _ACTIVE_QUEUE_IDX !== null
    ? '<div style="padding:8px 0 4px;display:flex;gap:6px;align-items:center;">'
      + '<button onclick="saveQueueItem(' + _ACTIVE_QUEUE_IDX + ')" style="background:var(--acc);color:#fff;border:none;border-radius:var(--r-sm);font-size:11px;font-weight:600;padding:5px 14px;cursor:pointer;">Gem ændringer</button>'
      + '<span style="font-family:var(--mono);font-size:10px;color:var(--text-3)">Redigerer #' + (_ACTIVE_QUEUE_IDX + 1) + '</span>'
      + '<button onclick="_ACTIVE_QUEUE_IDX=null;renderReportList()" style="background:none;border:none;font-size:10px;color:var(--text-3);cursor:pointer;margin-left:auto;">Annuller</button>'
      + '</div>'
    : '';

  // Pipe entries get sequential numbers; fittings (any .type) are child rows
  let pipeNum = 0;
  const parentNums = REPORT_LIST.map(r => { if (!r.type) { pipeNum++; return pipeNum; } return pipeNum; });

  // Fitting type → icon mapping
  const fitIcon = { flange: '⬡', bend: '↩', reducer: '⊳', tee: '⊤' };

  items.innerHTML = saveRow + REPORT_LIST.map((r, i) => {
    const isActive  = i === _ACTIVE_QUEUE_IDX;
    const isFitting = !!r.type;
    const num       = parentNums[i];

    if (isFitting) {
      const icon = fitIcon[r.type] || '↳';
      const cleanLabel = r.label.replace(/^\[.*?\]\s*/, '');
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0 3px 14px;border-bottom:1px solid var(--hair);position:relative;">'
        + '<span style="position:absolute;left:6px;top:0;bottom:0;width:1px;background:var(--hair);"></span>'
        + '<span style="position:absolute;left:6px;top:50%;width:6px;height:1px;background:var(--hair);"></span>'
        + '<span style="font-family:var(--mono);font-size:10px;color:var(--text-3);flex:1;padding-left:4px;">' + icon + ' ' + cleanLabel + '</span>'
        + '<button onclick="removeFromReportList(' + i + ')" style="background:none;border:none;color:var(--text-3);font-size:11px;cursor:pointer;padding:0 4px;">×</button>'
        + '</div>';
    }

    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--hair);'
      + (isActive ? 'background:var(--acc-bg);border-radius:6px;padding:5px 6px;' : '') + '">'
      + '<button onclick="loadFromQueue(' + i + ')" style="background:none;border:none;text-align:left;cursor:pointer;flex:1;padding:0;font-family:var(--mono);font-size:10px;color:' + (isActive ? 'var(--acc)' : 'var(--text-2)') + ';font-weight:' + (isActive ? '600' : '400') + ';">'
      + num + '. ' + r.label + (isActive ? ' ✎' : '') + '</button>'
      + '<button onclick="removeFromReportList(' + i + ')" style="background:none;border:none;color:var(--text-3);font-size:11px;cursor:pointer;padding:0 4px;">×</button>'
      + '</div>';
  }).join('');
}

// ── SWITCH MAIN TAB ───────────────────────────────────────────────────────────
function populateFittingsFromPipe() {
  if (!LAST) {
    document.getElementById('fittings-warn').style.display = '';
    document.getElementById('fittings-content').style.display = 'none';
    return;
  }
  document.getElementById('fittings-warn').style.display = 'none';
  document.getElementById('fittings-content').style.display = '';
  if (!document.getElementById('bend_od').value) document.getElementById('bend_od').value = LAST.Do;
  if (!document.getElementById('tee_header_od').value) document.getElementById('tee_header_od').value = LAST.Do;
  if (typeof fl_T_synced !== 'undefined' && fl_T_synced) document.getElementById('fl_T').value = LAST.tc || 20;
  if (typeof fl_pc_synced !== 'undefined' && fl_pc_synced) document.getElementById('fl_pc').value = LAST.pc_bar ? LAST.pc_bar.toFixed(2) : '';
  document.getElementById('fl_dn').value = LAST.DN || '';
  if (typeof calcFlange === 'function') calcFlange();
}

// ── NPS SELECT INIT ───────────────────────────────────────────────────────────
function initNpsSelect() {
  const s = document.getElementById('npsSelect');
  if (!s) return;
  s.innerHTML = '<option value="">— Vælg NPS —</option>';
  PIPES.forEach(p => {
    const o = document.createElement('option');
    o.value = p.nps;
    o.textContent = 'NPS ' + p.nps + '  (DN ' + p.dn + '  —  OD ' + p.od + ' mm)';
    s.appendChild(o);
  });
  s.addEventListener('change', function () {
    const p = PIPES.find(x => x.nps === this.value);
    if (!p) { document.getElementById('npsInfo').style.display = 'none'; return; }
    document.getElementById('ni_od').textContent = p.od;
    document.getElementById('ni_dn').textContent = p.dn;
    document.getElementById('npsInfo').style.display = '';
    // Rebuild Apple-select trigger label if present
    const trig = s.previousElementSibling;
    if (trig && trig.classList.contains('apple-select')) {
      const span = trig.querySelector('.apple-select-text');
      if (span) span.textContent = s.options[s.selectedIndex]?.textContent.trim() || '';
    }
  });
}

// ── BATCH CALCULATION ─────────────────────────────────────────────────────────
function initBatchDNDropdowns() {
  const dns = PIPES.map(p => p.dn);
  const fromSel = document.getElementById('batchDnFrom');
  const toSel   = document.getElementById('batchDnTo');
  if (!fromSel || !toSel) return;
  fromSel.innerHTML = '';
  toSel.innerHTML   = '';
  dns.forEach(dn => {
    fromSel.innerHTML += '<option value="' + dn + '">DN' + dn + '</option>';
    toSel.innerHTML   += '<option value="' + dn + '">DN' + dn + '</option>';
  });
  toSel.selectedIndex = toSel.options.length - 1;
}
function toggleBatchUI() {
  document.getElementById('batchUI').style.display = document.getElementById('batchEnabled').checked ? 'block' : 'none';
}

function _batchReadCommonInputs() {
  const pc_bar = parseFloat(document.getElementById('pressure').value);
  if (isNaN(pc_bar) || pc_bar < 0) { alert('Enter calculation pressure in bar.'); return null; }
  const pc   = pc_bar / 10;
  const tc   = parseFloat(document.getElementById('temperature').value) || 20;
  const z    = parseFloat(document.getElementById('jc').value);
  const c0   = parseFloat(document.getElementById('c0').value) || 0;
  const c2   = parseFloat(document.getElementById('c2').value) || 0;
  const c1Type = document.getElementById('c1Type').value;
  const c1val  = c1Type === 'percent' ? parseFloat(document.getElementById('c1pct').value) / 100 : parseFloat(document.getElementById('c1fix').value) || 0;
  const c1_str = c1Type === 'percent' ? ((c1val * 100).toFixed(1) + '% × eord') : (c1val.toFixed(2) + ' mm (fixed)');
  const sfRe   = parseFloat(document.getElementById('sf_re').value) || 1.5;
  const sfRm   = parseFloat(document.getElementById('sf_rm').value) || 2.4;
  const selectedPreset = document.getElementById('matPreset').value;
  const matObj = (selectedPreset !== 'custom') ? MATS[selectedPreset] : null;
  const aust522opt = document.getElementById('aust522opt')?.value || 'opt1';
  const fluid = document.getElementById('fluidType').value;
  let f = null, fDerivation = null;
  if (activeTab === 'compute' && matObj) {
    const fResult = computeF_from_mat(matObj, tc, sfRe, sfRm, aust522opt);
    if (!fResult || fResult.f === null) { alert('Temperature ' + tc + '°C is outside data range for ' + matObj.name + '.'); return null; }
    f = fResult.f; fDerivation = fResult;
    document.getElementById('designStress').value = f.toFixed(2);
  } else if (activeTab === 'compute') {
    const st   = document.getElementById('steelType').value;
    const Rm   = parseFloat(document.getElementById('Rm').value);
    const ReH  = parseFloat(document.getElementById('ReH').value);
    const Rp10 = parseFloat(document.getElementById('Rp10').value);
    if (st === 'ferritic') { if (!Rm || !ReH) { alert('Enter Rm and ReH.'); return null; } f = Math.min(Rm / sfRm, ReH / sfRe); }
    else { if (!Rp10) { alert('Enter Rp1.0t.'); return null; } if (aust522opt === 'opt1') f = Rp10 / 1.5; else { f = Rp10 / 1.2; if (Rm) f = Math.min(f, Rm / 3.0); } }
    document.getElementById('designStress').value = f.toFixed(2);
  } else {
    f = parseFloat(document.getElementById('designStress').value);
    if (!f) { alert('Enter design stress f (MPa).'); return null; }
  }
  return { pc_bar, pc, tc, z, c0, c2, c1Type, c1val, c1_str, sfRe, sfRm, matObj, aust522opt, fluid, f, fDerivation };
}

function _batchCalcOnePipe(pipeObj, inp) {
  const { pc_bar, pc, tc, z, c0, c2, c1Type, c1val, c1_str, fluid, f, fDerivation, matObj, sfRe, sfRm, aust522opt } = inp;
  const Do = pipeObj.od, DN = pipeObj.dn;
  const { e, formula, ratio } = calcE(pc, Do, f, z);
  const er   = calcEord(e, c0, c1Type, c1val, c2);
  const c1_mm= c1Type === 'percent' ? er * c1val : c1val;
  let schedRows = [];
  Object.entries(pipeObj.sch).forEach(([s, wt]) => {
    const ea_s = calcEa(wt, c0, c1Type, c1val, c2);
    schedRows.push({ sch: s, wt, ea_s, margin: ea_s - e, pmax: ea_s > 0 ? calcPmax(ea_s, Do, f, z) : 0, ok: ea_s >= e });
  });
  const anyPass = schedRows.some(r => r.ok);
  const pedResult = pedClassify(fluid, pc_bar, DN);
  const ea_calc = calcEa(er, c0, c1Type, c1val, c2);
  const _pmax   = ea_calc > 0 ? calcPmax(ea_calc, Do, f, z) : null;
  return { Do, en_actual: null, e, er, c0, c1_mm, c1_str, c2, ea: null, margin: null, pass: null, pmax: _pmax,
    f, z, pc_bar, pc, tc, ratio, formula, DN, fluid, schedRows, lookupPipe: pipeObj, method: 'nps',
    sf_info: { steelType: document.getElementById('steelType').value, sfRe, sfRm, aust522opt },
    fDerivation, matObj, catIsOverride: false, pedResult, _anySchPass: anyPass };
}

function _batchBuildCard(r) {
  const anyPass = r._anySchPass;
  const statusCls = anyPass ? 'pass' : 'fail';
  const statusTxt = anyPass ? '✓ OPFYLDT — mindst ét schedule er tilstrækkeligt' : '✗ INGEN SCHEDULE TILSTRÆKKELIGT — øg tryk eller verificér manuelt';
  const schTbl = r.schedRows.length > 0
    ? '<table class="stbl" style="margin-top:10px"><thead><tr><th>Schedule</th><th>en (mm)</th><th>ea (mm)</th><th>e req (mm)</th><th>Margin (mm)</th><th>pmax (bar)</th><th>Status</th></tr></thead><tbody>'
      + r.schedRows.map(row => '<tr class="' + (row.ok ? 'pass-row' : 'fail-row') + '"><td>SCH ' + row.sch + '</td><td>' + row.wt.toFixed(2) + '</td><td>' + row.ea_s.toFixed(2) + '</td><td>' + r.e.toFixed(2) + '</td><td style="color:' + (row.margin >= 0 ? '#27ae60' : '#e74c3c') + '">' + (row.margin >= 0 ? '+' : '') + row.margin.toFixed(2) + '</td><td>' + (row.pmax > 0 ? (row.pmax * 10).toFixed(2) : '—') + '</td><td style="color:' + (row.ok ? '#27ae60' : '#e74c3c') + '">' + (row.ok ? '✓' : '✗') + '</td></tr>').join('')
      + '</tbody></table>'
    : '';
  return '<div class="rcard" style="margin-bottom:12px">'
    + '<div class="rcard-h" style="display:flex;align-items:center;gap:10px;justify-content:space-between">'
    + '<h2 style="font-size:13px;font-weight:700;color:var(--text)">DN' + r.DN + ' &nbsp;<span style="font-size:10px;font-weight:400;color:var(--text-2)">(OD ' + r.Do + ' mm)</span></h2>'
    + '<span style="font-family:var(--mono);font-size:10px;color:' + (anyPass ? '#27ae60' : '#e74c3c') + ';font-weight:600">' + (anyPass ? 'PASS' : 'FAIL') + '</span></div>'
    + '<div class="rcard-b"><div class="sbanner ' + statusCls + '" style="margin-bottom:10px"><span class="sdot"></span>' + statusTxt + '</div>'
    + '<div class="kgrid" style="margin-bottom:10px">'
    + kpiBox('MIN. REQ. (e)', '', r.e.toFixed(2), 'mm')
    + kpiBox('REQ. ORDERED (eord)', '', r.er.toFixed(2), 'mm')
    + kpiBox('DESIGN STRESS (f)', 'inf', r.f.toFixed(2), 'MPa @ ' + r.tc + '°C')
    + kpiBox('GEOMETRY', '', (r.ratio <= 1.7 ? 'Thin' : 'Thick'), 'Do/Di = ' + r.ratio.toFixed(2))
    + '</div>' + schTbl + '</div></div>';
}

let _BATCH_RESULTS = [];

function addBatchToReport() {
  _BATCH_RESULTS.forEach(r => { REPORT_LIST.push({ ...r, label: r._batchLabel }); });
  renderReportList();
  const el = document.getElementById('batch-add-confirm');
  if (el) { el.style.display = ''; setTimeout(() => el.style.display = 'none', 2500); }
}

function runBatchCalculate() {
  const fromDN = parseInt(document.getElementById('batchDnFrom').value);
  const toDN   = parseInt(document.getElementById('batchDnTo').value);
  if (fromDN > toDN) { alert('DN FROM må ikke være større end DN TO.'); return; }
  const inp = _batchReadCommonInputs();
  if (!inp) return;
  const pipes = PIPES.filter(p => p.dn >= fromDN && p.dn <= toDN);
  if (!pipes.length) { alert('Ingen rør fundet i det valgte DN-interval.'); return; }
  _BATCH_RESULTS = [];

  // Switch to pipe tab
  document.getElementById('tab-pipe').style.display = '';
  document.getElementById('tab-fittings').style.display = 'none';
  document.querySelectorAll('.main-tabs .htb').forEach(b => b.classList.remove('on'));
  document.getElementById('htab-pipe-btn')?.classList.add('on');

  const area = document.getElementById('tab-pipe');
  const doFlanges  = document.getElementById('batchFlangeEnabled').checked;
  const doBends    = document.getElementById('batchBendEnabled')?.checked;
  const doReducers = document.getElementById('batchReducerEnabled')?.checked;
  const doTees     = document.getElementById('batchTeeEnabled')?.checked;
  let cardsHtml = '';
  pipes.forEach((pipeObj, idx) => {
    const r = _batchCalcOnePipe(pipeObj, inp);
    r._batchLabel = 'DN' + r.DN + ' / ' + r.pc_bar.toFixed(1) + ' bar / ' + r.tc + '°C [batch]';
    r._e_req = r.e; // expose required thickness for bend helper
    _BATCH_RESULTS.push(r);
    cardsHtml += _batchBuildCard(r);

    if (doFlanges && typeof _batchCalcOneFlange === 'function') {
      const fl = _batchCalcOneFlange(pipeObj.dn);
      if (fl) {
        fl._batchLabel = 'Flange DN' + fl.actualDN + ' / PN' + (fl.selectedPN || '?') + ' — ' + fl.pc_bar.toFixed(1) + ' bar / ' + fl.T + '°C [batch]';
        _BATCH_RESULTS.push(fl);
        if (typeof _batchBuildFlangeCard === 'function') cardsHtml += _batchBuildFlangeCard(fl);
      }
    }
    if (doBends && typeof _batchCalcOneBend === 'function') {
      const inpWithE = { ...inp, _e_req: r.e };
      const bend = _batchCalcOneBend(pipeObj, inpWithE);
      if (bend) {
        bend._batchLabel = 'Bøjning DN' + bend.DN + ' — ' + bend.angle + ' R=' + bend.R.toFixed(0) + ' mm' + (bend.usedDefaultR ? ' (1.5×Do)' : '') + ' [batch]';
        _BATCH_RESULTS.push(bend);
        if (typeof _batchBuildBendCard === 'function') cardsHtml += _batchBuildBendCard(bend);
      }
    }
    if (doReducers && typeof _batchCalcOneReducer === 'function') {
      const nextPipe = pipes[idx + 1] || null;
      const red = _batchCalcOneReducer(pipeObj, nextPipe, inp);
      if (red) {
        red._batchLabel = 'Reducer DN' + red.DN_large + '→DN' + red.DN_small + ' [batch]';
        _BATCH_RESULTS.push(red);
        if (typeof _batchBuildReducerCard === 'function') cardsHtml += _batchBuildReducerCard(red);
      }
    }
    if (doTees && typeof _batchCalcOneTee === 'function') {
      const tee = _batchCalcOneTee(pipeObj, inp);
      if (tee) {
        tee._batchLabel = 'T-styk DN' + tee.DN + '×DN' + tee.DN + ' [batch]';
        _BATCH_RESULTS.push(tee);
        if (typeof _batchBuildTeeCard === 'function') cardsHtml += _batchBuildTeeCard(tee);
      }
    }
  });

  const addAllBtn = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
    + '<button onclick="addBatchToReport()" style="background:rgba(39,174,96,.15);border:1px solid rgba(39,174,96,.5);color:var(--ok);font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:8px 16px;cursor:pointer;border-radius:3px;">+ Tilføj alle batch-beregninger til rapport</button>'
    + '<span id="batch-add-confirm" style="font-family:var(--mono);font-size:10px;color:var(--ok);display:none">✓ Tilføjet</span></div>';

  area.innerHTML =
    '<div style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--text-2);letter-spacing:0.4px;text-transform:uppercase;margin-bottom:12px;padding:8px 12px;background:var(--acc-bg);border:1px solid var(--acc-bg-2);border-radius:var(--r-sm);">'
    + '&#128260; Batch — DN' + fromDN + ' → DN' + toDN + ' &nbsp;|&nbsp; pc = ' + inp.pc_bar.toFixed(1) + ' bar &nbsp;|&nbsp; T = ' + inp.tc + '°C &nbsp;|&nbsp; f = ' + inp.f.toFixed(2) + ' MPa &nbsp;|&nbsp; ' + pipes.length + ' sizes'
    + '</div>' + addAllBtn + cardsHtml;
}

// Initialise batch dropdowns
(function () {
  function _try() {
    if (typeof PIPES !== 'undefined' && document.getElementById('batchDnFrom')) { initBatchDNDropdowns(); }
    else { setTimeout(_try, 100); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _try); } else { _try(); }
})();

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT MANAGER
// ══════════════════════════════════════════════════════════════════════════════
const _PROJ_KEY   = 'pipeCalc_projects_v1';
const _ACTIVE_KEY = 'pipeCalc_activeProj_v1';
const _VER_KEY    = 'pipeCalc_ver';
const _STORAGE_VER = '2'; // bump to force a clean slate on next load
const _FORM_FIELDS = [
  ['inputMethod','select'],['npsSelect','select'],
  ['man_od','number'],['man_od_v','number'],['man_wt','number'],['dn_input','number'],
  ['pressure','number'],['temperature','number'],
  ['fluidType','select'],['catOverride','checkbox'],['catManual','select'],
  ['matPreset','select'],['steelType','select'],['aust522opt','select'],
  ['designStress','number'],['Rm','number'],['ReH','number'],['Rp10','number'],
  ['sf_re','number'],['sf_rm','number'],
  ['c0','number'],['c1Type','select'],['c1pct','range'],['c1fix','number'],['c2','number'],
  ['jc','select'],
  ['rpt-proj','text'],['rpt-num','text'],['rpt-rev','text'],['rpt-by','text'],['rpt-client','text'],
  ['rpt-s1','checkbox'],['rpt-s2','checkbox'],['rpt-s3','checkbox'],['rpt-s4','checkbox'],['rpt-s5','checkbox'],['rpt-s6','checkbox'],
  ['bend_angle','select'],['bend_R','number'],['bend_od','number'],
  ['red_type','select'],['red_dl','number'],['red_ds','number'],['red_L','number'],
  ['tee_type','select'],['tee_header_od','number'],['tee_branch_od','number'],
  ['fl_mat','select'],['fl_pc','number'],['fl_T','number'],
  ['fl_dn','number'],['fl_type','select'],['fl_pn_manual','select'],
];

const PM = {
  projects: {}, activeId: null,

  _load() {
    try {
      const r = localStorage.getItem(_PROJ_KEY);
      this.projects = r ? JSON.parse(r) : {};
      this.activeId = localStorage.getItem(_ACTIVE_KEY) || null;
    } catch(e) { this.projects = {}; this.activeId = null; }
  },

  async _loadAsync() {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        if (data && data.projects && Object.keys(data.projects).length > 0) {
          this.projects = data.projects;
          this.activeId = data.activeId || null;
          this._serverHasData = true;
          return;
        }
        // Server responded OK but no projects yet — mark as confirmed empty
        this._serverHasData = true;
        this.projects = {}; this.activeId = null;
      } else {
        // Server error — use localStorage fallback only
        this._serverHasData = false;
        this._load();
      }
    } catch(e) {
      // Network/fetch error — use localStorage fallback only
      console.warn('PM._loadAsync:', e);
      this._serverHasData = false;
      this._load();
    }
  },

  _save() {
    try {
      localStorage.setItem(_PROJ_KEY, JSON.stringify(this.projects));
      localStorage.setItem(_ACTIVE_KEY, this.activeId || '');
      localStorage.setItem(_VER_KEY, _STORAGE_VER);
    } catch(e) { console.warn('localStorage full:', e); }
  },

  async _saveAsync() {
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: this.projects, activeId: this.activeId || '' })
      });
    } catch(e) { console.warn('PM._saveAsync:', e); this._save(); }
  },

  _captureForm() {
    const s = {};
    _FORM_FIELDS.forEach(([id, type]) => { const el = document.getElementById(id); if (!el) return; s[id] = (type === 'checkbox') ? el.checked : el.value; });
    s._activeTab     = activeTab;
    s._activeMainTab = document.getElementById('tab-fittings').style.display === 'none' ? 'pipe' : 'fittings';
    return s;
  },

  _restoreForm(s) {
    if (!s) return;
    _FORM_FIELDS.forEach(([id, type]) => {
      if (s[id] === undefined) return;
      const el = document.getElementById(id); if (!el) return;
      if (type === 'checkbox') { el.checked = s[id]; }
      else { el.value = s[id]; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    if (typeof toggleMethod      === 'function') toggleMethod();
    if (typeof toggleSteelRows   === 'function') toggleSteelRows();
    if (typeof toggleC1          === 'function') toggleC1();
    if (typeof toggleCatOverride === 'function') toggleCatOverride();
    if (typeof toggleAust522     === 'function') toggleAust522();
    if (typeof recomputeF        === 'function') recomputeF();
    if (typeof updateWaterPhase  === 'function') updateWaterPhase();
    const c1pct = document.getElementById('c1pct'); const c1pv = document.getElementById('c1pv');
    if (c1pct && c1pv) c1pv.textContent = c1pct.value + '%';
    if (s._activeTab) {
      activeTab = s._activeTab;
      const btns = document.querySelectorAll('.row-segmented button');
      btns.forEach(b => { const txt = b.textContent.trim().toLowerCase(); b.classList.toggle('on', (s._activeTab === 'manual' && txt.includes('direct')) || (s._activeTab === 'compute' && txt.includes('compute'))); });
      document.querySelectorAll('.tp').forEach(p => p.classList.remove('on'));
      const tp = document.getElementById('tp_' + s._activeTab); if (tp) tp.classList.add('on');
    }
    if (window.UI && typeof UI.switchMainTab === 'function') UI.switchMainTab(s._activeMainTab || 'pipe');
  },

  saveCurrentState() {
    if (!this.activeId || !this.projects[this.activeId]) return;
    const proj = this.projects[this.activeId];
    proj.formState = this._captureForm(); proj.modified = new Date().toISOString();
    try { proj.last = LAST ? JSON.parse(JSON.stringify(LAST)) : null; proj.reportList = REPORT_LIST ? JSON.parse(JSON.stringify(REPORT_LIST)) : []; } catch(e) { proj.last = null; proj.reportList = []; }
    this._saveAsync(); this._flashSaved();
  },

  _restoreState(id) {
    const proj = this.projects[id]; if (!proj) return;
    LAST = null; LAST_FLANGE = null; REPORT_LIST = []; _ACTIVE_QUEUE_IDX = null;
    // If the project has no real saved state, just reset the UI to HTML defaults
    const hasState = proj.formState && Object.keys(proj.formState).length > 0;
    if (!hasState) {
      _resetFormToDefaults();
    } else {
      try { this._restoreForm(proj.formState); } catch(e) { console.warn('PM._restoreForm failed:', e); }
    }
    if (Array.isArray(proj.reportList)) { REPORT_LIST = proj.reportList; if (typeof renderReportList === 'function') renderReportList(); }
    if (proj.last) {
      LAST = proj.last;
      const presetKey = (proj.formState || {}).matPreset;
      if (presetKey && presetKey !== 'custom' && typeof MATS !== 'undefined') LAST.matObj = MATS[presetKey] || null;
      try { if (typeof renderResults === 'function') renderResults(LAST); } catch(e) { console.warn('Could not restore results:', e); }
    } else {
      const tab = document.getElementById('tab-pipe');
      if (tab) {
        tab.innerHTML = '<div class="ph"><svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:.25"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg><p data-i18n="ph.enter">Enter parameters and press Calculate</p><div class="ph-meta">EN 13480-3:2024 · §6.1 Straight Pipes</div></div>';
        if (window.UI && typeof UI.setLang === 'function') UI.setLang(localStorage.getItem('ps-lang') || 'da');
      }
    }
  },

  createProject(name, switchTo = true) {
    const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    this.projects[id] = { id, name: name || 'Nyt projekt', created: new Date().toISOString(), modified: new Date().toISOString(), lastAccessed: new Date().toISOString(), formState: {}, last: null, reportList: [] };
    if (switchTo) { this.saveCurrentState(); this.activeId = id; this._saveAsync(); this.renderSidebar(); this._restoreState(id); }
    else { this._saveAsync(); }
    return id;
  },

  deleteProject(id) {
    if (Object.keys(this.projects).length <= 1) { alert('Du kan ikke slette det sidste projekt.'); return; }
    if (!confirm('Slet projektet "' + this.projects[id].name + '"?')) return;
    delete this.projects[id];
    if (this.activeId === id) this.activeId = Object.keys(this.projects).sort((a, b) => new Date(this.projects[b].lastAccessed || this.projects[b].modified) - new Date(this.projects[a].lastAccessed || this.projects[a].modified))[0];
    this._saveAsync(); this.renderSidebar(); this._restoreState(this.activeId);
  },

  switchProject(id) {
    if (id === this.activeId) return;
    this.saveCurrentState(); this.activeId = id;
    if (this.projects[id]) this.projects[id].lastAccessed = new Date().toISOString();
    this._saveAsync(); this.renderSidebar(); this._restoreState(id);
  },

  promptCreate() {
    if (window.UI && typeof UI.openNewProject === 'function') {
      const n = Object.keys(this.projects).length + 1;
      UI.openNewProject();
      setTimeout(() => { const inp = document.querySelector('#new-proj-modal input[type=text]'); if (inp) { inp.value = 'Projekt ' + n; inp.focus(); inp.select(); } }, 80);
    } else {
      const n = Object.keys(this.projects).length + 1;
      const name = window.prompt('Projektnavn:', 'Projekt ' + n);
      if (name !== null) this.createProject(name.trim() || ('Projekt ' + n));
    }
  },

  renderSidebar() {
    const list = document.getElementById('proj-list'); if (!list) return;
    const sorted = Object.values(this.projects).sort((a, b) => new Date(b.lastAccessed || b.modified) - new Date(a.lastAccessed || a.modified));
    list.innerHTML = sorted.map(p => {
      const active   = p.id === this.activeId ? ' active' : '';
      const safeName = (p.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `<div class="proj-item${active}" id="pitem-${p.id}" onclick="PM.switchProject('${p.id}')">
          <span class="proj-item-name" ondblclick="PM.startRename('${p.id}',event)">${safeName}</span>
          <input class="proj-item-edit" id="pedit-${p.id}" type="text" value="${safeName}"
            onblur="PM.finishRename('${p.id}')" onkeydown="PM.renameKey('${p.id}',event)" onclick="event.stopPropagation()">
          <button class="proj-item-del" onclick="event.stopPropagation();PM.deleteProject('${p.id}')" title="Slet">×</button>
      </div>`;
    }).join('');
  },

  startRename(id, e) {
    e.stopPropagation();
    const nameEl = document.querySelector('#pitem-' + id + ' .proj-item-name');
    const editEl = document.getElementById('pedit-' + id);
    if (!nameEl || !editEl) return;
    nameEl.style.display = 'none';
    editEl.style.display = 'inline-block';
    editEl.style.flex = '1';
    editEl.focus(); editEl.select();
  },
  finishRename(id) {
    const nameEl = document.querySelector('#pitem-' + id + ' .proj-item-name');
    const editEl = document.getElementById('pedit-' + id); if (!editEl) return;
    const newName = editEl.value.trim() || 'Uden navn';
    this.renameProject(id, newName);
    if (nameEl) { nameEl.textContent = newName; nameEl.style.display = ''; }
    editEl.style.display = 'none';
  },
  renameProject(id, newName) {
    if (!this.projects[id]) return;
    this.projects[id].name = (newName || '').trim() || 'Uden navn'; this.projects[id].modified = new Date().toISOString();
    this._saveAsync(); this.renderSidebar();
  },
  renameKey(id, e) {
    if (e.key === 'Enter') this.finishRename(id);
    if (e.key === 'Escape') { const nameEl = document.querySelector('#pitem-' + id + ' .proj-item-name'); const editEl = document.getElementById('pedit-' + id); if (nameEl) nameEl.style.display = ''; if (editEl) editEl.style.display = 'none'; }
  },

  _flashSaved() {
    const el = document.getElementById('proj-autosave-txt'); if (!el) return;
    const now = new Date();
    el.textContent = 'Gemt ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
    el.style.color = '#27ae60';
    clearTimeout(PM._flashTimer);
    PM._flashTimer = setTimeout(() => { if (el) { el.textContent = 'Auto-gem aktiv'; el.style.color = ''; } }, 3000);
  },

  toggleSidebar() { if (window.UI && typeof UI.toggleSidebar === 'function') UI.toggleSidebar(); },

  _restoreSidebarState() {
    const collapsed = localStorage.getItem('pipeCalc_sidebarCollapsed') === '1';
    if (collapsed) {
      const sidebar = document.getElementById('projSidebar'); const btn = document.getElementById('sidebar-toggle-btn');
      if (sidebar) sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
      if (btn) btn.style.opacity = '0.45';
    }
  },

  async init() {
    // Version check — only relevant for localStorage fallback path
    const savedVer = localStorage.getItem(_VER_KEY);
    if (savedVer !== _STORAGE_VER) {
      localStorage.removeItem(_PROJ_KEY);
      localStorage.removeItem(_ACTIVE_KEY);
      localStorage.setItem(_VER_KEY, _STORAGE_VER);
    }

    await this._loadAsync();

    if (!Object.keys(this.projects).length && this._serverHasData) {
      // Server confirmed empty (first ever launch) — create one blank project
      const id = this.createProject('Nyt projekt', false);
      this.activeId = id;
      await this._saveAsync();
    }
    if (!this.activeId || !this.projects[this.activeId]) {
      this.activeId = Object.keys(this.projects).sort((a, b) => new Date(this.projects[b].lastAccessed || this.projects[b].modified) - new Date(this.projects[a].lastAccessed || this.projects[a].modified))[0];
    }
    this.renderSidebar();
    this._restoreState(this.activeId);
    this._restoreSidebarState();
    setInterval(() => PM.saveCurrentState(), 60000);
    window.addEventListener('beforeunload', () => PM.saveCurrentState());
  }
};
window.PM = PM;

// ── PATCH UI OBJECT & WIRE ENGINE EVENTS ──────────────────────────────────────
(function _engineInit() {
  async function run() {
    // Expand tooltip dictionary with all engine keys
    if (window.TT) {
      const extra = {
        man_od:      { t: 'YDRE DIAMETER Do', b: 'Rørdiameteren målt på ydersiden. Bruges direkte i trykberegningsformlen.', r: 'EN 13480-3 §6.1' },
        man_wt:      { t: 'NOMINEL VÆGTYKKELSE en', b: 'Faktisk bestilte/målte vægtykkelse. Analysetykkelse ea = en minus alle tillæg.', r: 'EN 13480-3 §4.3' },
        steelType:   { t: 'STÅLTYPE', b: 'Ferritic §5.2.1: f = min(Rp0,2t/1,5 , Rm_t/2,4)\nAustenitic §5.2.2 Opt.1: f = Rp1,0t/1,5\nAustenitic §5.2.2 Opt.2: f = min(Rp1,0t/1,2 , Rm_t/3)', r: 'EN 13480-3 §5.2.1 og §5.2.2' },
        aust522opt:  { t: '§5.2.2 OPTION — AUSTENITISK', b: 'Option 1: f = Rp1,0t / 1,5 — Rm_t ikke påkrævet.\nOption 2: f = min(Rp1,0t / 1,2 , Rm_t / 3) — Kræver Rm_t.', r: 'EN 13480-3 §5.2.2 Eq. 5.2.2-1' },
        Rm:          { t: 'TRÆKSTYRKE Rm', b: 'Max trækstyrke inden brud. Calculatoren interpolerer Rm_t ved designtemperaturen.', r: 'EN 10028-7:2016 Tabel 15' },
        ReH:         { t: 'FLYDEGRÆNSE ReH / Rp0,2', b: 'Spænding ved begyndelse af plastisk deformation. SF = 1,5.', r: 'EN 13480-3 §5.2.1-1' },
        Rp10:        { t: '1%-FLYDESPÆNDING Rp1,0t', b: 'Spænding ved 1% plastisk deformation. Bruges som designgrundlag for austenitiske stål.', r: 'EN 13480-3 §5.2.2, EN 10028-7:2016 Tabel 13' },
        c0:          { t: 'KORROSIONSTILLÆG c₀', b: 'Reserveret tykkelse til korrosion/erosion over levetiden.\nRustfrit stål i damp/vand: typisk 0 mm.\nKarbonstål i vand: typisk 1–3 mm.', r: 'EN 13480-3 §4.3' },
        c1Type:      { t: 'MØLLETOLERANCE c₁', b: 'Kompensation for produktionstolerance.\nProcentuel (12,5%): eord divideres med (1−0,125).\nFast (mm): absolut tolerance fra leverandør.', r: 'EN 13480-3 §4.3 Eq. 4.3-5' },
        c2:          { t: 'TYNDINGTILLÆG c₂', b: 'Kompenserer for udtynding ved formgivning (bøjning/presning). For lige rør: c₂ = 0 mm.', r: 'EN 13480-3 §4.3, §6.2' },
        bend_angle:  { t: 'BØJNINGSVINKEL', b: 'Formlen §6.2.3.1 er uafhængig af vinkel — gælder for alle bøjningsvinkler med radius R.', r: 'EN 13480-3 §6.2.3.1' },
        bend_R:      { t: 'BØJNINGSRADIUS R', b: 'Centerlinjeradius i mm.\n1,5×Do = short radius\n3×Do = long radius', r: 'EN 13480-3 §6.2.2' },
        bend_od:     { t: 'RØRDIAMETER Do', b: 'Ydre diameter af det rør der bøjes. Udfyldes automatisk fra pipe calc.', r: 'EN 13480-3 §6.2.3.1' },
        red_dlarge:  { t: 'STOR ENDE Do_large', b: 'Ydre diameter på den store ende — altid den styrende.', r: 'EN 13480-3 §6.4.4' },
        red_dsmall:  { t: 'LILLE ENDE Do_small', b: 'Ydre diameter på den lille ende af reduktionen.', r: 'EN 13480-3 §6.4.4' },
        red_L:       { t: 'KEGLENS LÆNGDE L', b: 'Aksial længde af den koniske del.\nα = arctan((D_large − D_small) / (2 × L))', r: 'EN 13480-3 §6.4.4' },
        tee_type:    { t: 'T-STYKKE TYPE', b: 'Forged: standard produkt per EN 10253 — ingen trykberegning nødvendig.\nFabricated: beregning per §8 påkrævet.', r: 'EN 13480-3 §6.6.3, §8.4' },
        tee_header:  { t: 'HEADER OD', b: 'Ydre diameter af den rørledning grenen tilsluttes. Bruges til åbningsratio di/Di.', r: 'EN 13480-3 §8.3.1' },
        tee_branch:  { t: 'GREN OD', b: 'Ydre diameter af afgreningsrøret.', r: 'EN 13480-3 §8.4' },
        flange_mat:  { t: 'MATERIALEGRUPPE', b: 'Materialegruppe per EN 1092-1 Annex G.\n3E0: P235GH/P265GH\n14E0: 1.4401/AISI 316\n13E0: 1.4404/AISI 316L\n11E0: 1.4301/AISI 304', r: 'EN 1092-1:2018 Annex G' },
        flange_pn:   { t: 'PN-KLASSE', b: 'Calculatoren finder automatisk laveste tilstrækkelige PN.\nPN-rating aftager med temperaturen — interpoleres fra Annex G.', r: 'EN 1092-1:2018 §6.6.3 + Annex G' },
        flange_type: { t: 'FLANGETYPE', b: 'Type 11: Svejsehals — standard for trykbærende systemer.\nType 01: Planflange / blindflange.\nType 13: Gevindflange (BSP ISO 228-1) — max PN 100 (DN10–DN150).', r: 'EN 1092-1:2018' },
        dn_field:    { t: 'DN (NOMINEL DIAMETER)', b: 'Nominel rørdiameter. Beregnes automatisk fra OD hvis tomt.', r: '' },
      };
      Object.assign(window.TT, extra);
    }

    // Patch UI methods
    if (window.UI) {
      UI.calculate = function () {
        if (document.getElementById('batchEnabled')?.checked) runBatchCalculate();
        else calculate();
      };
      UI.applyPreset    = applyPreset;
      UI.toggleSteelRows= toggleSteelRows;
      UI.switchTab      = function (which, btn) { switchTab(which, btn); };

      // Override openReport/closeReport to use report.js functions
      UI.openReport  = function () { if (typeof openReportModal  === 'function') openReportModal();  else document.getElementById('report-modal').classList.add('open'); };
      UI.closeReport = function () { if (typeof closeReportModal === 'function') closeReportModal(); else document.getElementById('report-modal').classList.remove('open'); };

      // AI: adapt to new panel (no backdrop)
      UI.openAI = function () {
        document.getElementById('ai-panel').classList.add('open');
        document.querySelector('.ai-open-btn')?.classList.add('on');
      };
      UI.closeAI = function () {
        document.getElementById('ai-panel').classList.remove('open');
        document.querySelector('.ai-open-btn')?.classList.remove('on');
      };
      UI.toggleAI = function () {
        const open = document.getElementById('ai-panel').classList.contains('open');
        if (open) UI.closeAI(); else UI.openAI();
      };

      // Extend switchMainTab to call populateFittingsFromPipe
      const _origSwitchMain = UI.switchMainTab.bind(UI);
      UI.switchMainTab = function (which) {
        _origSwitchMain(which);
        if (which === 'fittings') populateFittingsFromPipe();
      };
    }

    // Wire stress tab recompute listeners
    ['Rm', 'ReH', 'Rp10', 'sf_re', 'sf_rm'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', recomputeF);
    });
    // §5.2.2 option
    document.getElementById('aust522opt')?.addEventListener('change', toggleAust522);
    // Water phase
    document.getElementById('pressure')?.addEventListener('input', updateWaterPhase);
    document.getElementById('temperature')?.addEventListener('input', updateWaterPhase);
    document.getElementById('fluidType')?.addEventListener('change', updateWaterPhase);
    updateWaterPhase();
    // PED category live display
    document.getElementById('pressure')?.addEventListener('input', updatePedDisplay);
    document.getElementById('fluidType')?.addEventListener('change', updatePedDisplay);
    document.getElementById('npsSelect')?.addEventListener('change', updatePedDisplay);
    document.getElementById('dn_input')?.addEventListener('input', updatePedDisplay);
    document.getElementById('man_od')?.addEventListener('input', updatePedDisplay);
    document.getElementById('catOverride')?.addEventListener('change', updatePedDisplay);
    updatePedDisplay();

    // Fittings calculate buttons (wire by text content)
    document.querySelectorAll('#tab-fittings button.calc-btn').forEach(btn => {
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('bend'))    btn.onclick = () => { if (typeof calcBend    === 'function') calcBend(); };
      else if (txt.includes('reducer')) btn.onclick = () => { if (typeof calcReducer === 'function') calcReducer(); };
      else if (txt.includes('t-piece') || txt.includes('t piece')) btn.onclick = () => { if (typeof calcTee === 'function') calcTee(); };
      else if (txt.includes('flange')) btn.onclick = () => { if (typeof calcFlange === 'function') calcFlange(); };
    });

    // Wire new-project modal Create button
    const newProjModal = document.getElementById('new-proj-modal');
    const createBtn = newProjModal?.querySelector('.btn-primary');
    if (createBtn && !createBtn._engineWired) {
      createBtn._engineWired = true;
      createBtn.onclick = function () {
        const inp  = newProjModal.querySelector('input[type=text]');
        const name = inp ? inp.value.trim() : '';
        PM.createProject(name || 'Nyt projekt');
        if (window.UI) UI.closeNewProject();
      };
    }

    // Wire report modal generate button
    const rptBtn = document.getElementById('rpt-gen-btn');
    if (rptBtn && !rptBtn._engineWired) {
      rptBtn._engineWired = true;
      rptBtn.addEventListener('click', () => { if (typeof generateReport === 'function') generateReport(); });
    }

    // Wire AI send/file/clear (if ai.js not yet loaded, AI.xxx may be undefined — safe)
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn && !sendBtn._engineWired) {
      sendBtn._engineWired = true;
      sendBtn.addEventListener('click', () => { window.AI?.send(); });
    }
    const fileInput = document.getElementById('ai-file-input');
    if (fileInput && !fileInput._engineWired) {
      fileInput._engineWired = true;
      fileInput.addEventListener('change', function () { Array.from(this.files).forEach(f => window.AI?.handleFileUpload(f)); this.value = ''; });
    }

    // Init NPS select (overwrites static options with properly-valued ones)
    initNpsSelect();

    // Init PM
    try { await PM.init(); } catch(e) { console.error('PM.init failed:', e); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); }
  else { run(); }

  // Auto-save patch after PM.init runs calculate()
  window.addEventListener('load', () => {
    const _origCalc = window.calculate;
    window.calculate = function () {
      _origCalc.apply(this, arguments);
      try { PM.saveCurrentState(); } catch(e) {}
    };
    // Init AI after everything is ready
    if (window.AI && typeof AI.init === 'function') {
      try { AI.init(); } catch(e) { console.warn('AI.init:', e); }
      // Hook PM project switches → save/load chat per project
      const _origSave    = PM.saveCurrentState.bind(PM);
      const _origRestore = PM._restoreState.bind(PM);
      PM.saveCurrentState = function () { try { AI._saveChat?.(); } catch(e) {} _origSave(); };
      PM._restoreState    = function (id) { _origRestore(id); setTimeout(() => { try { AI._loadChat?.(id); } catch(e) {} }, 50); };
    }
  });
})();

// Expose toggleBatchUI alias for AI module (_runSections calls it)
window.toggleBatchUI = function () { if (window.UI) UI.toggleBatch(); };
