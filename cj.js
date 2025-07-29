// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
// https://on.cypress.io/custom-commands
// ***********************************************

import {
  BASE_URL,
  USERNAME,
  PASSWORD,
  CANCEL,
  CLICKED
} from './constants';

Cypress.Commands.add('ssoLogin', () => {
  return cy
    .request({
      method: 'GET',
      url: BASE_URL,
      failOnStatusCode: false
    })
    .then(response => {
      const locationUrl = getLocationUrl(response);

      return cy
        .request({ method: 'GET', url: locationUrl })
        .then(response => {
          const location = getLoc(response);

          return cy
            .request({
              method: 'POST',
              url: location,
              form: true,
              body: {
                'pf.username': USERNAME,
                'pf.pass': PASSWORD,
                'pf.ok': CLICKED,
                'pf.cancel': CANCEL
              }
            })
            .then(response => {
              const authVerification = getAuthVerification(response);
              Cypress.env('auth_verification', authVerification);

              const redirectUrl = getRedirectUrl(response);
              cy.log(`✅ auth_verification=${authVerification}`);

              return cy
                .request({
                  method: 'GET',
                  url: redirectUrl,
                  headers: {
                    Cookie: `auth_verification=${authVerification}`
                  }
                })
                .then(response => {
                  const appSession = getAppSession(response);
                  const date = new Date();
                  Cypress.env('cookieTime', date);
                  Cypress.env('appSession', appSession);
                  return cy.wrap(null);
                });
            });
        });
    });
});

Cypress.Commands.add('ssoLoginOnce', () => {
  const sessionTimeout = 25 * 60 * 1000;
  const cookieTime = Cypress.env('cookieTime');
  const appSession = Cypress.env('appSession');

  if (appSession && cookieTime) {
    const currentTime = new Date().getTime();
    const sessionAge = currentTime - new Date(cookieTime).getTime();
    if (sessionAge < sessionTimeout) {
      console.log('♻️ Reusing existing session');
      return;
    }
  }

  cy.session('cat-sso-session', () => {
    return cy.ssoLogin();
  });
});

// ===== Helper functions =====

const getLocationUrl = response => {
  const responseHeaders = response.allRequestResponses?.[0]?.['Response Headers'];
  return responseHeaders?.['location'];
};

const getAuthVerification = response => {
  const cookieHeader = response.headers['set-cookie']?.[0];
  console.log('🔍 set-cookie:', cookieHeader);

  if (!cookieHeader) {
    throw new Error('❌ auth_verification cookie not found');
  }

  return extractValueFromCookie(cookieHeader, 'auth_verification');
};

const getLoc = response => {
  const responseHeaders = response.allRequestResponses?.[0]?.['Response Headers'];
  return responseHeaders?.['location'];
};

const getRedirectUrl = response => {
  const redirectLine = response.redirects?.[0] || '';
  const redirectRegex = /^\S+ (https?:\/\/.+)$/;
  const match = redirectRegex.exec(redirectLine);
  return match ? match[1] : null;
};

const getAppSession = response => {
  return response.headers['set-cookie'];
};

const extractValueFromCookie = (cookie, key) => {
  const [value] =
    cookie
      ?.split(';')
      ?.find(part => part.trim().startsWith(`${key}=`))
      ?.split('=') || [];
  return value;
};

// ===== Configs & Utilities =====

beforeEach(() => {
  cy.document({ timeout: 30000 }).should('have.property', 'readyState', 'complete');
});

Cypress.config('defaultCommandTimeout', 10000);

// Headless log support
Cypress.Commands.overwrite('log', function (log, ...args) {
  if (Cypress.browser.isHeadless) {
    return cy.task('log', args, { log: false }).then(() => log(...args));
  } else {
    console.log(...args);
    return log(...args);
  }
});

Cypress.Commands.add('stablizeApp', () => {
  cy.wait(2000);
});
