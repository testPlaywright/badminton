// cypress.config.js
const { defineConfig } = require('cypress');
const fs = require('fs');
const { queryDb } = require('./cypress/plugins/ConnectDB.cjs');
const ExcelJS = require('exceljs'); // kept for readErrorExcelExcelJS
const path = require('path');
const cucumber = require('cypress-cucumber-preprocessor').default;
const dayjs = require('dayjs');
const XlsxPopulate = require('xlsx-populate');

const envJson = JSON.parse(fs.readFileSync('cypress.env.json', 'utf-8'));

// ==== Template settings ====
const TEMPLATE_FILE  = 'intentTemplate.xlsx'; // cypress/fixtures/<this>
const TEMPLATE_SHEET = 'CAT Automated';       // tab name

// ---------- helpers ----------
const toKey = (s) => String(s || '').toLowerCase().replace(/[\s_\-]/g, '');

// map incoming Example keys -> header names
const normalizeIncomingKey = (k) => {
  const key = toKey(k);
  const alias = {
    pdlmrow: 'pdlmrow',
    edittype: 'edittype',
    listids: 'listids',
    lobcodes: 'lobcodes',
    producttype: 'producttype',
    productid: 'productid',
  };
  return alias[key] || key;
};

// scan a row for texts safely (works with merged/empty cells)
function readRowTexts(sheet, row, maxCols = 300, blankHysteresis = 10) {
  const vals = [];
  let blanks = 0, started = false;
  for (let c = 1; c <= maxCols; c++) {
    const v = sheet.cell(row, c).value();
    const t = (v == null) ? '' : String(v).trim();
    if (t) { vals.push(t); started = true; blanks = 0; }
    else if (started && ++blanks >= blankHysteresis) break;
  }
  return vals;
}

// find header row by looking for expected tokens anywhere between rows 1..40
function findHeaderRow(sheet, expected = ['pdlmRow','EditType']) {
  for (let r = 1; r <= 40; r++) {
    const vals = readRowTexts(sheet, r);
    const keys = vals.map(toKey);
    const hit = expected.every(e => keys.includes(toKey(e)));
    if (hit) return { headerRow: r, headers: vals };
  }
  throw new Error('Header row not found (looked for: ' + expected.join(', ') + ')');
}

async function makeXlsxWithPopulate(rows, outName) {
  const templatePath = path.join(__dirname, 'cypress', 'fixtures', TEMPLATE_FILE);
  const downloadsDir = path.join(__dirname, 'cypress', 'downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const fileName = outName || 'CLINICAL_INTENT.xlsx';
  const outPath  = path.join(downloadsDir, fileName);

  const wb    = await XlsxPopulate.fromFileAsync(templatePath);
  const sheet = wb.sheet(TEMPLATE_SHEET);
  if (!sheet) throw new Error(`Sheet "${TEMPLATE_SHEET}" not found in ${TEMPLATE_FILE}`);

  const { headerRow, headers } = findHeaderRow(sheet, ['pdlmRow','EditType']);
  const firstDataRow = headerRow + 1;

  // build header -> column map
  const headerToCol = {};
  headers.forEach((h, idx) => { headerToCol[toKey(h)] = idx + 1; });

  // one-time debug (appears in terminal)
  if (!makeXlsxWithPopulate._logged) {
    console.log('[CAT] Found header row:', headerRow);
    console.log('[CAT] Headers:', headers);
    console.log('[CAT] Header keys:', headers.map(toKey));
    makeXlsxWithPopulate._logged = true;
  }

  let r = firstDataRow;
  (rows && rows.length ? rows : [{}]).forEach(rowObj => {
    Object.entries(rowObj || {}).forEach(([k, v]) => {
      const col = headerToCol[ normalizeIncomingKey(k) ];
      if (col) sheet.cell(r, col).value(v);
    });
    r++;
  });

  await wb.toFileAsync(outPath);
  return { fileName: path.basename(outPath), fullPath: outPath };
}

module.exports = defineConfig({
  defaultCommandTimeout: 300000,
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    charts: true,
    json: true,
    saveJson: true,
    reportDir: process.env.REPORT_PATH,
    overwrite: false,
    reportFilename: 'index',
    reportPageTitle: 'CAT Automation Report',
    reportTitle: 'CAT Automation Regression Report',
    inlineAssets: true,
    html: true,
    saveHtml: true,
    embeddedScreenshots: true,
    saveAllAttempts: false
  },
  'cypress-cucumber-preprocessor': {
    nonGlobalStepDefinitions: true,
    stepDefinitions: './cypress/e2e/stepdefinitions'
  },
  e2e: {
    supportFile: 'cypress/support/e2e.js',
    chromeWebSecurity: false,
    experimentalRunAllSpecs: true,
    experimentalSessionAndOrigin: true,
    setupNodeEvents(on, config) {
      console.log('Cypress REPORT_PATH:', process.env.REPORT_PATH);
      on('file:preprocessor', cucumber());
      require('cypress-mochawesome-reporter/plugin')(on);

      on('task', {
        // util
        log(args) { console.log(...args); return null; },

        // DB passthrough
        queryDb({ query, values }) { return queryDb(query, values); },

        // your existing Excel reader
        async readErrorExcelExcelJS(fileName) {
          const filePath = path.join(__dirname, 'cypress', 'downloads', fileName);
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(filePath);
          const sheet = workbook.getWorksheet('ValidationErrors') || workbook.worksheets[0];
          const rows = [];
          sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;
            rows.push({
              ticketId: row.getCell(1).value,
              field: row.getCell(4).value,
              errorMessage: row.getCell(6).value
            });
          });
          return rows;
        },

        // WRITE: single row (@intentRow)
        async 'intent:makeFile'({ row, outName, filename }) {
          return makeXlsxWithPopulate([row || {}], outName || filename);
        },

        // WRITE: many rows (@intentRows)
        async 'intent:makeFileMany'({ rows, outName, filename }) {
          return makeXlsxWithPopulate(rows || [], outName || filename);
        }
      });

      return config;
    },

    include: ['./node_modules/cypress', 'cypress/**/*.js'],
    specPattern: 'cypress/e2e/**/*.feature',
    env: {
      BASE_URL: process.env.BASE_URL,
      uploadFileName: envJson.uploadFileName,
      TAGS: 'not @ignore'
    },
    retries: 1
  },

  component: {
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config);
    }
  }
});