/**
 * EdgeWay PipeSpec — Express server
 *
 * OPSÆTNING (én gang):
 *   npm install
 *
 * START:
 *   node server.js
 *
 * Åbn http://localhost:3001 i browseren.
 * API-nøglen læses fra .env (ANTHROPIC_API_KEY).
 */

// Indlæs .env variabler hvis dotenv er installeret
try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, PageNumber, Header, Footer, TabStopType, TabStopPosition,
  NumberFormat
} = require('docx');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── API-NØGLE endpoint — skal være FØR express.static ────────────────────────
app.get('/api/config', (_req, res) => {
  const key = process.env.ANTHROPIC_API_KEY || '';
  res.json({ apiKey: key });
});

// ── VERSIONS endpoint ─────────────────────────────────────────────────────────
app.get('/api/version', (_req, res) => {
  // APP_VERSION sættes af main.js (electron) — fungerer korrekt i pakket app
  const version = process.env.APP_VERSION || require('./package.json').version;
  const hash    = process.env.APP_COMMIT  || '';
  res.json({ version, hash, dirty: false });
});

// ── PROJEKT PERSISTENS ────────────────────────────────────────────────────────
// APP_USERDATA sættes af main.js via app.getPath('userData') — korrekt i både dev og prod
const _userData = process.env.APP_USERDATA
  || path.join(process.env.APPDATA || require('os').homedir(), 'EdgeWay PipeSpec');
if (!fs.existsSync(_userData)) fs.mkdirSync(_userData, { recursive: true });
const PROJECTS_FILE = path.join(_userData, 'projects.json');

app.get('/api/debug-path', (_req, res) => {
  res.json({ PROJECTS_FILE, APP_USERDATA: process.env.APP_USERDATA, APPDATA: process.env.APPDATA });
});

app.get('/api/projects', (_req, res) => {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return res.json(null);
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    res.type('json').send(raw);
  } catch (e) {
    console.error('projects-load fejl:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const json = JSON.stringify(req.body);
    fs.writeFileSync(PROJECTS_FILE, json, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    console.error('projects-save fejl:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (_req, res) => {
  res.redirect('/PipeSpec.html');
});

// Servér HTML-filen statisk — no-cache så opdateringer altid vises
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// ── HJÆLPEFUNKTIONER ──────────────────────────────────────────────────────────

const BLUE       = '1F4E79';
const BLUE_LIGHT = '2E75B6';
const WHITE      = 'FFFFFF';
const GREY_BG    = 'EEF4FB';
const GREEN_BG   = 'EEF4FB';
const GREEN_DARK = 'D6E4F0';
const RED        = 'C00000';
const GREEN      = '27AE60';

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// Tabelbredde A4 med 20 mm margener: 11906 - 2*1134 = 9638 DXA ≈ 9360 (afrundet til 1" margener)
const TW = 9360; // total tabelbredde DXA

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE_LIGHT, space: 1 } },
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: 'Arial' })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE_LIGHT, space: 1 } },
    children: [new TextRun({ text, bold: true, size: 26, color: BLUE, font: 'Arial' })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: 'Arial', size: 20, ...opts })]
  });
}

function formulaPara(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 4 } },
    children: [new TextRun({ text, font: 'Arial', size: 20, bold: true, color: BLUE })]
  });
}

function formulaCalcPara(text) {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 4 } },
    children: [new TextRun({ text, font: 'Arial', size: 20, color: '333333' })]
  });
}

function makeCell(text, opts = {}) {
  const {
    bold = false, color = '000000', bg = null, width = Math.round(TW / 3),
    isHeader = false, italic = false
  } = opts;

  return new TableCell({
    borders: allBorders,
    width: { size: width, type: WidthType.DXA },
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({
        text,
        bold: bold || isHeader,
        color: isHeader ? WHITE : color,
        font: 'Arial',
        size: isHeader ? 18 : 19,
        italic
      })]
    })]
  });
}

function headerRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) =>
      new TableCell({
        borders: allBorders,
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: c, bold: true, color: WHITE, font: 'Arial', size: 18 })]
        })]
      })
    )
  });
}

function dataRow(cells, widths, alt = false, highlight = null) {
  return new TableRow({
    children: cells.map((c, i) => {
      let bg = alt ? GREY_BG : null;
      if (highlight === 'ok')  bg = GREEN_BG;
      if (highlight === 'rec') bg = GREEN_DARK;
      const textColor = c.color || '000000';
      return new TableCell({
        borders: allBorders,
        width: { size: widths[i], type: WidthType.DXA },
        shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({
            text: typeof c === 'string' ? c : c.text,
            bold: c.bold || highlight === 'rec',
            color: textColor,
            font: 'Arial',
            size: 19,
            italic: c.italic || false
          })]
        })]
      });
    })
  });
}

// ── 3-KOLONNE TABEL ───────────────────────────────────────────────────────────
function table3col(rows, widths = [Math.round(TW*0.5), Math.round(TW*0.3), Math.round(TW*0.2)]) {
  let dataIdx = 0;
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((row) => {
      if (row.isHeader) {
        return headerRow(row.cells, widths);
      }
      const cells = row.cells;
      const alt = dataIdx++ % 2 === 1;
      return dataRow(
        [
          { text: cells[0], bold: row.bold },
          { text: cells[1], bold: row.highlight === 'ok' || row.highlight === 'rec' || row.bold, color: row.valueColor || (row.highlight === 'ok' ? BLUE : '000000') },
          { text: cells[2] || '' }
        ],
        widths,
        alt,
        row.highlight
      );
    })
  });
}

// ── KPI BOKS-GRID (2×2) ───────────────────────────────────────────────────────
// Laver en 2×2 tabel med farvede KPI-bokse à la HTML-visningen.
// boxes: array af { label, value, unit, highlight } (max 4 elementer)
function kpiGrid(boxes) {
  const cw = Math.round(TW / 2);
  const BOX_BORDER = { style: BorderStyle.SINGLE, size: 12, color: BLUE_LIGHT };
  const allBoxBorders = { top: BOX_BORDER, bottom: BOX_BORDER, left: BOX_BORDER, right: BOX_BORDER };

  function kpiCell(box, width) {
    // Alle bokse: hvid baggrund, blå tal, grøn enhed — ingen highlight-farve
    return new TableCell({
      borders: allBoxBorders,
      width: { size: width, type: WidthType.DXA },
      shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 220, right: 220 },
      children: box ? [
        new Paragraph({ spacing: { after: 60 },  children: [new TextRun({ text: box.label, font: 'Arial', size: 16, color: '5B8DB8', allCaps: true })] }),
        new Paragraph({ spacing: { after: 60 },  children: [new TextRun({ text: box.value, font: 'Arial', size: 56, bold: true, color: BLUE_LIGHT })] }),
        new Paragraph({ spacing: { after: 0 },   children: [new TextRun({ text: box.unit,  font: 'Arial', size: 18, color: BLUE_LIGHT })] }),
      ] : [new Paragraph({ children: [new TextRun('')] })]
    });
  }

  const rows = [];
  for (let i = 0; i < boxes.length; i += 2) {
    rows.push(new TableRow({
      cantSplit: true, // Undgå at rækken splittes over en sideskift
      children: [
        kpiCell(boxes[i]     || null, cw),
        kpiCell(boxes[i + 1] || null, cw),
      ]
    }));
  }

  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [cw, cw],
    rows
  });
}

// ── SIDESKIFT ─────────────────────────────────────────────────────────────────
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun('')] });
}

function formatDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ── RAPPORT OPBYGNING ─────────────────────────────────────────────────────────
function buildDocument(data) {
  const { meta, entries } = data;
  const today = formatDate();
  const children = [];

  // ── FORSIDE ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 1440, after: 240 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'BEREGNINGSRAPPORT', bold: true, size: 56, color: BLUE, font: 'Arial' })]
    }),
    new Paragraph({
      spacing: { after: 720 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DS/EN 13480-3:2024 — Metalliske industrielle rørledninger', size: 24, color: BLUE_LIGHT, font: 'Arial' })]
    })
  );

  // Forsidtabel
  const coverRows = [
    ['Projekt',        meta.proj || '—'],
    ['Projektnummer',  meta.num  || '—'],
    ['Revision',       meta.rev  || 'Rev. A'],
    ['Udarbejdet af',  meta.by   || '—'],
    ['Kunde',          meta.client || '—'],
    ['Dato',           today],
    ['Antal beregninger', String(entries.length)],
    ['Standarder',     'DS/EN 13480-3:2024 · EN 10028-7:2016 · EN 1092-1:2018'],
  ];

  const cw = [Math.round(TW*0.35), Math.round(TW*0.65)];
  children.push(
    new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: cw,
      rows: coverRows.map(([label, val]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: allBorders,
              width: { size: cw[0], type: WidthType.DXA },
              shading: { fill: BLUE, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: WHITE, font: 'Arial', size: 20 })] })]
            }),
            new TableCell({
              borders: allBorders,
              width: { size: cw[1], type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: val, font: 'Arial', size: 20 })] })]
            })
          ]
        })
      )
    }),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
      children: [new TextRun({ text: 'EdgeWay ApS — Rasmus@edgeway.dk', color: '888888', font: 'Arial', size: 18, italic: true })]
    }),
    pageBreak()
  );

  // ── BEREGNINGER ───────────────────────────────────────────────────────────
  entries.forEach((r, idx) => {
    const isFlange = r.type === 'flange';
    const isFirst  = idx === 0;

    if (!isFirst) children.push(pageBreak());

    // ---- FLANGE ----
    if (isFlange) {
      children.push(
        heading1(`Beregning ${idx+1} af ${entries.length}: Flange DN${r.actualDN} — PN ${r.selectedPN} — ${parseFloat(r.pc_bar).toFixed(1)} bar / ${r.T}°C`),
        heading2('Flangeberegning — EN 1092-1:2018 Annex F + G'),
        spacer()
      );

      const flangeW = [Math.round(TW*0.45), Math.round(TW*0.33), Math.round(TW*0.22)];
      children.push(
        table3col([
          { isHeader: true, cells: ['Parameter', 'Værdi', 'Reference'] },
          { cells: ['Flangetype',                r.flangeTypeLabel,                              'EN 1092-1:2018'] },
          { cells: ['Materialegruppe',           r.matName,                                      'EN 1092-1:2018 Tbl. 9'] },
          { cells: ['Designtryk pc',             `${parseFloat(r.pc_bar).toFixed(2)} bar`,        '—'] },
          { cells: ['Designtemperatur',          `${r.T} °C`,                                    '—'] },
          { cells: ['DN (nominal)',              String(r.actualDN),                              '—'] },
          { cells: ['Anbefalet PN-klasse',       `PN ${r.selectedPN}`,                           'Annex G opslag'],       bold: true, valueColor: BLUE_LIGHT },
          { cells: ['PS_max ved ' + r.T + '°C', `${parseFloat(r.selectedPS).toFixed(1)} bar`,   'EN 1092-1:2018 Annex G'] },
          { cells: ['Margin',                   `${r.margin >= 0 ? '+' : ''}${parseFloat(r.margin).toFixed(1)} bar`, '—'] },
          { cells: ['Status',                   r.ok ? 'TILSTRÆKKELIG ✓' : 'UTILSTRÆKKELIG ✗',  '—'],                   bold: true, valueColor: r.ok ? BLUE_LIGHT : RED },
        ], flangeW),
        spacer(),
        heading2('PN-klasseoversigt'),
        spacer()
      );

      // PN-tabel
      if (r.pnRows && r.pnRows.length) {
        const pnW = [Math.round(TW*0.25), Math.round(TW*0.35), Math.round(TW*0.2), Math.round(TW*0.2)];
        children.push(
          new Table({
            width: { size: TW, type: WidthType.DXA },
            columnWidths: pnW,
            rows: [
              headerRow(['PN', `PS_max ved ${r.T}°C`, 'OK?', ''], pnW),
              ...r.pnRows.map((row, i) =>
                new TableRow({
                  children: [
                    new TableCell({ borders: allBorders, width: { size: pnW[0], type: WidthType.DXA },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      children: [new Paragraph({ children: [new TextRun({ text: `${row.selected ? '★ ' : ''}PN ${row.pn}`, bold: row.selected, font: 'Arial', size: 19 })] })] }),
                    new TableCell({ borders: allBorders, width: { size: pnW[1], type: WidthType.DXA },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      children: [new Paragraph({ children: [new TextRun({ text: `${parseFloat(row.ps).toFixed(1)} bar`, bold: row.selected, font: 'Arial', size: 19 })] })] }),
                    new TableCell({ borders: allBorders, width: { size: pnW[2], type: WidthType.DXA },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      children: [new Paragraph({ children: [new TextRun({ text: row.ok ? '✓' : '✗', color: row.ok ? BLUE_LIGHT : RED, font: 'Arial', size: 19 })] })] }),
                    new TableCell({ borders: allBorders, width: { size: pnW[3], type: WidthType.DXA },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      children: [new Paragraph({ children: [new TextRun({ text: row.selected ? '← Valgt' : '', bold: true, color: BLUE_LIGHT, font: 'Arial', size: 19 })] })] }),
                  ]
                })
              )
            ]
          }),
          spacer(),
          formulaPara('PS = PN × f_t / 140 MPa   (EN 1092-1:2018 Annex F, Formel F.2)'),
          spacer()
        );
      }
      return; // næste entry
    }

    // ---- RØR ----
    const dn  = r.lookupPipeDN || Math.round(r.Do * 0.8);
    const ped = r.pedResult || {};
    const fLabelMap = {
      gas1: 'Gas Gr. 1 (brandfarlig/giftig)',
      gas2: 'Gas Gr. 2 (ikke-farlig)',
      liq1: 'Liquid Gr. 1 (farlig)',
      liq2: 'Liquid Gr. 2 (ikke-farlig)'
    };
    const fLabel = fLabelMap[r.fluid] || r.fluid || '—';

    children.push(
      heading1(`Beregning ${idx+1} af ${entries.length}: DN${dn} — OD ${r.Do} mm — ${parseFloat(r.pc_bar).toFixed(1)} bar / ${r.tc}°C`)
    );

    // 1. BEREGNINGSGRUNDLAG
    if (data.sections.s1) {
      children.push(heading2('Beregningsgrundlag'), spacer());
      const w1 = [Math.round(TW*0.5), Math.round(TW*0.3), Math.round(TW*0.2)];
      children.push(
        table3col([
          { isHeader: true, cells: ['Parameter', 'Værdi', 'Enhed'] },
          { cells: ['Beregningstryk (pc)',          `${parseFloat(r.pc_bar).toFixed(2)}`,    'bar'] },
          { cells: ['Beregningstryk (pc)',          `${parseFloat(r.pc).toFixed(4)}`,         'MPa'] },
          { cells: ['Beregningstemperatur (tc)',    `${r.tc}`,                                '°C'] },
          { cells: ['Ydre diameter (Do)',           `${r.Do}`,                                'mm'] },
          { cells: ['Svejsefaktor (z)',             `${r.z}`,                                 '—'] },
          { cells: ['Korrosionstillæg (c₀)',        `${r.c0 || 0}`,                           'mm'] },
          { cells: ['Mølletolerance (c₁)',          `${r.c1_str}`,                            '—'] },
          { cells: ['Tyndingtillæg (c₂)',           `${r.c2 || 0}`,                           'mm'] },
        ], w1),
        spacer()
      );

      // z-note
      const zNote = {
        1.0:  'z = 1,0 — Sømløse rør eller svejste rør med 100% NDT af alle svejsninger (RT/UT). Fuld materialeudnyttelse.',
        0.85: 'z = 0,85 — Svejste rør med stikprøve-NDT (RT/UT på udvalgte svejsninger). Reduceret materialeudnyttelse.',
        0.7:  'z = 0,70 — Kun visuel inspektion, ingen NDT. Laveste tilladte materialeudnyttelse.',
      }[r.z] || `z = ${r.z} — per EN 13480-3 §4.5`;

      children.push(
        new Paragraph({
          spacing: { before: 60, after: 120 },
          indent: { left: 200 },
          children: [new TextRun({ text: zNote + ' (Ref: EN 13480-3 §4.5)', font: 'Arial', size: 18, italic: true, color: '444444' })]
        })
      );

      // Materialetabel
      const fd = r.fDerivation;
      children.push(
        table3col([
          { isHeader: true, cells: ['Materiale', 'Værdi', 'Reference'] },
          { cells: ['Materialepreset',         r.matObjName || 'Custom',                 '—'] },
          { cells: ['Ståltype',                r.steelTypeLabel || '—',                   'EN 13480-3'] },
          { cells: [`Designspænding f ved ${r.tc}°C`, `${parseFloat(r.f).toFixed(2)} MPa`, 'Interpoleret fra Tbl. 13'], bold: true },
          ...(fd ? [
            { cells: ['SF på flydegrænse',       `${fd.sfRe}`,                            '—'] },
            { cells: ['SF på trækstyrke',         `${fd.sfRm}`,                            '—'] },
            { cells: [`Rp1,0t/Rp0,2t ved ${r.tc}°C`, `${fd.Rp10_t || fd.Rp02_t || '—'} MPa`, '(EN 10028-7 Tbl.13)'] },
            { cells: [`Rm_t ved ${r.tc}°C`,       `${fd.Rm_t || '—'} MPa`,                ''] },
          ] : [])
        ], w1),
        spacer()
      );
    }

    // 2. VÆGTYKKELSESBEREGNING
    if (data.sections.s2) {
      children.push(heading2('Vægtykkelsesberegning — §6.1'), spacer());
      children.push(
        formulaPara('e = (pc × Do) / (2 × f × z + pc)'),
        formulaCalcPara(`e = (${parseFloat(r.pc).toFixed(4)} × ${r.Do}) / (2 × ${parseFloat(r.f).toFixed(2)} × ${r.z} + ${parseFloat(r.pc).toFixed(4)}) = ${parseFloat(r.e).toFixed(3)} mm`),
        formulaCalcPara(`eord ≥ ${parseFloat(r.er).toFixed(3)} mm   |   Do/Di = ${parseFloat(r.ratio).toFixed(3)} ≤ 1,7 → tyndvæg ✓`),
        spacer()
      );

      const kpiBoxes = [
        { label: 'Min. krævet (e)',          value: parseFloat(r.e).toFixed(3),                      unit: 'mm' },
        { label: 'Min. bestilling (eord)',   value: parseFloat(r.er).toFixed(3),                     unit: 'mm' },
        { label: `Designspænding f`,         value: parseFloat(r.f).toFixed(2),                      unit: `MPa @ ${r.tc}°C` },
        ...(r.pmax != null ? [{ label: 'pmax', value: (parseFloat(r.pmax)*10).toFixed(2), unit: 'bar', highlight: 'ok' }] : []),
        ...(r.ea   != null ? [{ label: 'Analysetykkelse ea', value: parseFloat(r.ea).toFixed(3), unit: 'mm', highlight: r.pass ? 'ok' : null }] : []),
      ];
      children.push(kpiGrid(kpiBoxes), spacer());
    }

    // 4. MATERIALEDATABASE
    if (data.sections.s4 && r.fDerivation && r.matObjName) {
      const fd = r.fDerivation;
      children.push(heading2('Materialedatabase — EN 10028-7:2016 Tabel 13'), spacer());
      const mw = [Math.round(TW*0.25), Math.round(TW*0.25), Math.round(TW*0.25), Math.round(TW*0.25)];
      const matRows = [headerRow(['T (°C)', 'Rp0,2 (MPa)', 'Rp1,0 (MPa)', 'Rm (MPa)'], mw)];

      if (fd.interpData && fd.interpData.interp) {
        const id = fd.interpData;
        const { t_low, t_high } = id;
        matRows.push(
          dataRow([`${t_low}°C`,  `${id.Rp02_t_low ?? '—'}`, `${id.Rp10_t_low ?? '—'}`, `${id.Rm_t_low ?? '—'}`], mw, false),
          dataRow([`${t_high}°C`, `${id.Rp02_t_high ?? '—'}`, `${id.Rp10_t_high ?? '—'}`, `${id.Rm_t_high ?? '—'}`], mw, true),
          dataRow([`→ ${r.tc}°C`, `${fd.Rp02_t || '—'}`, `${fd.Rp10_t || '—'}`, `${fd.Rm_t || '—'}`], mw, false, 'rec')
        );
      } else {
        matRows.push(dataRow([`${r.tc}°C`, `${fd.Rp02_t || '—'}`, `${fd.Rp10_t || '—'}`, `${fd.Rm_t || '—'}`], mw, false, 'rec'));
      }

      children.push(
        new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: mw, rows: matRows }),
        spacer(),
        formulaPara(`f = Rp1,0t / ${fd.sfRe} = ${fd.Rp10_t || fd.Rp02_t} / ${fd.sfRe} = ${parseFloat(r.f).toFixed(2)} MPa`),
        spacer()
      );
    }

    // 5. PED-KLASSIFICERING
    if (data.sections.s5) {
      const ped = r.pedResult || {};
      children.push(heading2('PED-klassificering — PED 2014/68/EU Annex II'), spacer());

      // Vandfase check
      const isLiquid = r.fluid === 'liq1' || r.fluid === 'liq2';
      let waterRows = [];
      if (isLiquid && r.waterPhase) {
        waterRows = [
          { cells: [`T_sat ved ${r.pc_bar} bar`, `${r.waterPhase.T_sat}`, '°C'] },
          { cells: ['Vandfase', r.waterPhase.label, '—'] },
        ];
      }

      const pw = [Math.round(TW*0.5), Math.round(TW*0.3), Math.round(TW*0.2)];
      children.push(
        table3col([
          { isHeader: true, cells: ['Parameter', 'Værdi', 'Enhed'] },
          { cells: ['DN',                       String(dn),                                   '—'] },
          { cells: ['PS (beregnings tryk)',     `${parseFloat(r.pc_bar).toFixed(2)}`,          'bar'] },
          { cells: ['PS × DN (produkttal)',     `${Math.round(parseFloat(r.pc_bar) * dn)}`,    '—'] },
          { cells: ['Fluidtype',                fLabel,                                        '—'] },
          ...waterRows,
          { cells: ['Annex II reference',       ped.annex2table || '—',                        '—'] },
          { cells: ['PED-kategori',             `KATEGORI ${ped.cat || '—'}`,                  '—'],   bold: true, valueColor: BLUE_LIGHT },
          { cells: ['Kontrolklasse (DK)',       `Kontrolklasse ${ped.kontrolklasse || '—'}`,    '—'] },
          ...(r.catIsOverride ? [{ cells: ['OBS', 'Manuel kategori-override', '—'] }] : [])
        ], pw),
        spacer()
      );

      if (ped.catDesc) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 160 },
            indent: { left: 200 },
            border: { left: { style: BorderStyle.SINGLE, size: 8, color: BLUE_LIGHT, space: 4 } },
            children: [new TextRun({ text: ped.catDesc, font: 'Arial', size: 18, italic: true, color: '333333' })]
          })
        );
      }
    }
  });

  // ── REFERENCER ────────────────────────────────────────────────────────────
  if (data.sections.s6) {
    children.push(pageBreak(), heading2('Referencer'), spacer());
    const rw = [Math.round(TW*0.35), Math.round(TW*0.65)];
    children.push(
      new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: rw,
        rows: [
          headerRow(['Standard', 'Titel'], rw),
          dataRow([{ text: 'DS/EN 13480-3:2024', bold: true }, 'Metalliske industrielle rørledninger — Del 3: Konstruktion og beregning'], rw, false),
          dataRow(['EN 10028-7:2016', 'Fladfabrikater af stål til trykformål — Del 7: Rustfrit stål'], rw, true),
          dataRow(['EN 1092-1:2018', 'Flanger og flangesamlinger — Runde flanger til rør, PN-betegnede'], rw, false),
          dataRow(['ANSI B36.10 / B36.19', 'Welded and Seamless Wrought Steel Pipe'], rw, true),
          dataRow(['PED 2014/68/EU', 'Pressure Equipment Directive'], rw, false),
        ]
      }),
      spacer()
    );
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 480 },
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 6 } },
      children: [new TextRun({ text: `Rapport udarbejdet med EdgeWay Pipeline Calculator — DS/EN 13480-3:2024   |   EdgeWay ApS   |   Rasmus@edgeway.dk   |   ${today}`, font: 'Arial', size: 16, color: '888888', italic: true })]
    })
  );

  // ── BUILD DOCUMENT ────────────────────────────────────────────────────────
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } }
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: BLUE },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 }
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: BLUE },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 }
        },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } // 20 mm
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE_LIGHT, space: 4 } },
              children: [
                new TextRun({ text: 'EdgeWay ApS  —  Beregningsrapport  —  DS/EN 13480-3:2024', font: 'Arial', size: 16, color: BLUE }),
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE_LIGHT, space: 4 } },
              tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
              children: [
                new TextRun({ text: today, font: 'Arial', size: 16, color: '888888' }),
                new TextRun({ text: '\t', font: 'Arial', size: 16 }),
                new TextRun({ text: 'Side ', font: 'Arial', size: 16, color: '888888' }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '888888' }),
              ]
            })
          ]
        })
      },
      children
    }]
  });
}

// ── ENDPOINT ──────────────────────────────────────────────────────────────────
app.post('/generate-docx', async (req, res) => {
  try {
    const doc    = buildDocument(req.body);
    const buffer = await Packer.toBuffer(doc);
    const proj   = (req.body.meta?.proj || 'Rapport').replace(/[^a-zA-Z0-9æøåÆØÅ _-]/g, '_');
    const rev    = req.body.meta?.rev || 'Rev_A';
    const fname  = `${proj}_${rev}.docx`.replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(buffer);
  } catch (err) {
    const errorText = err && err.stack ? err.stack : String(err);
    console.error('Fejl ved generering:', errorText);
    res.status(500).json({ error: err?.message || String(err), details: errorText });
  }
});

app.listen(PORT, () => {
  console.log(`EdgeWay rapport-server kører på http://localhost:${PORT}`);
  console.log('Åbn PipeSpec.html i browseren (eller http://localhost:3001).');
});
