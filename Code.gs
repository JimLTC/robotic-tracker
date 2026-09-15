// ── Robotic OT Tracker — Google Apps Script Backend ───────────────────────────
// Paste the entire contents of this file into your Apps Script editor,
// then Save and Deploy → New Deployment → Web App (Execute as: Me, Access: Anyone).

var SS_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Sheet tab names — must match exactly what is in your Google Sheet
var SHEETS = {
  instruments:  'Instruments',
  consumables:  'Consumables',
  faults:       'Faults',
  audit:        'Audit',
};

// Column headers for each sheet
var HEADERS = {
  instruments: ['SN', 'Type', 'Status', 'UsesLeft', 'MaxLife', 'LastUsed', 'LastCase', 'Remarks'],
  consumables: ['SN', 'Type', 'Balance', 'MaxBalance', 'Expiry', 'LastUsed'],
  faults:      ['ID', 'Date', 'Type', 'SN', 'Kind', 'Notes', 'Staff'],
  audit:       ['Timestamp', 'Event', 'Type', 'SN', 'Staff', 'Notes'],
};

// ── CORS helper ───────────────────────────────────────────────────────────────

function corsResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Entry points ──────────────────────────────────────────────────────────────

function doGet(e) {
  return corsResponse({ status: 'ok', message: 'Robotic OT Tracker API is running.' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'getAll')           return corsResponse(getAll());
    if (action === 'saveInstrument')   return corsResponse(saveInstrument(body));
    if (action === 'saveConsumable')   return corsResponse(saveConsumable(body));
    if (action === 'saveFault')        return corsResponse(saveFault(body));
    if (action === 'saveAudit')        return corsResponse(saveAudit(body));
    if (action === 'init')             return corsResponse(initSheets(body));

    return corsResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function sheetToObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function ensureHeaders(sheet, headers) {
  var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var needsHeaders = existing.every(function(v) { return v === ''; });
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function findRowBySN(sheet, sn) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(sn)) return i + 1; // 1-indexed
  }
  return -1;
}

// ── Actions ───────────────────────────────────────────────────────────────────

function getAll() {
  return {
    instruments: sheetToObjects(SHEETS.instruments),
    consumables: sheetToObjects(SHEETS.consumables),
    faults:      sheetToObjects(SHEETS.faults),
    audit:       sheetToObjects(SHEETS.audit),
  };
}

function saveInstrument(body) {
  var sheet = getSheet(SHEETS.instruments);
  ensureHeaders(sheet, HEADERS.instruments);
  var row = [
    body.SN       || '',
    body.Type     || '',
    body.Status   || '',
    body.UsesLeft !== undefined ? body.UsesLeft : '',
    body.MaxLife  !== undefined ? body.MaxLife  : '',
    body.LastUsed || '',
    body.LastCase || '',
    body.Remarks  || '',
  ];
  var rowNum = findRowBySN(sheet, body.SN);
  if (rowNum > 0) {
    sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

function saveConsumable(body) {
  var sheet = getSheet(SHEETS.consumables);
  ensureHeaders(sheet, HEADERS.consumables);
  var row = [
    body.SN         || '',
    body.Type       || '',
    body.Balance    !== undefined ? body.Balance    : '',
    body.MaxBalance !== undefined ? body.MaxBalance : '',
    body.Expiry     || '',
    body.LastUsed   || '',
  ];
  var rowNum = findRowBySN(sheet, body.SN);
  if (rowNum > 0) {
    sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

function saveFault(body) {
  var sheet = getSheet(SHEETS.faults);
  ensureHeaders(sheet, HEADERS.faults);
  sheet.appendRow([
    body.ID    || '',
    body.Date  || '',
    body.Type  || '',
    body.SN    || '',
    body.Kind  || '',
    body.Notes || '',
    body.Staff || '',
  ]);
  return { ok: true };
}

function saveAudit(body) {
  var sheet = getSheet(SHEETS.audit);
  ensureHeaders(sheet, HEADERS.audit);
  sheet.appendRow([
    body.Timestamp || '',
    body.Event     || '',
    body.Type      || '',
    body.SN        || '',
    body.Staff     || '',
    body.Notes     || '',
  ]);
  return { ok: true };
}

// ── Bulk seed (called once to populate empty sheets) ─────────────────────────

function initSheets(body) {
  if (body.instruments && body.instruments.length) {
    var instSheet = getSheet(SHEETS.instruments);
    instSheet.clearContents();
    instSheet.appendRow(HEADERS.instruments);
    body.instruments.forEach(function(r) {
      instSheet.appendRow([r.SN, r.Type, r.Status, r.UsesLeft, r.MaxLife, r.LastUsed, r.LastCase, r.Remarks || '']);
    });
  }
  if (body.consumables && body.consumables.length) {
    var consSheet = getSheet(SHEETS.consumables);
    consSheet.clearContents();
    consSheet.appendRow(HEADERS.consumables);
    body.consumables.forEach(function(r) {
      consSheet.appendRow([r.SN, r.Type, r.Balance, r.MaxBalance, r.Expiry || '', r.LastUsed || '']);
    });
  }
  return { ok: true, message: 'Sheets initialised.' };
}
