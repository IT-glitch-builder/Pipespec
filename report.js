/* report.js — PipeSpec report generation
   Lifted from Pipeline motor/Pipeline_Calculator_EN13480_Fixed.html
   Functions: formatDate (ln 2057), openReportModal (ln 2046),
   closeReportModal (ln 2055), generateReport (ln 2064)
*/

function formatDate(date) {
  date = date || new Date();
  const day   = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return day + '.' + month + '.' + date.getFullYear();
}

function openReportModal() {
  const m = document.getElementById('report-modal');
  m.classList.add('open');
  const hasData = (typeof REPORT_LIST !== 'undefined' && REPORT_LIST.length > 0) || (typeof LAST !== 'undefined' && LAST !== null);
  document.getElementById('rpt-warn').style.display = hasData ? 'none' : '';
  const btn = document.getElementById('rpt-gen-btn');
  const count = typeof REPORT_LIST !== 'undefined' ? REPORT_LIST.length : 0;
  btn.textContent = count > 0
    ? '⬇ Generer rapport (' + count + ' beregning' + (count > 1 ? 'er' : '') + ')'
    : '⬇ Generer rapport (aktuel beregning)';
}

function closeReportModal() {
  document.getElementById('report-modal').classList.remove('open');
}

async function generateReport() {
  const entries = (typeof REPORT_LIST !== 'undefined' && REPORT_LIST.length > 0) ? REPORT_LIST : (typeof LAST !== 'undefined' && LAST ? [LAST] : []);
  if (!entries.length) { document.getElementById('rpt-warn').style.display = ''; return; }

  const proj   = document.getElementById('rpt-proj').value   || '—';
  const num    = document.getElementById('rpt-num').value     || '—';
  const rev    = document.getElementById('rpt-rev').value     || 'Rev. A';
  const by     = document.getElementById('rpt-by').value      || '—';
  const client = document.getElementById('rpt-client').value  || '—';
  const s1 = document.getElementById('rpt-s1').checked;
  const s2 = document.getElementById('rpt-s2').checked;
  const s3 = document.getElementById('rpt-s3')?.checked ?? true;
  const s4 = document.getElementById('rpt-s4')?.checked ?? true;
  const s5 = document.getElementById('rpt-s5')?.checked ?? true;
  const s6 = document.getElementById('rpt-s6')?.checked ?? true;

  const btn = document.getElementById('rpt-gen-btn');
  btn.textContent = '⏳ Genererer Word-fil...';
  btn.disabled = true;

  // Build clean entries for server
  const cleanEntries = entries.map(r => {
    if (r.type === 'flange') {
      const pnRows = [];
      try {
        const tmp = document.createElement('tbody');
        tmp.innerHTML = r.pnTableRows || '';
        tmp.querySelectorAll('tr').forEach(tr => {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 3) return;
          const pnText = tds[0].textContent.replace('★','').trim().replace('PN ','');
          const ps = parseFloat(tds[1].textContent);
          const ok = tds[2].textContent.includes('✓');
          const selected = tr.className.includes('rec-row');
          pnRows.push({ pn: parseInt(pnText) || 0, ps, ok, selected });
        });
      } catch(e) {}
      return { ...r, pnRows };
    }
    return {
      ...r,
      lookupPipeDN:   r.lookupPipe ? r.lookupPipe.dn : null,
      matObjName:     r.matObj ? r.matObj.name : null,
      steelTypeLabel: r.sf_info?.steelType === 'austenitic' ? 'Austenitisk (§5.2.2)' : 'Ferritisk (§5.2.1)',
      waterPhase: (() => {
        if (r.fluid !== 'liq1' && r.fluid !== 'liq2') return null;
        const T_sat = +(1810.94 / (8.14019 - Math.log10(r.pc_bar * 750.062)) - 244.485).toFixed(1);
        let label;
        if (r.tc < T_sat)        label = 'Flydende vand (subcooled liquid)';
        else if (r.tc === T_sat) label = 'Mættet damp / kogepunktet';
        else                     label = 'Damp (superheated steam)';
        return { T_sat, label };
      })()
    };
  });

  // Try Word server
  const serverCandidates = [
    `${location.protocol}//${location.hostname || 'localhost'}:3001/generate-docx`,
    'http://127.0.0.1:3001/generate-docx',
    'http://localhost:3001/generate-docx'
  ].filter((url, idx, arr) => url.startsWith('http') && arr.indexOf(url) === idx);

  try {
    let resp = null, lastErr = null;
    for (const url of serverCandidates) {
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meta: { proj, num, rev, by, client }, sections: { s1, s2, s4, s5, s6 }, entries: cleanEntries })
        });
        if (!resp.ok) {
          let serverMsg = 'Server fejl: ' + resp.status;
          try { const j = await resp.json(); if (j?.error) serverMsg += '\n' + j.error; } catch(_) {}
          const err = new Error(serverMsg); err.serverResponse = true; throw err;
        }
        break;
      } catch(err) { lastErr = err; if (err?.serverResponse) break; }
    }
    if (!resp) throw lastErr || new Error('Ingen forbindelse til Word-server');
    const blob  = await resp.blob();
    const dlUrl = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    const fname = `${proj.replace(/[^a-zA-Z0-9æøåÆØÅ _-]/g,'_')}_${rev.replace(/\s+/g,'_')}.docx`;
    a.href = dlUrl; a.download = fname; a.click();
    setTimeout(() => URL.revokeObjectURL(dlUrl), 10000);
    btn.textContent = '✓ Word-fil downloadet!';
    btn.style.background = '#27ae60';
    setTimeout(() => { btn.textContent = '⬇ Generer rapport (Word)'; btn.disabled = false; btn.style.background = ''; }, 3000);
    return;
  } catch(e) {
    btn.textContent = '⬇ Generer rapport (Word)';
    btn.disabled = false;
    const detailText = e?.message ? '\n\nDetaljer:\n  ' + e.message : '';
    const fallback = confirm(
      'Word-serveren kunne ikke generere rapporten.' + detailText + '\n\n'
      + 'Start serveren med:\n  cd "Pipeline motor"\n  node server.js\n\n'
      + 'Vil du i stedet åbne HTML-rapport (til print)?'
    );
    if (!fallback) return;
  }

  // ── FALLBACK: HTML RAPPORT ────────────────────────────────────────────────
  const today = formatDate();
  function tr(label,val,unit,alt){return(alt?'<tr class="alt">':'<tr>')+'<td>'+label+'</td><td><strong>'+val+'</strong></td><td>'+unit+'</td></tr>';}
  function trh(label,val,unit){return'<tr><td>'+label+'</td><td><strong style="color:#1F4E79">'+val+'</strong></td><td>'+unit+'</td></tr>';}
  function trok(label,val,unit){return'<tr class="ok-row"><td>'+label+'</td><td><strong>'+val+'</strong></td><td>'+unit+'</td></tr>';}

  const css = '*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:Arial,sans-serif;font-size:10pt;color:#000;background:#fff;line-height:1.5}'
    +'@page{size:A4;margin:20mm}'+'@media print{.no-print{display:none}}'
    +'.no-print{position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:100}'
    +'.no-print button{padding:10px 20px;font-size:11pt;font-weight:bold;cursor:pointer;border:none;border-radius:4px}'
    +'.print-btn{background:#1F4E79;color:#fff}.close-btn{background:#888;color:#fff}'
    +'.cover{text-align:center;padding:15mm 0 10mm;border-bottom:3px solid #1F4E79;margin-bottom:8mm;page-break-after:always}'
    +'.cover h1{font-size:24pt;color:#1F4E79;margin-bottom:4mm}'
    +'.cover h2{font-size:12pt;color:#2E75B6;margin-bottom:8mm;font-weight:normal}'
    +'.cover-table{width:140mm;margin:0 auto;border-collapse:collapse}'
    +'.cover-table td{padding:5px 10px;border:1px solid #ccc}'
    +'.cover-table td:first-child{background:#1F4E79;color:#fff;font-weight:bold;width:45mm}'
    +'.pipe-header{font-size:16pt;font-weight:bold;color:#1F4E79;margin:6mm 0 2mm;padding-bottom:2mm;border-bottom:3px solid #1F4E79}'
    +'h2.sec{display:block;font-size:13pt;color:#1F4E79;border-bottom:2px solid #2E75B6;padding-bottom:2mm;margin:6mm 0 3mm;font-weight:bold;page-break-after:avoid}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:4mm;font-size:9.5pt}'
    +'th{background:#1F4E79;color:#fff;padding:5px 8px;text-align:left;font-size:9pt}'
    +'td{padding:4px 8px;border:1px solid #ddd}'
    +'.formula{font-family:Courier New,monospace;font-size:9.5pt;font-weight:bold;color:#1F4E79;background:#F0F4F8;padding:4px 10px;border-left:4px solid #1F4E79;margin:2mm 0}'
    +'.formula-calc{font-family:Courier New,monospace;font-size:9pt;background:#F8F8F8;padding:3px 10px;border-left:4px solid #ccc;margin:1mm 0 2mm}'
    +'tr.alt td{background:#EEF4FB}tr.ok-row td{background:#E8F5E9}tr.rec-row td{background:#D0EBCC;font-weight:bold}'
    +'.result-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:3mm 0}'
    +'.kpi{border:1px solid #1F4E79;padding:4mm;border-radius:3px}'
    +'.kpi-label{font-size:8pt;color:#555;text-transform:uppercase}'
    +'.kpi-val{font-size:14pt;font-weight:bold;color:#1F4E79;margin:1mm 0}'
    +'.kpi-unit{font-size:8pt;color:#888}'
    +'.ped-note-box{background:#F8F9FA;border:1px solid #ccc;border-left:4px solid #2E75B6;padding:6px 10px;margin-top:3mm;font-size:9pt;color:#333;font-style:italic}'
    +'.footer-note{margin-top:10mm;border-top:1px solid #ccc;padding-top:3mm;font-size:8pt;color:#888;text-align:center}';

  let bodyHtml = '<div class="no-print"><button class="print-btn" onclick="window.print()">Print / Gem som PDF</button><button class="close-btn" onclick="window.close()">Luk</button></div>'
    + '<div class="cover"><h1>BEREGNINGSRAPPORT</h1><h2>DS/EN 13480-3:2024 — Metalliske industrielle rørledninger</h2>'
    + '<table class="cover-table"><tr><td>Projekt</td><td><strong>'+proj+'</strong></td></tr>'
    + '<tr><td>Projektnummer</td><td>'+num+'</td></tr><tr><td>Revision</td><td>'+rev+'</td></tr>'
    + '<tr><td>Udarbejdet af</td><td>'+by+'</td></tr><tr><td>Kunde</td><td>'+client+'</td></tr>'
    + '<tr><td>Dato</td><td>'+today+'</td></tr>'
    + '<tr><td>Antal beregninger</td><td><strong>'+entries.length+'</strong></td></tr>'
    + '<tr><td>Standarder</td><td>DS/EN 13480-3:2024 · EN 10028-7:2016 · EN 1092-1:2018</td></tr></table>'
    + '<div style="margin-top:8mm;color:#888;font-size:9pt;font-style:italic">EdgeWay ApS — Rasmus@edgeway.dk</div></div>';

  let needPageBreak = false;
  entries.forEach((r, idx) => {
    const isFlange = r.type === 'flange';
    if (!isFlange && idx > 0) needPageBreak = true;

    if (isFlange) {
      bodyHtml += '<h1 class="pipe-header">Beregning '+(idx+1)+' af '+entries.length+': Flange DN'+r.actualDN+' — PN '+r.selectedPN+' — '+r.pc_bar.toFixed(1)+' bar / '+r.T+'°C</h1>';
      bodyHtml += '<h2 class="sec">Flangeberegning — EN 1092-1:2018 Annex F + G</h2>';
      bodyHtml += '<table><colgroup><col style="width:42%"><col style="width:33%"><col style="width:25%"></colgroup><tr><th>Parameter</th><th>Værdi</th><th>Reference</th></tr>'
        +tr('Flangetype',r.flangeTypeLabel,'EN 1092-1:2018')
        +tr('Materialegruppe',r.matName,'EN 1092-1:2018 Tabel 9',true)
        +tr('Designtryk pc',r.pc_bar.toFixed(2)+' bar','—')
        +tr('Designtemperatur',r.T+' °C','—',true)
        +tr('DN (nominal)',r.actualDN,'—')
        +trh('Anbefalet PN-klasse','PN '+r.selectedPN,'Annex G opslag')
        +tr('PS_max ved '+r.T+'°C',r.selectedPS.toFixed(1)+' bar','EN 1092-1:2018 Annex G',true)
        +tr('Margin',((r.margin>=0?'+':'')+r.margin.toFixed(1))+' bar','—')
        +trok('Status',r.ok?'TILSTRÆKKELIG ✓':'UTILSTRÆKKELIG ✗','—')+'</table>';
      bodyHtml += '<h2 class="sec">PN-klasseoversigt</h2>'
        +'<table><tr><th>PN</th><th>PS_max ved '+r.T+'°C</th><th>OK?</th><th></th></tr>'+r.pnTableRows+'</table>'
        +'<div class="formula">PS = PN × f<sub>t</sub> / 140 MPa &nbsp;&nbsp; (EN 1092-1:2018 Annex F, Formel F.2)</div>';
      return;
    }

    const dn  = r.lookupPipe ? r.lookupPipe.dn : Math.round(r.Do * 0.8);
    const ped = r.pedResult || { cat: '—', psDN: 0, annex2table: '—', kontrolklasse: '—', catDesc: '' };
    const fLabel = {gas1:'Gas Gr. 1 (brandfarlig/giftig)',gas2:'Gas Gr. 2 (ikke-farlig)',liq1:'Liquid Gr. 1 (farlig)',liq2:'Liquid Gr. 2 (ikke-farlig)'}[r.fluid] || r.fluid || '—';

    bodyHtml += '<h1 class="pipe-header" style="'+(needPageBreak?'break-before:page;':'')+'">Beregning '+(idx+1)+' af '+entries.length+': DN'+dn+' — OD '+r.Do+' mm — '+r.pc_bar.toFixed(1)+' bar / '+r.tc+'°C</h1>';

    if (s1) {
      const matRows = r.fDerivation
        ? tr('SF på flydegrænse',r.fDerivation.sfRe,'—',true)
          +tr('SF på trækstyrke',r.fDerivation.sfRm,'—')
          +tr('Rp1,0t/Rp0,2t ved '+r.tc+'°C',String(r.fDerivation.Rp10_t||r.fDerivation.Rp02_t)+' MPa','(EN 10028-7 Tbl.13)',true)
          +tr('Rm_t ved '+r.tc+'°C',r.fDerivation.Rm_t?r.fDerivation.Rm_t+' MPa':'—','')
        : '';
      const jcNote = {1.0:'z = 1,0 — Sømløse rør eller svejste rør med 100% NDT.',0.85:'z = 0,85 — Svejste rør med stikprøve-NDT.',0.7:'z = 0,70 — Kun visuel inspektion, ingen NDT.'}[r.z]||'z = '+r.z+' — per EN 13480-3 §4.5';
      bodyHtml += '<h2 class="sec">Beregningsgrundlag</h2>'
        +'<table><colgroup><col style="width:50%"><col style="width:30%"><col style="width:20%"></colgroup><tr><th>Parameter</th><th>Værdi</th><th>Enhed</th></tr>'
        +tr('Beregningsstryk (pc)',r.pc_bar.toFixed(2),'bar')
        +tr('Beregningsstryk (pc)',r.pc.toFixed(4),'MPa',true)
        +tr('Beregningstemperatur (tc)',r.tc,'°C')
        +tr('Ydre diameter (Do)',r.Do,'mm',true)
        +tr('Svejsefaktor (z)',r.z,'—')
        +'<tr><td colspan="3" style="padding:6px 8px;background:#F0F4F8;font-size:9pt;color:#444;font-style:italic;border-bottom:1px solid #ddd;">'+jcNote+' <span style="color:#1F4E79;font-style:normal;font-weight:bold">(Ref: EN 13480-3 §4.5)</span></td></tr>'
        +tr('Korrosionstillæg (c₀)',r.c0||0,'mm',true)
        +tr('Mølletolerance (c₁)',r.c1_str,'—')
        +tr('Tyndingtillæg (c₂)',r.c2||0,'mm',true)+'</table>'
        +'<table><tr><th>Materiale</th><th>Værdi</th><th>Reference</th></tr>'
        +tr('Materialepreset',r.matObj?r.matObj.name:'Custom','—')
        +tr('Ståltype',r.sf_info?.steelType==='austenitic'?'Austenitisk (§5.2.2)':'Ferritisk (§5.2.1)','EN 13480-3',true)
        +trh('Designspænding f ved '+r.tc+'°C',r.f.toFixed(2)+' MPa','Interpoleret fra Tbl. 13')
        +matRows+'</table>';
    }

    if (s2) {
      bodyHtml += '<h2 class="sec">Vægtykkelsesberegning — §6.1</h2>'
        +'<div class="formula">e = (pc × Do) / (2 × f × z + pc)</div>'
        +'<div class="formula-calc">e = ('+r.pc.toFixed(4)+' × '+r.Do+') / (2 × '+r.f.toFixed(2)+' × '+r.z+' + '+r.pc.toFixed(4)+') = '+r.e.toFixed(3)+' mm</div>'
        +'<div class="formula-calc">eord ≥ '+r.er.toFixed(3)+' mm  |  Do/Di = '+r.ratio.toFixed(3)+' ≤ 1,7 → tyndvæg ✓</div>'
        +'<div class="result-grid">'
        +'<div class="kpi"><div class="kpi-label">Min. krævet (e)</div><div class="kpi-val">'+r.e.toFixed(3)+'</div><div class="kpi-unit">mm</div></div>'
        +'<div class="kpi"><div class="kpi-label">Min. bestilling (eord)</div><div class="kpi-val">'+r.er.toFixed(3)+'</div><div class="kpi-unit">mm</div></div>'
        +'<div class="kpi"><div class="kpi-label">Designspænding f</div><div class="kpi-val">'+r.f.toFixed(2)+'</div><div class="kpi-unit">MPa @ '+r.tc+'°C</div></div>'
        +'<div class="kpi"><div class="kpi-label">pmax</div><div class="kpi-val">'+(r.pmax?(r.pmax*10).toFixed(2):'—')+'</div><div class="kpi-unit">bar</div></div>'
        +'</div>';
    }

    if (s3 && r.schedRows && r.schedRows.length > 0 && r.lookupPipe) {
      const recRow = r.schedRows.find(row => row.ok);
      const nps    = r.lookupPipe.nps;
      const schRows = r.schedRows.map(row => {
        const isRec = recRow && row.sch === recRow.sch;
        return '<tr class="'+(isRec?'rec-row':(row.ok?'pass-row':'fail-row'))+'">'
          +'<td><strong>SCH '+row.sch+'</strong></td>'+'<td>'+row.wt.toFixed(2)+'</td>'+'<td>'+row.ea_s.toFixed(2)+'</td>'
          +'<td>'+r.e.toFixed(2)+'</td>'+'<td>'+(row.margin>=0?'+':'')+row.margin.toFixed(2)+'</td>'
          +'<td>'+(row.pmax>0?(row.pmax*10).toFixed(2):'—')+'</td>'
          +'<td>'+(isRec?'✓ ← Anbefalet':(row.ok?'✓':'✗'))+'</td></tr>';
      }).join('');
      bodyHtml += '<h2 class="sec">Schedule-oversigt — NPS '+nps+' (OD '+r.lookupPipe.od+' mm) — ANSI B36.10/B36.19</h2>'
        +(recRow?'<div class="formula">Anbefalet minimum: <strong>SCH '+recRow.sch+'</strong> — en = '+recRow.wt.toFixed(2)+' mm  |  Margin = +'+recRow.margin.toFixed(2)+' mm</div>':'<div class="formula" style="color:#c0392b">Ingen standard SCH opfylder kravet — specialvæg er påkrævet.</div>')
        +'<table><tr><th>Schedule</th><th>en (mm)</th><th>ea (mm)</th><th>e_min (mm)</th><th>Margin (mm)</th><th>pmax (bar)</th><th>OK?</th></tr>'+schRows+'</table>';
    } else if (s3 && (!r.schedRows || !r.schedRows.length) && !r.isFlange) {
      bodyHtml += '<h2 class="sec">Schedule-oversigt</h2><div class="formula" style="color:#888">Ikke tilgængelig — schedule-opslag kræver NPS-valg.</div>';
    }

    if (s4 && r.fDerivation && r.matObj) {
      const fd = r.fDerivation, iData = fd.interpData, td = r.matObj.tempData;
      let tblRows = '';
      if (iData && iData.interp) {
        const r1 = td.find(x=>x[0]===iData.t_low)||[], r2 = td.find(x=>x[0]===iData.t_high)||[];
        tblRows = '<tr><td>'+iData.t_low+'°C</td><td>'+(r1[1]||'—')+'</td><td>'+(r1[2]||'—')+'</td><td>'+(r1[3]||'—')+'</td></tr>'
          +'<tr class="alt"><td>'+iData.t_high+'°C</td><td>'+(r2[1]||'—')+'</td><td>'+(r2[2]||'—')+'</td><td>'+(r2[3]||'—')+'</td></tr>'
          +'<tr class="rec-row"><td>→ '+r.tc+'°C</td><td>'+(fd.Rp02_t||'—')+'</td><td>'+(fd.Rp10_t||'—')+'</td><td>'+(fd.Rm_t||'—')+'</td></tr>';
      } else {
        tblRows = '<tr class="rec-row"><td>'+r.tc+'°C</td><td>'+(fd.Rp02_t||'—')+'</td><td>'+(fd.Rp10_t||'—')+'</td><td>'+(fd.Rm_t||'—')+'</td></tr>';
      }
      bodyHtml += '<h2 class="sec">Materialedatabase — EN 10028-7:2016 Tabel 13</h2>'
        +'<table><tr><th>T (°C)</th><th>Rp0,2 (MPa)</th><th>Rp1,0 (MPa)</th><th>Rm (MPa)</th></tr>'+tblRows+'</table>'
        +'<div class="formula">f = Rp1,0t / '+fd.sfRe+' = '+(fd.Rp10_t||fd.Rp02_t)+' / '+fd.sfRe+' = '+r.f.toFixed(2)+' MPa</div>';
    }

    if (s5) {
      const T_sat_C = +(1810.94 / (8.14019 - Math.log10(r.pc_bar * 750.062)) - 244.485).toFixed(1);
      const isLiquid = (r.fluid === 'liq1' || r.fluid === 'liq2');
      let waterPhaseRow = '';
      if (isLiquid) {
        let phaseLabel, phaseNote;
        if (r.tc < T_sat_C)        { phaseLabel = 'Flydende vand (subcooled liquid)'; phaseNote = 'Tₛₐₜ = '+T_sat_C+'°C — Tdesign er '+(T_sat_C-r.tc).toFixed(1)+'°C under kogepunktet'; }
        else if (r.tc === T_sat_C) { phaseLabel = 'Mættet damp / kogepunktet'; phaseNote = 'Tdesign er præcis på damptrykskurven ved '+r.pc_bar+' bar'; }
        else                       { phaseLabel = 'Damp (superheated steam)'; phaseNote = 'Tₛₐₜ = '+T_sat_C+'°C — Tdesign er '+(r.tc-T_sat_C).toFixed(1)+'°C over kogepunktet'; }
        waterPhaseRow = tr('Tₛₐₜ ved '+r.pc_bar+' bar',T_sat_C+' °C','[Antoine]',true)+tr('Vandfase',phaseLabel,'—')
          +'<tr><td colspan="3" style="padding:5px 8px;font-size:9pt;color:#555;font-style:italic;background:#F8F9FA;">'+phaseNote+'</td></tr>';
      }
      bodyHtml += '<h2 class="sec">PED-klassificering — PED 2014/68/EU Annex II</h2>'
        +'<table><colgroup><col style="width:50%"><col style="width:30%"><col style="width:20%"></colgroup><tr><th>Parameter</th><th>Værdi</th><th>Enhed</th></tr>'
        +tr('DN',dn,'—')+tr('PS (beregningstryk)',r.pc_bar.toFixed(2),'bar',true)
        +tr('PS × DN (produkttal)',ped.psDN.toFixed(0),'—')+tr('Fluidtype',fLabel,'—',true)
        +waterPhaseRow+tr('Annex II reference',ped.annex2table,'—')
        +trok('PED-kategori','KATEGORI '+ped.cat,'—')+tr('Kontrolklasse (DK)','Kontrolklasse '+ped.kontrolklasse,'—',true)
        +(r.catIsOverride?tr('OBS','Manuel kategori-override','—'):'')+'</table>'
        +'<div class="ped-note-box">'+ped.catDesc+'</div>';
    }
  });

  if (s6) {
    bodyHtml += '<h2 class="sec" style="break-before:page;">Referencer</h2>'
      +'<table><tr><th>Standard</th><th>Titel</th></tr>'
      +'<tr><td><strong>DS/EN 13480-3:2024</strong></td><td>Metalliske industrielle rørledninger — Del 3: Konstruktion og beregning</td></tr>'
      +'<tr class="alt"><td>EN 10028-7:2016</td><td>Fladfabrikater af stål til trykformål — Del 7: Rustfrit stål</td></tr>'
      +'<tr><td>EN 1092-1:2018</td><td>Flanger og flangesamlinger — Runde flanger til rør, PN-betegnede</td></tr>'
      +'<tr class="alt"><td>ANSI B36.10 / B36.19</td><td>Welded and Seamless Wrought Steel Pipe</td></tr>'
      +'<tr><td>PED 2014/68/EU</td><td>Pressure Equipment Directive</td></tr>'
      +'</table>';
  }

  bodyHtml += '<div class="footer-note">Rapport udarbejdet med EdgeWay Pipeline Calculator — DS/EN 13480-3:2024<br>EdgeWay ApS | Rasmus@edgeway.dk | '+today+'</div>';

  const doc = document.implementation.createHTMLDocument('Rapport');
  const styleEl = doc.createElement('style'); styleEl.textContent = css; doc.head.appendChild(styleEl);
  doc.title = 'Beregningsrapport — ' + proj;
  doc.body.innerHTML = bodyHtml;
  const blob = new Blob(['<!DOCTYPE html>' + doc.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
  const dlUrl = URL.createObjectURL(blob);
  btn.innerHTML = '';
  const link = document.createElement('a');
  link.href = dlUrl; link.target = '_blank'; link.rel = 'noopener';
  link.textContent = '⬇ Klik her for at åbne rapporten';
  link.style.cssText = 'color:#000;font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;display:block;text-align:center';
  btn.appendChild(link);
  setTimeout(() => URL.revokeObjectURL(dlUrl), 60000);
}
