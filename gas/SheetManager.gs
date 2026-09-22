// SheetManager.gs — Creates user-specific spreadsheet copies from a template
var TEMPLATE_SHEET_ID = 'replace-with-template-sheet-id';

function authorizeFinariAccess() {
  if (!TEMPLATE_SHEET_ID || TEMPLATE_SHEET_ID === 'replace-with-template-sheet-id') {
    throw new Error('Set TEMPLATE_SHEET_ID before authorizing Finari access');
  }

  var templateFile = DriveApp.getFileById(TEMPLATE_SHEET_ID);
  var ss = SpreadsheetApp.openById(TEMPLATE_SHEET_ID);

  return {
    ok: true,
    templateName: templateFile.getName(),
    spreadsheetName: ss.getName()
  };
}
function authorizeMemFinanceAccess() {
  return authorizeFinariAccess();
}

function testCreateSheet() {
  return createSheetForUser('manual-test-' + Date.now());
}

function handleCreateSheet(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('handleCreateSheet must be called by doPost. Run authorizeFinariAccess or testCreateSheet manually.');
  }

  const payload = JSON.parse(e.postData.contents);
  const { userId } = payload.data || {};

  return createSheetForUser(userId);
}

function createSheetForUser(userId) {
  if (!userId) throw new Error('Missing userId');

  var templateFile = DriveApp.getFileById(TEMPLATE_SHEET_ID);
  var copy = templateFile.makeCopy('Finari_' + userId);
  var sheetId = copy.getId();

  var ss = SpreadsheetApp.openById(sheetId);
  prepareUserSpreadsheet(ss);

  return Utils.successResponse({ gaSheetId: sheetId });
}

function prepareUserSpreadsheet(ss) {
  keepOnlyDefaultCategories(ss.getSheetByName('categories'));
  clearDataRows(ss.getSheetByName('transactions'));
  clearDataRows(ss.getSheetByName('budgets'));
}

function clearDataRows(sheet) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

function keepOnlyDefaultCategories(sheet) {
  if (!sheet) return;

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    CategoryService.seed(sheet);
    return;
  }

  var headers = values[0];
  var isDefaultIndex = headers.indexOf('isDefault');
  var flagActiveIndex = headers.indexOf('flagActive');
  if (isDefaultIndex === -1 || flagActiveIndex === -1) {
    throw new Error('categories sheet must include isDefault and flagActive columns');
  }

  var defaultRows = values.slice(1).filter(function(row) {
    return isTruthyCell(row[isDefaultIndex]) && isTruthyCell(row[flagActiveIndex]);
  });

  clearDataRows(sheet);
  if (defaultRows.length > 0) {
    sheet.getRange(2, 1, defaultRows.length, headers.length).setValues(defaultRows);
  } else {
    CategoryService.seed(sheet);
  }
}

function isTruthyCell(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}
