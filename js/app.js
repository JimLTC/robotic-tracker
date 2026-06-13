'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxS4JCzH1GvZu_sO4CsndHcqka0-Z9DhuZIy8fBHj1X7vtiy75cISQpDvHNFPK3UyN7/exec';

const INSTRUMENT_TYPES = {
  'Monopolar scissors':             10,
  'Fenestrated bipolar':            14,
  'Cadiere forceps':                18,
  'Maryland forceps':               14,
  'Prograsp forceps':               18,
  'Curved bipolar dissector':       14,
  'Large needle driver':            15,
  'Large suturecut needle driver':  15,
  'Cautery hook':                   10,
  'Cautery spatula':                10,
  'Fenestrated TIP-UP':             10,
  '0 degree lens':                  null,
  '30 degree lens':                 null,
};

const CONSUMABLE_TYPES = [
  'Small clip applicator',
  'M/L clip applicator',
  'Large clip applicator',
  'Vessel sealer',
  'Sureform 60',
  'SureForm 45',
  'Harmonic scalpel',
];

// ── State ─────────────────────────────────────────────────────────────────────

let state = { instruments: [], consumables: [], faults: [], audit: [] };

// ── Network ───────────────────────────────────────────────────────────────────

async function api(params) {
  const url = SCRIPT_URL + '?t=' + Date.now();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ── Sync status ───────────────────────────────────────────────────────────────

function setSyncStatus(status, text) {
  const el  = document.getElementById('sync-status');
  const dot = document.getElementById('status-dot');
  el.className = 'sync-status ' + status;
  el.textContent = text;
  dot.className = 'dot' + (status === 'ok' ? '' : status === 'loading' ? ' amber' : ' red');
}

// ── Data normalisation ────────────────────────────────────────────────────────

function normaliseInstrument(r) {
  return {
    sn:       r.SN       || r.sn       || '',
    type:     r.Type     || r.type     || '',
    status:   r.Status   || r.status   || '',
    usesLeft: (r.UsesLeft === null || r.UsesLeft === '' || r.UsesLeft === undefined) ? null : Number(r.UsesLeft),
    maxLife:  (r.MaxLife  === null || r.MaxLife  === '' || r.MaxLife  === undefined) ? null : Number(r.MaxLife),
    lastUsed: r.LastUsed || r.lastUsed || '',
    remarks:  r.Remarks  || r.remarks  || '',
  };
}

function normaliseConsumable(r) {
  return {
    sn:         r.SN         || r.sn         || '',
    type:       r.Type       || r.type       || '',
    balance:    Number(r.Balance    ?? r.balance    ?? 0),
    maxBalance: Number(r.MaxBalance ?? r.maxBalance ?? 1),
    expiry:     r.Expiry     || r.expiry     || '',
    lastUsed:   r.LastUsed   || r.lastUsed   || '',
  };
}

// ── Load & refresh ────────────────────────────────────────────────────────────

async function initData() {
  const data = await api({ action: 'getAll' });
  if (data.error) throw new Error(data.error);
  state.instruments  = (data.instruments  || []).map(normaliseInstrument);
  state.consumables  = (data.consumables  || []).map(normaliseConsumable);
  state.faults       = data.faults  || [];
  state.audit        = data.audit   || [];
}

async function refreshData() {
  setSyncStatus('loading', 'Syncing...');
  try {
    await initData();
    setSyncStatus('ok', 'Synced · ' + fmtTime());
    rerenderCurrentSection();
  } catch (e) {
    setSyncStatus('err', 'Sync failed');
    console.error('Refresh error', e);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function bootApp() {
  setSyncStatus('ok', 'Connected');
  updateFaultsBadge();
  renderDashboard();
  const initT = [...new Set(state.instruments.map(i => i.type))].sort();
  document.getElementById('filt-type').innerHTML  = '<option value="">All types</option>'  + initT.map(t => `<option>${t}</option>`).join('');
  document.getElementById('ffilt-type').innerHTML = '<option value="">All types</option>' + initT.map(t => `<option>${t}</option>`).join('');
}

function showLoadError(msg) {
  document.getElementById('lo-spinner').style.display = 'none';
  document.getElementById('lo-title').textContent = 'Connection failed';
  document.getElementById('lo-sub').textContent = msg || 'Could not reach Google Sheets.';
  document.getElementById('lo-retry').style.display = 'inline-flex';
}

async function retryLoad() {
  document.getElementById('lo-spinner').style.display = '';
  document.getElementById('lo-title').textContent = 'Connecting to Google Sheets...';
  document.getElementById('lo-sub').textContent = 'Retrying...';
  document.getElementById('lo-retry').style.display = 'none';
  try {
    await initData();
    document.getElementById('loading-overlay').style.display = 'none';
    bootApp();
  } catch (e) {
    showLoadError('Still unable to connect. Check your internet connection.');
  }
}

(async () => {
  updateClock();
  setInterval(updateClock, 30000);
  setInterval(refreshData, 60000);
  try {
    await initData();
    document.getElementById('loading-overlay').style.display = 'none';
    bootApp();
  } catch (e) {
    showLoadError('Could not reach Google Sheets. Check your internet connection.');
  }
})();

// ── Navigation ────────────────────────────────────────────────────────────────

const TITLES = {
  dashboard:   'Dashboard',
  instruments: 'All instruments',
  consumables: 'Consumables',
  'log-use':   'Log use / fault',
  manage:      'Instrument management',
  faults:      'Fault log',
  audit:       'Audit trail',
};

let currentSection = 'dashboard';

function nav(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));

  document.querySelectorAll(`[data-sec="${id}"]`).forEach(b => b.classList.add('active'));

  document.getElementById('page-title').textContent = TITLES[id] || id;
  currentSection = id;

  if (id === 'dashboard')   renderDashboard();
  if (id === 'instruments') renderInstruments();
  if (id === 'consumables') renderConsumables();
  if (id === 'log-use')     initLogForms();
  if (id === 'manage')      initManageForms();
  if (id === 'faults')      renderFaults();
  if (id === 'audit')       renderAudit();
}

function rerenderCurrentSection() {
  if (currentSection === 'dashboard')   renderDashboard();
  if (currentSection === 'instruments') renderInstruments();
  if (currentSection === 'consumables') renderConsumables();
  if (currentSection === 'faults')      renderFaults();
  if (currentSection === 'audit')       renderAudit();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime() {
  return new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
}

function bc(p) {
  return p <= 20 ? 'var(--red)' : p <= 40 ? 'var(--amber)' : 'var(--green)';
}

function sbadge(s) {
  const m = {
    'Circulation':   'green',
    'SB Instrument': 'blue',
    'URO Set':       'blue',
    'Non-sterile':   'gray',
    'Complete':      'gray',
    'Condemned':     'red',
  };
  return `<span class="badge ${m[s] || 'gray'}">${s}</span>`;
}

function fbadge(k) {
  const serious = ['Wire broken', 'Intra-op failure', 'Wire frail'];
  return `<span class="badge ${serious.includes(k) ? 'red' : 'amber'}">${k}</span>`;
}

function auditBadgeClass(event) {
  const e = (event || '').toLowerCase();
  if (e.includes('fault'))     return 'amber';
  if (e.includes('reversed'))  return 'red';
  if (e.includes('condemned')) return 'red';
  if (e.includes('added'))     return 'green';
  return 'blue';
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.className = 'msg ' + type;
  el.textContent = text;
  setTimeout(() => { el.textContent = ''; el.className = ''; }, 7000);
}

function setBtn(id, loading) {
  const b = document.getElementById(id);
  if (!b) return;
  if (!b.dataset.label) b.dataset.label = b.textContent.trim();
  b.disabled = loading;
  if (loading) b.innerHTML = '<span class="spinner"></span>Saving...';
  else b.textContent = b.dataset.label;
}

function updateFaultsBadge() {
  const el = document.getElementById('nav-faults');
  if (!el) return;
  el.innerHTML = `<span class="ni">⚑</span><span class="nl">Fault log</span>${state.faults.length ? `<span class="nbadge">${state.faults.length}</span>` : ''}`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  const inC   = state.instruments.filter(i => i.status === 'Circulation').length;
  const crit  = state.instruments.filter(i => i.usesLeft !== null && i.usesLeft <= 2 && i.status === 'Circulation').length;
  const sbI   = state.instruments.filter(i => i.status === 'SB Instrument').length;
  const wires = state.faults.filter(f => (f.Kind || f.kind) === 'Wire broken').length;
  const consA = state.consumables.filter(c => c.maxBalance === 1 && c.balance === 1).length;

  document.getElementById('dash-cards').innerHTML = `
    <div class="sc ok">     <div class="sc-lbl">In circulation</div>          <div class="sc-num">${inC}</div></div>
    <div class="sc ${crit > 0 ? 'danger' : 'ok'}"><div class="sc-lbl">Critical (≤2 uses left)</div><div class="sc-num">${crit}</div></div>
    <div class="sc">         <div class="sc-lbl">SB instruments</div>          <div class="sc-num">${sbI}</div></div>
    <div class="sc warn">    <div class="sc-lbl">Faults logged</div>           <div class="sc-num">${state.faults.length}</div></div>
    <div class="sc danger">  <div class="sc-lbl">Wire break events</div>       <div class="sc-num">${wires}</div></div>
    <div class="sc info">    <div class="sc-lbl">Consumables available</div>   <div class="sc-num">${consA}</div></div>`;

  const cr = state.instruments.filter(i => i.usesLeft !== null && i.usesLeft <= 2 && i.status !== 'Complete' && i.status !== 'Condemned');
  document.getElementById('dash-critical').innerHTML = cr.length === 0
    ? '<div class="empty">No instruments critical right now</div>'
    : cr.map(i => `
      <div class="crit-item">
        <div><div class="crit-sn">${i.sn}</div><div class="crit-type">${i.type}</div></div>
        <span class="badge red">${i.usesLeft} use${i.usesLeft === 1 ? '' : 's'} left</span>
      </div>`).join('');

  const rf = [...state.faults].sort((a, b) => (b.Date || b.date || '').localeCompare(a.Date || a.date || '')).slice(0, 5);
  document.getElementById('dash-faults').innerHTML = rf.length === 0
    ? '<div class="empty">No faults logged</div>'
    : rf.map(f => `
      <div class="fi">
        <div class="fi-top">
          <span class="fi-sn">${f.SN || f.sn}</span>
          ${fbadge(f.Kind || f.kind)}
          <span class="fi-date">${f.Date || f.date}</span>
        </div>
        <div class="fi-note">${f.Notes || f.notes || '—'}</div>
      </div>`).join('');

  const clips = state.consumables.filter(c => c.type.toLowerCase().includes('clip'));
  document.getElementById('dash-consumables').innerHTML = clips.length === 0
    ? '<div class="empty">No consumable data</div>'
    : clips.map(c => {
        const p = Math.round(c.balance / c.maxBalance * 100);
        return `
        <div class="ci">
          <div class="ci-info"><div class="ci-sn">${c.sn}</div><div class="ci-sub">${c.type}</div></div>
          <div class="ci-bar"><div class="ci-fill" style="width:${p}%;background:${bc(p)}"></div></div>
          <div class="ci-pct" style="color:${bc(p)}">${c.balance}/${c.maxBalance}</div>
        </div>`;
      }).join('');
}

// ── All Instruments ───────────────────────────────────────────────────────────

function renderInstruments() {
  const types = [...new Set(state.instruments.map(i => i.type))].sort();
  const td = document.getElementById('filt-type');
  const cur = td.value;
  td.innerHTML = '<option value="">All types</option>' + types.map(t => `<option${t === cur ? ' selected' : ''}>${t}</option>`).join('');

  const ft = td.value;
  const fs = document.getElementById('filt-status').value;
  const list = state.instruments.filter(i => (!ft || i.type === ft) && (!fs || i.status === fs));

  document.getElementById('instr-table').innerHTML = list.length === 0
    ? '<tr><td colspan="6" class="empty">No instruments found</td></tr>'
    : list.map(i => {
        const p = i.maxLife !== null ? Math.round(i.usesLeft / i.maxLife * 100) : null;
        const bar = p !== null
          ? `<div class="lw"><div class="lb"><div class="lf" style="width:${p}%;background:${bc(p)}"></div></div><span class="ll" style="color:${bc(p)}">${i.usesLeft}/${i.maxLife}</span></div>`
          : `<span style="color:var(--text3);font-size:12px">By session</span>`;
        return `
        <tr>
          <td class="mono">${i.sn}</td>
          <td>${i.type}</td>
          <td>${sbadge(i.status)}</td>
          <td>${bar}</td>
          <td style="color:var(--text2);font-size:12px">${i.lastUsed || '—'}</td>
          <td style="color:var(--text2);font-size:12px;max-width:200px">${i.remarks || '—'}</td>
        </tr>`;
      }).join('');
}

// ── Consumables ───────────────────────────────────────────────────────────────

function renderConsumables() {
  const groups = {};
  state.consumables.forEach(c => { if (!groups[c.type]) groups[c.type] = []; groups[c.type].push(c); });

  document.getElementById('cons-list').innerHTML = Object.keys(groups).length === 0
    ? '<div class="empty">No consumable data</div>'
    : Object.entries(groups).map(([type, items]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${type}</div>
        ${items.map(c => {
          const p = Math.round(c.balance / c.maxBalance * 100);
          return `
          <div class="ci">
            <div class="ci-info">
              <div class="ci-sn">${c.sn}</div>
              ${c.expiry   ? `<div class="ci-sub">Exp: ${c.expiry}</div>` : ''}
              ${c.lastUsed ? `<div class="ci-sub">Last used: ${c.lastUsed}</div>` : ''}
            </div>
            <div class="ci-bar"><div class="ci-fill" style="width:${p}%;background:${bc(p)}"></div></div>
            <div class="ci-pct" style="color:${bc(p)}">${c.balance}/${c.maxBalance}</div>
          </div>`;
        }).join('')}
      </div>`).join('');
}

// ── Log use / fault forms ─────────────────────────────────────────────────────

function initLogForms() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('log-date').value   = today;
  document.getElementById('fault-date').value = today;

  const types = [...new Set(state.instruments.filter(i => i.status !== 'Condemned').map(i => i.type))].sort();
  const opts = '<option value="">Select type...</option>' + types.map(t => `<option>${t}</option>`).join('');
  ['log-type', 'fault-type', 'undo-type'].forEach(id => document.getElementById(id).innerHTML = opts);
  ['log-sn', 'fault-sn', 'undo-sn'].forEach(id => document.getElementById(id).innerHTML = '<option value="">Select SN...</option>');
}

function populateSNDropdown() {
  const t = document.getElementById('log-type').value;
  const list = state.instruments.filter(i =>
    i.type === t && i.status !== 'Complete' && i.status !== 'Condemned' && i.usesLeft !== 0
  );
  document.getElementById('log-sn').innerHTML = '<option value="">Select SN...</option>' +
    list.map(i => `<option value="${i.sn}">${i.sn}${i.usesLeft !== null ? ' (' + i.usesLeft + ' left)' : ''}</option>`).join('');
}

function populateFaultSN() {
  const t = document.getElementById('fault-type').value;
  const list = state.instruments.filter(i => i.type === t && i.status !== 'Condemned');
  document.getElementById('fault-sn').innerHTML = '<option value="">Select SN...</option>' +
    list.map(i => `<option value="${i.sn}">${i.sn}</option>`).join('');
}

function populateUndoSN() {
  const t = document.getElementById('undo-type').value;
  const list = state.instruments.filter(i =>
    i.type === t && i.maxLife !== null && i.usesLeft < i.maxLife && i.status !== 'Condemned'
  );
  document.getElementById('undo-sn').innerHTML = '<option value="">Select SN...</option>' +
    list.map(i => `<option value="${i.sn}">${i.sn} (${i.usesLeft}/${i.maxLife} left)</option>`).join('');
}

async function logUse() {
  const type  = document.getElementById('log-type').value;
  const sn    = document.getElementById('log-sn').value;
  const date  = document.getElementById('log-date').value;
  const staff = document.getElementById('log-staff').value;
  const cas   = document.getElementById('log-case').value;

  if (!type || !sn || !date) { showMsg('log-msg', 'Please fill in type, SN and date.', 'err'); return; }

  const inst = state.instruments.find(i => i.sn === sn);
  if (!inst) { showMsg('log-msg', 'Instrument not found.', 'err'); return; }
  if (inst.usesLeft !== null && inst.usesLeft <= 0) { showMsg('log-msg', 'No uses remaining.', 'err'); return; }

  const newUsesLeft = inst.usesLeft !== null ? Math.max(0, inst.usesLeft - 1) : null;
  const newStatus   = newUsesLeft === 0 ? 'Complete' : inst.status;

  setBtn('btn-log-use', true);
  try {
    await api({ action: 'saveInstrument', SN: inst.sn, Type: inst.type, Status: newStatus, UsesLeft: newUsesLeft, MaxLife: inst.maxLife, LastUsed: date, Remarks: inst.remarks });
    const auditNote = `Case: ${cas || '—'} | Uses left: ${newUsesLeft !== null ? newUsesLeft : 'N/A'}`;
    await api({ action: 'saveAudit', Timestamp: new Date().toISOString(), Event: 'Use logged', Type: inst.type, SN: inst.sn, Staff: staff, Notes: auditNote });

    // Update local state only after successful write
    inst.usesLeft = newUsesLeft;
    inst.lastUsed = date;
    inst.status   = newStatus;

    setSyncStatus('ok', 'Saved · ' + fmtTime());
    if (inst.usesLeft !== null && inst.usesLeft <= 2) {
      showMsg('log-msg', `Recorded. ⚠ Warning: ${inst.usesLeft} use(s) remaining — consider replacement.`, 'warn');
    } else {
      showMsg('log-msg', `Use recorded for ${sn}.`, 'ok');
    }
    populateSNDropdown();
    if (currentSection === 'dashboard') renderDashboard();
  } catch (e) {
    setSyncStatus('err', 'Save failed');
    showMsg('log-msg', 'Failed to save. Check your connection.', 'err');
  }
  setBtn('btn-log-use', false);
}

async function logFault() {
  const type  = document.getElementById('fault-type').value;
  const sn    = document.getElementById('fault-sn').value;
  const kind  = document.getElementById('fault-kind').value;
  const date  = document.getElementById('fault-date').value;
  const notes = document.getElementById('fault-notes').value;
  const staff = document.getElementById('fault-staff').value;

  if (!type || !sn || !kind || !date) { showMsg('fault-msg', 'Please fill in type, SN, fault type and date.', 'err'); return; }

  setBtn('btn-log-fault', true);
  try {
    const id = 'f' + Date.now();
    await api({ action: 'saveFault', ID: id, Date: date, Type: type, SN: sn, Kind: kind, Notes: notes, Staff: staff });
    await api({ action: 'saveAudit', Timestamp: new Date().toISOString(), Event: 'Fault logged', Type: type, SN: sn, Staff: staff, Notes: `${kind}: ${notes}` });

    state.faults.unshift({ ID: id, Date: date, Type: type, SN: sn, Kind: kind, Notes: notes, Staff: staff });

    setSyncStatus('ok', 'Saved · ' + fmtTime());
    showMsg('fault-msg', 'Fault recorded.', 'ok');
    document.getElementById('fault-notes').value = '';
    document.getElementById('fault-staff').value = '';
    updateFaultsBadge();
  } catch (e) {
    setSyncStatus('err', 'Save failed');
    showMsg('fault-msg', 'Failed to save. Check your connection.', 'err');
  }
  setBtn('btn-log-fault', false);
}

async function undoUse() {
  const type   = document.getElementById('undo-type').value;
  const sn     = document.getElementById('undo-sn').value;
  const reason = document.getElementById('undo-reason').value;
  const staff  = document.getElementById('undo-staff').value;
  const notes  = document.getElementById('undo-notes').value;

  if (!type || !sn || !reason || !staff) { showMsg('undo-msg', 'Please fill in type, SN, reason and authorising supervisor.', 'err'); return; }

  const inst = state.instruments.find(i => i.sn === sn);
  if (!inst) { showMsg('undo-msg', 'Instrument not found.', 'err'); return; }
  if (inst.maxLife === null) { showMsg('undo-msg', 'Undo not applicable to session-tracked instruments.', 'err'); return; }

  const prevStatus   = inst.status;
  const newUsesLeft  = Math.min(inst.maxLife, inst.usesLeft + 1);
  const newStatus    = inst.status === 'Complete' && newUsesLeft > 0 ? 'Circulation' : inst.status;

  setBtn('btn-undo', true);
  try {
    await api({ action: 'saveInstrument', SN: inst.sn, Type: inst.type, Status: newStatus, UsesLeft: newUsesLeft, MaxLife: inst.maxLife, LastUsed: inst.lastUsed, Remarks: inst.remarks });
    const auditNote = `Reason: ${reason}${notes ? ' | ' + notes : ''} | Uses now: ${newUsesLeft}/${inst.maxLife}`;
    await api({ action: 'saveAudit', Timestamp: new Date().toISOString(), Event: 'Use REVERSED', Type: inst.type, SN: inst.sn, Staff: staff, Notes: auditNote });

    inst.usesLeft = newUsesLeft;
    inst.status   = newStatus;

    setSyncStatus('ok', 'Saved · ' + fmtTime());
    showMsg('undo-msg', `Done. ${sn} returned — now ${inst.usesLeft}/${inst.maxLife} uses remaining.`, 'ok');
    document.getElementById('undo-notes').value = '';
    document.getElementById('undo-staff').value = '';
    populateUndoSN();
  } catch (e) {
    setSyncStatus('err', 'Save failed');
    showMsg('undo-msg', 'Failed to save. Check your connection.', 'err');
  }
  setBtn('btn-undo', false);
}

// ── Instrument management forms ───────────────────────────────────────────────

function initManageForms() {
  const typeNames = Object.keys(INSTRUMENT_TYPES);
  const typeOpts  = '<option value="">Select type...</option>' + typeNames.map(t => `<option>${t}</option>`).join('');
  document.getElementById('mnew-type').innerHTML  = typeOpts;
  document.getElementById('mcnd-type').innerHTML  = typeOpts;
  document.getElementById('mcnd-sn').innerHTML    = '<option value="">Select SN...</option>';
  document.getElementById('mcon-type').innerHTML  = '<option value="">Select type...</option>' + CONSUMABLE_TYPES.map(t => `<option>${t}</option>`).join('');
}

function autoFillMaxLife() {
  const type    = document.getElementById('mnew-type').value;
  const maxLife = INSTRUMENT_TYPES[type];
  const val     = (maxLife !== undefined && maxLife !== null) ? String(maxLife) : '';
  document.getElementById('mnew-maxlife').value  = val;
  document.getElementById('mnew-usesleft').value = val;
}

function syncUsesLeft() {
  document.getElementById('mnew-usesleft').value = document.getElementById('mnew-maxlife').value;
}

function populateCondemnSN() {
  const t = document.getElementById('mcnd-type').value;
  const active = state.instruments.filter(i =>
    i.type === t && i.status !== 'Complete' && i.status !== 'Condemned'
  );
  document.getElementById('mcnd-sn').innerHTML = '<option value="">Select SN...</option>' +
    active.map(i => `<option value="${i.sn}">${i.sn} — ${i.status}</option>`).join('');
}

async function addInstrument() {
  const sn       = document.getElementById('mnew-sn').value.trim();
  const type     = document.getElementById('mnew-type').value;
  const status   = document.getElementById('mnew-status').value;
  const maxLife  = document.getElementById('mnew-maxlife').value;
  const usesLeft = document.getElementById('mnew-usesleft').value;
  const remarks  = document.getElementById('mnew-remarks').value.trim();
  const staff    = document.getElementById('mnew-staff').value.trim();

  if (!sn || !type || !status) { showMsg('mnew-msg', 'Serial number, type and status are required.', 'err'); return; }
  if (!staff) { showMsg('mnew-msg', 'Please enter the name of the staff adding this instrument.', 'err'); return; }

  const exists = state.instruments.some(i => i.sn.toLowerCase() === sn.toLowerCase());
  if (exists) { showMsg('mnew-msg', `SN "${sn}" already exists in the system.`, 'err'); return; }

  const ml = maxLife  !== '' && maxLife  !== null ? Number(maxLife)  : null;
  const ul = usesLeft !== '' && usesLeft !== null ? Number(usesLeft) : ml;

  setBtn('btn-add-instr', true);
  try {
    await api({ action: 'saveInstrument', SN: sn, Type: type, Status: status, UsesLeft: ul, MaxLife: ml, LastUsed: '', Remarks: remarks });
    await api({ action: 'saveAudit', Timestamp: new Date().toISOString(), Event: 'Instrument added', Type: type, SN: sn, Staff: staff, Notes: `Status: ${status}${remarks ? ' | ' + remarks : ''}` });

    state.instruments.push(normaliseInstrument({ SN: sn, Type: type, Status: status, UsesLeft: ul, MaxLife: ml, LastUsed: '', Remarks: remarks }));

    setSyncStatus('ok', 'Saved · ' + fmtTime());
    showMsg('mnew-msg', `Instrument ${sn} added successfully.`, 'ok');
    document.getElementById('mnew-sn').value      = '';
    document.getElementById('mnew-remarks').value = '';
    document.getElementById('mnew-staff').value   = '';
    document.getElementById('mnew-maxlife').value  = '';
    document.getElementById('mnew-usesleft').value = '';
    document.getElementById('mnew-type').value     = '';
    document.getElementById('mnew-status').value   = '';
  } catch (e) {
    setSyncStatus('err', 'Save failed');
    showMsg('mnew-msg', 'Failed to save. Check your connection.', 'err');
  }
  setBtn('btn-add-instr', false);
}

async function addConsumable() {
  const sn         = document.getElementById('mcon-sn').value.trim();
  const type       = document.getElementById('mcon-type').value;
  const balance    = document.getElementById('mcon-balance').value;
  const maxBalance = document.getElementById('mcon-maxbalance').value;
  const expiry     = document.getElementById('mcon-expiry').value;
  const lastUsed   = document.getElementById('mcon-lastused').value;
  const staff      = document.getElementById('mcon-staff').value.trim();

  if (!sn || !type || balance === '' || !maxBalance) { showMsg('mcon-msg', 'SN, type, balance and max balance are required.', 'err'); return; }
  if (!staff) { showMsg('mcon-msg', 'Please enter the name of the staff adding this consumable.', 'err'); return; }

  setBtn('btn-add-cons', true);
  try {
    await api({ action: 'saveConsumable', SN: sn, Type: type, Balance: Number(balance), MaxBalance: Number(maxBalance), Expiry: expiry, LastUsed: lastUsed });
    await api({ action: 'saveAudit', Timestamp: new Date().toISOString(), Event: 'Consumable added', Type: type, SN: sn, Staff: staff, Notes: `Balance: ${balance}/${maxBalance}${expiry ? ' | Expiry: ' + expiry : ''}` });

    state.consumables.push(normaliseConsumable({ SN: sn, Type: type, Balance: Number(balance), MaxBalance: Number(maxBalance), Expiry: expiry, LastUsed: lastUsed }));

    setSyncStatus('ok', 'Saved · ' + fmtTime());
    showMsg('mcon-msg', `Consumable ${sn} added.`, 'ok');
    document.getElementById('mcon-sn').value         = '';
    document.getElementById('mcon-balance').value    = '';
    document.getElementById('mcon-maxbalance').value = '';
    document.getElementById('mcon-expiry').value     = '';
    document.getElementById('mcon-lastused').value   = '';
    document.getElementById('mcon-staff').value      = '';
    document.getElementById('mcon-type').value       = '';
  } catch (e) {
    setSyncStatus('err', 'Save failed');
    showMsg('mcon-msg', 'Failed to save. Check your connection.', 'err');
  }
  setBtn('btn-add-cons', false);
}

async function condemnInstrument() {
  const type   = document.getElementById('mcnd-type').value;
  const sn     = document.getElementById('mcnd-sn').value;
  const reason = document.getElementById('mcnd-reason').value;
  const staff  = document.getElementById('mcnd-staff').value.trim();
  const notes  = document.getElementById('mcnd-notes').value.trim();

  if (!type || !sn || !reason || !staff) { showMsg('mcnd-msg', 'All fields except notes are required.', 'err'); return; }

  const inst = state.instruments.find(i => i.sn === sn);
  if (!inst) { showMsg('mcnd-msg', 'Instrument not found.', 'err'); return; }

  const prevStatus = inst.status;

  setBtn('btn-condemn', true);
  try {
    await api({ action: 'saveInstrument', SN: inst.sn, Type: inst.type, Status: 'Condemned', UsesLeft: inst.usesLeft, MaxLife: inst.maxLife, LastUsed: inst.lastUsed, Remarks: inst.remarks });
    await api({ action: 'saveAudit', Timestamp: new Date().toISOString(), Event: 'Instrument condemned', Type: inst.type, SN: inst.sn, Staff: staff, Notes: `Reason: ${reason}${notes ? ' | ' + notes : ''}` });

    inst.status = 'Condemned';

    setSyncStatus('ok', 'Saved · ' + fmtTime());
    showMsg('mcnd-msg', `${sn} has been permanently retired and marked as Condemned.`, 'ok');
    document.getElementById('mcnd-staff').value = '';
    document.getElementById('mcnd-notes').value = '';
    document.getElementById('mcnd-type').value  = '';
    document.getElementById('mcnd-sn').innerHTML = '<option value="">Select SN...</option>';
  } catch (e) {
    inst.status = prevStatus;
    setSyncStatus('err', 'Save failed');
    showMsg('mcnd-msg', 'Failed to save. Check your connection.', 'err');
  }
  setBtn('btn-condemn', false);
}

// ── Fault log ─────────────────────────────────────────────────────────────────

function renderFaults() {
  const types = [...new Set(state.faults.map(f => f.Type || f.type || ''))].sort();
  const fd    = document.getElementById('ffilt-type');
  const cur   = fd.value;
  fd.innerHTML = '<option value="">All types</option>' + types.map(t => `<option${t === cur ? ' selected' : ''}>${t}</option>`).join('');

  const ft = fd.value;
  const fk = document.getElementById('ffilt-kind').value;
  const list = [...state.faults]
    .filter(f => (!ft || (f.Type || f.type) === ft) && (!fk || (f.Kind || f.kind) === fk))
    .sort((a, b) => (b.Date || b.date || '').localeCompare(a.Date || a.date || ''));

  document.getElementById('fault-list').innerHTML = list.length === 0
    ? '<div class="empty">No faults logged</div>'
    : list.map(f => `
      <div class="fi">
        <div class="fi-top">
          <span class="fi-sn">${f.SN || f.sn}</span>
          <span style="font-size:11px;color:var(--text3)">${f.Type || f.type}</span>
          ${fbadge(f.Kind || f.kind)}
          <span class="fi-date">${f.Date || f.date}</span>
        </div>
        <div class="fi-note">${f.Notes || f.notes || '—'}${(f.Staff || f.staff) ? ' — ' + (f.Staff || f.staff) : ''}</div>
      </div>`).join('');
}

// ── Audit trail ───────────────────────────────────────────────────────────────

function renderAudit() {
  const rows = [...state.audit].reverse();
  document.getElementById('audit-table').innerHTML = rows.length === 0
    ? '<tr><td colspan="6" class="empty">No events recorded yet</td></tr>'
    : rows.map(r => {
        const event = r.Event || r.event || '';
        return `
        <tr>
          <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${(r.Timestamp || r.timestamp || '').toString().slice(0, 19).replace('T', ' ')}</td>
          <td><span class="badge ${auditBadgeClass(event)}">${event}</span></td>
          <td style="font-size:12px">${r.Type  || r.type  || ''}</td>
          <td class="mono">${r.SN    || r.sn    || ''}</td>
          <td style="font-size:12px">${r.Staff  || r.staff || '—'}</td>
          <td style="font-size:12px;color:var(--text2)">${r.Notes  || r.notes || '—'}</td>
        </tr>`;
      }).join('');
}

// ── Export ────────────────────────────────────────────────────────────────────

function dl(text, fn) {
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(text);
  a.download = fn;
  a.click();
}

function csv(val) {
  return `"${(val || '').toString().replace(/"/g, '""')}"`;
}

function exportAll() {
  const rows = ['SN,Type,Status,Uses Left,Max Life,Last Used,Remarks',
    ...state.instruments.map(i => [i.sn, i.type, i.status, i.usesLeft, i.maxLife, i.lastUsed, i.remarks].map(csv).join(','))];
  dl(rows.join('\n'), 'instruments_' + new Date().toISOString().slice(0, 10) + '.csv');
}

function exportAudit() {
  const rows = ['Timestamp,Event,Type,SN,Staff,Notes',
    ...state.audit.map(r => [r.Timestamp || r.timestamp, r.Event || r.event, r.Type || r.type, r.SN || r.sn, r.Staff || r.staff, r.Notes || r.notes].map(csv).join(','))];
  dl(rows.join('\n'), 'audit_' + new Date().toISOString().slice(0, 10) + '.csv');
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    n.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' +
    n.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
}
