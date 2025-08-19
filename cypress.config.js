const { defineConfig } = require('cypress');
const fs = require('fs');
const { queryDb } = require('./cypress/plugins/ConnectDB.cjs');
const ExcelJS = require('exceljs');
const path = require('path');
const { buffer } = require('stream/consumers');
const cucumber = require('cypress-cucumber-preprocessor').default;
const dayjs = require('dayjs');


const envJson = JSON.parse(
  fs.readFileSync('cypress.env.json', 'utf-8')
);
module.exports = defineConfig({
  defaultCommandTimeOut: 300000,
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
      console.log("Cypress REPORT_PATH:", process.env.REPORT_PATH);
      on('file:preprocessor', cucumber());
      on('task', {
        log(args) {
          console.log(...args);
          return null;
        }
      });

      require('cypress-mochawesome-reporter/plugin')(on);
      // DB Task registration
      on('task', {
        queryDb({ query, values }) {
          return queryDb(query, values);
        },
        async readErrorExcelExcelJS(fileName) {
          const filePath = path.join(
            __dirname,
            'cypress/downloads',
            fileName
          );
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(filePath);

          const sheet =
            workbook.getWorksheet('ValidationErrors') ||
            workbook.worksheets[0];
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
