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
      const authVerification = getAuthVerification(response);
      Cypress.env('auth_verification', authVerification);

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
              const redirectUrl = getRedirectUrl(response);
              cy.log(
                `auth_verification=${Cypress.env('auth_verification')}`
              );
              return cy
                .request({
                  method: 'GET',
                  url: redirectUrl,
                  headers: {
                    Cookie:
                      'auth_verification=' +
                      Cypress.env('auth_verification')
                  }
                })
                .then(response => {
                  const appSession = getAppSession(response);
                  const date = new Date();
                  Cypress.env('cookieTime', date);
                  Cypress.env('appSession', appSession);
                  return cy.wrap(null); // Final return to make it chainable
                });
            });
        });
    });
});

Cypress.Commands.add('ssoLoginOnce', () => {
  const sessionTimeout = 25 * 60 * 1000; // 25 minutes
  const cookieTime = Cypress.env('cookieTime');
  const appSession = Cypress.env('appSession');

  if (appSession && cookieTime) {
    const currentTime = new Date().getTime();
    const sessionAge = currentTime - new Date(cookieTime).getTime();
    if (sessionAge < sessionTimeout) {
      console.log('Reusing existing session');
      return;
    }
  }

  cy.session('cat-sso-session', () => {
    return cy.ssoLogin();
  });
});

// Helper functions
const getLocationUrl = response => {
  const responseHeaders =
    response.allRequestResponses[0]['Response Headers'];
  return responseHeaders['location'];
};

const getAuthVerification = response => {
  const cookieHeader = response.headers['set-cookie'][0];
  return extractValueFromCookie(cookieHeader, 'auth_verification');
};

const getLoc = response => {
  const responseHeaders =
    response.allRequestResponses[0]['Response Headers'];
  return responseHeaders['location'];
};

const getRedirectUrl = response => {
  const redirectRegex = /^\S+ (.+)$/;
  const match = redirectRegex.exec(response.redirects[0]);
  return match ? match[1] : null;
};

const getAppSession = response => {
  return response.headers['set-cookie'];
};

const extractValueFromCookie = (cookie, key) => {
  const [value] =
    cookie
      .split(';')
      .find(part => part.startsWith(`${key}=`))
      ?.split('=') || [];
  return value;
};

beforeEach(() => {
  cy.document({ timeout: 30000 }).should(
    'have.property',
    'readyState',
    'complete'
  );
});

Cypress.config('defaultCommandTimeout', 10000);

// Headless log support
Cypress.Commands.overwrite('log', function (log, ...args) {
  if (Cypress.browser.isHeadless) {
    return cy.task('log', args, { log: false }).then(() => {
      return log(...args);
    });
  } else {
    console.log(...args);
    return log(...args);
  }
});

Cypress.Commands.add('stablizeApp', () => {
  cy.wait(2000); // Wait for 2 seconds to stabilize the app
});
