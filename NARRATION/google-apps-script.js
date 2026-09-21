/**
 * @OnlyCurrentDoc
 * =========================================================================
 * NARRATION STOCK LEDGER - ADVANCED GOOGLE SHEETS BACKUP MANAGER
 * Multi-Session Versioning, Idempotent Overwrite & Historical Archival
 * =========================================================================
 * 
 * DEPLOYMENT OPTIONS:
 * - Execute As: "User accessing the web app" OR "Me"
 * - Who has access: "Anyone with a Google Account" OR "Anyone"
 * =========================================================================
 */

/**
 * Handle HTTP GET - Health Check
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "Narration Advanced Google Sheets Backup Manager",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates custom menu in Google Sheets
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Narration Ledger")
      .addItem("Clean Tab Names (Remove 'Backup')", "cleanAllTabNames")
      .addToUi();
  } catch (e) {}
}

/**
 * Clean and rename all legacy tabs in Google Sheets:
 * "Narration_Backup" -> "Narration"
 * "Tab_1_Backup" -> "Tab 1", ... "Tab_10_Backup" -> "Tab 10"
 * Can be run manually from Apps Script Editor (select cleanAllTabNames and click Run)
 */
function cleanAllTabNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  renameAllLegacyTabs(ss);
}

/**
 * Rename any sheet having "_Backup" or "Backup" to clean names
 */
function renameAllLegacyTabs(ss) {
  const sheets = ss.getSheets();
  sheets.forEach(sheet => {
    const currentName = sheet.getName();

    // 1. Narration sheet
    if (/^Narration[ _]?Backup$/i.test(currentName)) {
      const targetName = "Narration";
      const existingTarget = ss.getSheetByName(targetName);
      if (!existingTarget) {
        try { sheet.setName(targetName); } catch(e) {}
      } else if (existingTarget.getLastRow() <= 1 && sheet.getLastRow() > 1) {
        try {
          ss.deleteSheet(existingTarget);
          sheet.setName(targetName);
        } catch(e) {}
      }
      return;
    }

    // 2. Sub-tab sheets (Tab_1_Backup, Tab 1 Backup, etc.)
    const match = currentName.match(/^Tab[ _]?(\d+)[ _]?Backup$/i);
    if (match) {
      const tabNum = match[1];
      const targetName = "Tab " + tabNum;
      const existingTarget = ss.getSheetByName(targetName);
      if (!existingTarget) {
        try { sheet.setName(targetName); } catch(e) {}
      } else if (existingTarget.getLastRow() <= 1 && sheet.getLastRow() > 1) {
        try {
          ss.deleteSheet(existingTarget);
          sheet.setName(targetName);
        } catch(e) {}
      }
    }
  });
}

/**
 * Handle HTTP POST - Process Backup Actions (Update, Append, Delete)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000); // wait up to 30 seconds

  if (!hasLock) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Server is busy processing another backup. Please try again."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No payload data received.");
    }

    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure all legacy tab names are cleaned immediately
    renameAllLegacyTabs(ss);

    const action = payload.action || "update"; // "update", "append", or "delete"
    const sessionName = payload.sessionName || "Session 1";
    const dateStr = payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const refNo = payload.refNo || "N/A";
    const timestamp = payload.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    const sheetList = ["Narration"];
    for (let i = 1; i <= 10; i++) {
      sheetList.push("Tab " + i);
    }

    // ACTION: DELETE TODAY'S BACKUP
    if (action === "delete") {
      let deletedCount = 0;
      sheetList.forEach(sheetName => {
        const legacyName = sheetName === "Narration" ? "Narration_Backup" : sheetName.replace("Tab ", "Tab_") + "_Backup";
        const sheet = ss.getSheetByName(sheetName) || ss.getSheetByName(legacyName);
        if (sheet) {
          deletedCount += deleteAllBlocksForDate(sheet, dateStr, sessionName);
        }
      });

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: "delete",
        message: "Today's backup (" + formatDateForDisplay(dateStr) + " - " + sessionName + ") successfully removed from Google Sheets.",
        deletedBlocks: deletedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: UPDATE (OVERWRITE) OR APPEND (NEW SESSION)
    const updatedSheets = [];

    // 1. Process Main Narration Sheet Backup
    if (payload.narration) {
      const sheetName = "Narration";
      const sheet = getOrCreateSheet(ss, sheetName, "#d97706");
      saveModuleBlock(sheet, {
        action: action,
        moduleTitle: "Main Narration Stock Reconciliation",
        dateStr: dateStr,
        sessionName: sessionName,
        refNo: refNo,
        timestamp: timestamp,
        headers: payload.narration.headers || ["No.", "NARRATION", "RECEIPT", "ISSUE", "BALANCE", "REMARKS"],
        rows: payload.narration.rows || [],
        summary: payload.narration.summary || []
      });
      updatedSheets.push(sheetName);
    }

    // 2. Process All 10 Sub-Tabs Backups
    if (payload.subTabs && Array.isArray(payload.subTabs)) {
      payload.subTabs.forEach(tab => {
        const sheetName = "Tab " + tab.num;
        const sheetColor = tab.group === "A" ? "#ea580c" : (tab.group === "B" ? "#2563eb" : "#0d9488");
        const sheet = getOrCreateSheet(ss, sheetName, sheetColor);

        saveModuleBlock(sheet, {
          action: action,
          moduleTitle: "Sub-Sheet: " + (tab.name || ("Tab " + tab.num)) + " (" + tab.id.toUpperCase() + ")",
          dateStr: tab.date || dateStr,
          sessionName: sessionName,
          refNo: refNo,
          timestamp: timestamp,
          headers: tab.headers || ["No.", "Item Name", "2", "3", "4"],
          rows: tab.rows || [],
          summary: tab.summary || []
        });
        updatedSheets.push(sheetName);
      });
    }

    const actionText = action === "append" ? "appended as new session" : "updated & synchronized";
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      action: action,
      message: "Backup " + actionText + " for " + formatDateForDisplay(dateStr) + " (" + sessionName + ").",
      date: dateStr,
      sessionName: sessionName,
      refNo: refNo,
      timestamp: timestamp,
      updatedSheets: updatedSheets
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message || err.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Get existing sheet or create a formatted new sheet
 */
function getOrCreateSheet(ss, name, tabColor) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Automatically migrate legacy backup tab names if present
    const legacyName = name === "Narration" ? "Narration_Backup" : name.replace("Tab ", "Tab_") + "_Backup";
    const legacySheet = ss.getSheetByName(legacyName);
    if (legacySheet) {
      try { legacySheet.setName(name); } catch(e) {}
      sheet = legacySheet;
    } else {
      sheet = ss.insertSheet(name);
    }
    if (tabColor) {
      try { sheet.setTabColor(tabColor); } catch (e) {}
    }
  }
  return sheet;
}

/**
 * Write, Update (Overwrite), or Append a Data Block in a Sheet
 */
function saveModuleBlock(sheet, data) {
  const blockMarker = "[BLOCK_MARKER: DATE=" + data.dateStr + " | SESSION=" + data.sessionName + " | REF=" + data.refNo + "]";
  const numCols = data.headers.length;

  // If Action is "update" (Overwrite): locate existing block for this date & session
  if (data.action === "update") {
    const existingRange = findBlockRangeByMarker(sheet, data.dateStr, data.sessionName);
    if (existingRange) {
      sheet.deleteRows(existingRange.startRow, existingRange.rowCount);
    }
  }

  // Determine insert position (append at bottom)
  let insertRow = sheet.getLastRow() + 1;
  if (insertRow > 1) {
    insertRow += 1; // Add 1 blank row spacing between blocks
  }

  const blockRows = [];

  // 1. Metadata Block (Header Hierarchy)
  blockRows.push(padRow([blockMarker], numCols));
  blockRows.push(padRow([
    "DATE: " + formatDateForDisplay(data.dateStr),
    "SESSION: " + data.sessionName,
    "REF NO: " + data.refNo,
    "MODULE: " + data.moduleTitle,
    "TIME: " + data.timestamp
  ], numCols));

  // 2. Table Column Headers
  blockRows.push(padRow(data.headers, numCols));

  // 3. Table Data Rows (Exact numerical precision)
  if (data.rows && data.rows.length > 0) {
    data.rows.forEach(r => {
      blockRows.push(padRow(r, numCols));
    });
  } else {
    blockRows.push(padRow(["1", "No entries recorded"], numCols));
  }

  // 4. Summary / Footer Rows
  if (data.summary && data.summary.length > 0) {
    data.summary.forEach(s => {
      blockRows.push(padRow(s, numCols));
    });
  }

  // End of block separator marker
  blockRows.push(padRow(["[END_BLOCK]"], numCols));

  // Write all block rows atomically
  const targetRange = sheet.getRange(insertRow, 1, blockRows.length, numCols);
  targetRange.setValues(blockRows);

  // Apply Styling & Visual Formatting
  formatBlock(sheet, insertRow, blockRows.length, numCols, data.rows ? data.rows.length : 1, data.summary ? data.summary.length : 0);
}

/**
 * Find start row and row count of an existing block matching Date and Session
 */
function findBlockRangeByMarker(sheet, dateStr, sessionName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return null;

  const colA = sheet.getRange(1, 1, lastRow, 1).getValues();
  let startRow = -1;
  let endRow = -1;

  for (let i = 0; i < colA.length; i++) {
    const val = String(colA[i][0]);
    // Match block marker with Date and Session
    if (val.indexOf("[BLOCK_MARKER:") === 0 && val.indexOf("DATE=" + dateStr) !== -1 && val.indexOf("SESSION=" + sessionName) !== -1) {
      startRow = i + 1;
    } else if (startRow !== -1 && (val === "[END_BLOCK]" || val.indexOf("[BLOCK_MARKER:") === 0)) {
      endRow = (val === "[END_BLOCK]") ? (i + 1) : i;
      break;
    }
  }

  if (startRow !== -1) {
    if (endRow === -1) endRow = lastRow;
    return {
      startRow: startRow,
      rowCount: (endRow - startRow + 1)
    };
  }

  return null;
}

/**
 * Delete all blocks matching the given Date (and optional Session)
 */
function deleteAllBlocksForDate(sheet, dateStr, sessionName) {
  let count = 0;
  let attempts = 0;

  while (attempts < 20) {
    attempts++;
    const range = findBlockRangeByDate(sheet, dateStr, sessionName);
    if (!range) break;
    sheet.deleteRows(range.startRow, range.rowCount);
    count++;
  }

  return count;
}

/**
 * Search for any block matching dateStr (and optional sessionName)
 */
function findBlockRangeByDate(sheet, dateStr, sessionName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return null;

  const colA = sheet.getRange(1, 1, lastRow, 1).getValues();
  let startRow = -1;
  let endRow = -1;

  for (let i = 0; i < colA.length; i++) {
    const val = String(colA[i][0]);
    const matchesDate = val.indexOf("[BLOCK_MARKER:") === 0 && val.indexOf("DATE=" + dateStr) !== -1;
    const matchesSession = !sessionName || val.indexOf("SESSION=" + sessionName) !== -1;

    if (matchesDate && matchesSession) {
      startRow = i + 1;
    } else if (startRow !== -1 && (val === "[END_BLOCK]" || val.indexOf("[BLOCK_MARKER:") === 0)) {
      endRow = (val === "[END_BLOCK]") ? (i + 1) : i;
      break;
    }
  }

  if (startRow !== -1) {
    if (endRow === -1) endRow = lastRow;
    return {
      startRow: startRow,
      rowCount: (endRow - startRow + 1)
    };
  }

  return null;
}

/**
 * Format Google Sheet cells for professional readability
 */
function formatBlock(sheet, startRow, totalRows, numCols, dataRowsCount, summaryRowsCount) {
  try {
    // Hide block marker row (row 1 of block)
    sheet.hideRows(startRow);

    // Row 2: Metadata Banner
    const metaRange = sheet.getRange(startRow + 1, 1, 1, numCols);
    metaRange.setBackground("#f8fafc")
             .setFontColor("#0f172a")
             .setFontWeight("bold")
             .setFontSize(10)
             .setBorder(true, true, true, true, false, false, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);

    // Row 3: Column Headers
    const headerRange = sheet.getRange(startRow + 2, 1, 1, numCols);
    headerRange.setBackground("#1e293b")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setFontSize(10)
               .setHorizontalAlignment("center");

    // Left align text columns (Col 2: Item Name/Narration)
    if (numCols >= 2) {
      sheet.getRange(startRow + 2, 2).setHorizontalAlignment("left");
    }

    // Data Rows Formatting
    if (dataRowsCount > 0) {
      const dataStartRow = startRow + 3;
      const dataRange = sheet.getRange(dataStartRow, 1, dataRowsCount, numCols);
      dataRange.setFontSize(10)
               .setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);

      // Center Serial Numbers in Col 1
      sheet.getRange(dataStartRow, 1, dataRowsCount, 1).setHorizontalAlignment("center");
      // Left align Col 2 description
      sheet.getRange(dataStartRow, 2, dataRowsCount, 1).setHorizontalAlignment("left");
      // Right align numeric columns (Col 3 to end)
      if (numCols > 2) {
        sheet.getRange(dataStartRow, 3, dataRowsCount, numCols - 2).setHorizontalAlignment("right");
      }
    }

    // Summary Rows Formatting
    if (summaryRowsCount > 0) {
      const sumStartRow = startRow + 3 + dataRowsCount;
      const sumRange = sheet.getRange(sumStartRow, 1, summaryRowsCount, numCols);
      sumRange.setFontWeight("bold")
              .setFontSize(10)
              .setBackground("#f1f5f9")
              .setBorder(true, true, true, true, true, true, "#94a3b8", SpreadsheetApp.BorderStyle.SOLID);

      // Right align numeric totals
      if (numCols > 2) {
        sheet.getRange(sumStartRow, 3, summaryRowsCount, numCols - 2).setHorizontalAlignment("right");
      }
    }

    // Hide end block marker row
    sheet.hideRows(startRow + totalRows - 1);

    // Auto-fit column widths for clear presentation
    for (let c = 1; c <= numCols; c++) {
      sheet.autoResizeColumn(c);
      if (sheet.getColumnWidth(c) < 90) {
        sheet.setColumnWidth(c, c === 2 ? 220 : 110);
      }
    }
  } catch (styleErr) {
    Logger.log("Formatting notice: " + styleErr.message);
  }
}

/**
 * Pad array to required length with empty strings
 */
function padRow(arr, targetLen) {
  const result = [];
  for (let i = 0; i < targetLen; i++) {
    result.push(arr && i < arr.length && arr[i] !== undefined && arr[i] !== null ? String(arr[i]) : "");
  }
  return result;
}

/**
 * Format ISO date string YYYY-MM-DD to DD/MM/YYYY
 */
function formatDateForDisplay(dStr) {
  if (!dStr) return "";
  const parts = String(dStr).split("-");
  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }
  return String(dStr);
}
