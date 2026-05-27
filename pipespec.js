/* ─────────────────────────────────────────────────────────────────────────
   PipeSpec — Prototype interactions only (no calc engine, no API calls)
   ───────────────────────────────────────────────────────────────────── */

const UI = {

  /* ── THEME ─────────────────────────────────────────────────────────── */
  setTheme(mode) {
    const root = document.documentElement;
    if (mode === 'auto') {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', mode);
    }
    document.querySelectorAll('.tseg').forEach(b => b.classList.remove('on'));
    const btn = document.getElementById('tseg-' + mode);
    if (btn) btn.classList.add('on');
    // sync tweaks panel theme toggle
    document.querySelectorAll('#tw-theme button').forEach(b => {
      b.classList.toggle('on', b.dataset.t === (mode === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode));
    });
    localStorage.setItem('ps-theme', mode);
  },

  /* ── SIDEBAR ───────────────────────────────────────────────────────── */
  toggleSidebar() {
    const sb = document.getElementById('projSidebar');
    const collapsed = sb.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
  },

  /* ── STANDARDS POPOVER ─────────────────────────────────────────────── */
  toggleStd() {
    document.getElementById('std-popover').classList.toggle('open');
  },

  /* ── INPUT METHOD ──────────────────────────────────────────────────── */
  toggleMethod() {
    const m = document.getElementById('inputMethod').value;
    document.getElementById('npsBlock').style.display = (m === 'nps') ? 'block' : 'none';
    document.getElementById('odBlock').style.display  = (m === 'od_only') ? 'block' : 'none';
    document.getElementById('manBlock').style.display = (m === 'manual') ? 'block' : 'none';
  },

  /* ── PED category override ─────────────────────────────────────────── */
  toggleCatOverride() {
    const on = document.getElementById('catOverride').checked;
    document.getElementById('catAutoDisplay').style.display = on ? 'none' : 'block';
    document.getElementById('catManualSelect').style.display = on ? 'block' : 'none';
  },

  /* ── Steel type rows ───────────────────────────────────────────────── */
  toggleSteelRows() {
    const s = document.getElementById('steelType').value;
    const aust = (s === 'austenitic');
    document.getElementById('aust522block').style.display = aust ? 'block' : 'none';
    document.getElementById('row_ferritic').style.display = aust ? 'none' : 'grid';
    document.getElementById('row_aust').style.display = aust ? 'grid' : 'none';
    // tweak labels
    document.getElementById('sf_re_label').textContent =
      aust ? 'SF on proof (Rp1.0)' : 'SF on yield (Re)';
    document.getElementById('sf_note').innerHTML =
      aust
      ? 'Austenitic §5.2.2: <span style="color:var(--info)">Rp1,0 ÷ 1.5</span> · <span style="color:var(--info)">Rm ÷ 3.0</span>'
      : 'Standard ferritic: <span style="color:var(--info)">Re ÷ 1.5</span> · <span style="color:var(--info)">Rm ÷ 2.4</span>';
  },

  /* ── Material preset → applies steel type + suggested values ───────── */
  applyPreset() {
    const v = document.getElementById('matPreset').value;
    const aust = /^1\.4(30|40|42|46|54|57)/.test(v);
    document.getElementById('steelType').value = aust ? 'austenitic' : 'ferritic';
    this.toggleSteelRows();
  },

  /* ── Tabs inside material block (Manual / Compute) ─────────────────── */
  switchTab(which, btn) {
    document.querySelectorAll('.tabs .tb').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById('tp_manual').classList.toggle('on', which === 'manual');
    document.getElementById('tp_compute').classList.toggle('on', which === 'compute');
  },

  /* ── Mill tolerance type ───────────────────────────────────────────── */
  toggleC1() {
    const t = document.getElementById('c1Type').value;
    document.getElementById('c1pRow').style.display = (t === 'percent') ? 'grid' : 'none';
    document.getElementById('c1fRow').style.display = (t === 'fixed') ? 'grid' : 'none';
  },

  /* ── Batch ─────────────────────────────────────────────────────────── */
  toggleBatch() {
    document.getElementById('batchUI').style.display =
      document.getElementById('batchEnabled').checked ? 'block' : 'none';
  },

  /* ── Calculate (mock — flips banner state for demo) ────────────────── */
  calculate() {
    // Not wired to the real engine — this is a hi-fi UI prototype.
    // The real app's calculate() drives the results render.
    const btn = event.currentTarget;
    if (btn) {
      const txt = btn.textContent;
      btn.textContent = 'Calculating…';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = txt; btn.disabled = false; }, 700);
    }
  },

  /* ── Main result tabs (Straight Pipe / Fittings) ───────────────────── */
  switchMainTab(which) {
    document.querySelectorAll('.main-tabs .htb').forEach(b => b.classList.remove('on'));
    document.getElementById('htab-' + which + '-btn').classList.add('on');
    document.getElementById('tab-pipe').style.display = (which === 'pipe') ? 'block' : 'none';
    document.getElementById('tab-fittings').style.display = (which === 'fittings') ? 'block' : 'none';
  },

  /* ── AI drawer ─────────────────────────────────────────────────────── */
  openAI() {
    document.getElementById('ai-backdrop').classList.add('open');
    document.getElementById('ai-panel').classList.add('open');
  },
  closeAI() {
    document.getElementById('ai-backdrop').classList.remove('open');
    document.getElementById('ai-panel').classList.remove('open');
  },

  /* ── Report modal ──────────────────────────────────────────────────── */
  openReport()  { document.getElementById('report-modal').classList.add('open'); },
  closeReport() { document.getElementById('report-modal').classList.remove('open'); },

  /* ── New project modal ─────────────────────────────────────────────── */
  openNewProject() {
    document.getElementById('new-proj-modal').classList.add('open');
    setTimeout(() => {
      const inp = document.getElementById('new-proj-name');
      if (inp) { inp.value = ''; inp.focus(); }
    }, 50);
  },
  closeNewProject() {
    document.getElementById('new-proj-modal').classList.remove('open');
    const inp = document.getElementById('new-proj-name');
    if (inp) inp.value = '';
  },
  createProject() {
    const inp = document.getElementById('new-proj-name');
    const name = inp ? inp.value.trim() : '';
    if (!name) { if (inp) inp.focus(); return; }

    const list = document.getElementById('proj-list');
    const div = document.createElement('div');
    div.className = 'proj-item active';
    div.innerHTML = `<span class="proj-item-name">${name}</span><button class="proj-item-del">×</button>`;

    list.querySelectorAll('.proj-item').forEach(x => x.classList.remove('active'));
    div.addEventListener('click', e => {
      if (e.target.closest('.proj-item-del')) { e.stopPropagation(); div.remove(); return; }
      list.querySelectorAll('.proj-item').forEach(x => x.classList.remove('active'));
      div.classList.add('active');
    });

    list.prepend(div);
    this.closeNewProject();
  },

  /* ── Tweaks panel ──────────────────────────────────────────────────── */
  toggleTweaks() { document.getElementById('tweaks-panel').classList.toggle('open'); },
};
window.UI = UI;

/* ── TOOLTIP SYSTEM ────────────────────────────────────────────────────── */
(() => {
  const tip = document.getElementById('tooltip');
  const tT = document.getElementById('tt-title');
  const tB = document.getElementById('tt-body');
  const tR = document.getElementById('tt-ref');
  let lastTarget = null;

  document.addEventListener('mouseover', e => {
    const t = e.target.closest('.tip');
    if (!t) return;
    const key = t.dataset.tip;
    const data = (window.TT && window.TT[key]) || null;
    if (!data) return;
    tT.textContent = data.t || key;
    tB.textContent = data.b || '';
    if (data.r) { tR.textContent = data.r; tR.style.display = 'block'; } else { tR.style.display = 'none'; }
    const r = t.getBoundingClientRect();
    tip.style.display = 'block';
    const tw = 270, gap = 10;
    let x = r.left + r.width + gap;
    if (x + tw > window.innerWidth - 12) x = r.left - tw - gap;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = (r.top - 6) + 'px';
    lastTarget = t;
  });
  document.addEventListener('mouseout', e => {
    if (lastTarget && !e.relatedTarget?.closest?.('.tip,#tooltip')) {
      tip.style.display = 'none'; lastTarget = null;
    }
  });
})();

/* ── TWEAKS WIRING ─────────────────────────────────────────────────────── */
(() => {
  // Accent swatches
  document.querySelectorAll('#tw-accent .tw-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tw-accent .tw-swatch').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const c = btn.dataset.acc;
      // Set runtime accent — recompute the tinted variants approximately
      const root = document.documentElement;
      root.style.setProperty('--acc', c);
      root.style.setProperty('--acc-2', shade(c, -18));
      root.style.setProperty('--acc-bg', hexA(c, 0.08));
      root.style.setProperty('--acc-bg-2', hexA(c, 0.16));
      localStorage.setItem('ps-acc', c);
    });
  });
  // Density
  document.querySelectorAll('#tw-density button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#tw-density button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.documentElement.setAttribute('data-density', b.dataset.d);
      localStorage.setItem('ps-density', b.dataset.d);
    });
  });
  // Theme (mirror header control)
  document.querySelectorAll('#tw-theme button').forEach(b => {
    b.addEventListener('click', () => UI.setTheme(b.dataset.t));
  });

  function hexA(hex, a) {
    const v = hex.replace('#','');
    const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), bl = parseInt(v.slice(4,6),16);
    return `rgba(${r},${g},${bl},${a})`;
  }
  function shade(hex, pct) {
    const v = hex.replace('#','');
    let r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16);
    r = Math.max(0, Math.min(255, Math.round(r + r * pct/100)));
    g = Math.max(0, Math.min(255, Math.round(g + g * pct/100)));
    b = Math.max(0, Math.min(255, Math.round(b + b * pct/100)));
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
  }
})();

/* ── INIT ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Restore prefs
  const t = localStorage.getItem('ps-theme') || 'light';
  UI.setTheme(t);
  const d = localStorage.getItem('ps-density');
  if (d) {
    document.documentElement.setAttribute('data-density', d);
    document.querySelectorAll('#tw-density button').forEach(x => {
      x.classList.toggle('on', x.dataset.d === d);
    });
  }
  const acc = localStorage.getItem('ps-acc');
  if (acc) {
    const btn = document.querySelector(`#tw-accent .tw-swatch[data-acc="${acc}"]`);
    if (btn) btn.click();
  }

  // Click outside std popover closes it
  document.addEventListener('mousedown', e => {
    const pop = document.getElementById('std-popover');
    const btn = document.getElementById('std-btn');
    if (!pop.classList.contains('open')) return;
    if (!pop.contains(e.target) && !btn.contains(e.target)) pop.classList.remove('open');
  });
  // ESC closes drawers / modals / popovers
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      UI.closeAI();
      UI.closeReport();
      UI.closeNewProject();
      document.getElementById('std-popover').classList.remove('open');
      document.getElementById('tweaks-panel').classList.remove('open');
    }
  });

  // Project list — clicking switches active state
  document.querySelectorAll('.proj-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.proj-item-del')) { e.stopPropagation(); el.remove(); return; }
      document.querySelectorAll('.proj-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
    });
  });
});
