import {
  BASE_URL,
  USERNAME,
  PASSWORD,
  CANCEL,
  CLICKED
} from './constants';

// ===== Cypress Command: ssoLogin =====

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
          const loginUrl = getLoc(response);

          return cy
            .request({
              method: 'POST',
              url: loginUrl,
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
              cy.log(`🔁 Redirect to: ${redirectUrl}`);

              return cy
                .request({
                  method: 'GET',
                  url: redirectUrl,
                  followRedirect: true
                })
                .then(response => {
                  console.log('🔍 Final Response Headers:', response.headers);
                  cy.log('🔍 Set-Cookie:', response.headers['set-cookie']);

                  const authVerification = getAuthVerification(response);
                  Cypress.env('auth_verification', authVerification);
                  cy.log(`✅ auth_verification=${authVerification}`);

                  const appSession = getAppSession(response);
                  Cypress.env('cookieTime', new Date());
                  Cypress.env('appSession', appSession);

                  return cy.wrap(null); // Chainable
                });
            });
        });
    });
});

// ===== Reusable Session Wrapper =====

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

// ===== Helper Functions =====

const getLocationUrl = response => {
  const responseHeaders = response.allRequestResponses?.[0]?.['Response Headers'];
  return responseHeaders?.['location'];
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

const getAuthVerification = (response) => {
  const setCookies = response.headers['set-cookie'];
  console.log('🔍 Full set-cookie:', setCookies);

  if (!setCookies || !setCookies.some(c => c.includes('auth_verification='))) {
    throw new Error('❌ auth_verification cookie not found');
  }

  const cookieHeader = setCookies.find(c => c.includes('auth_verification='));
  return extractValueFromCookie(cookieHeader, 'auth_verification');
};

const extractValueFromCookie = (cookie, key) => {
  const [value] =
    cookie
      ?.split(';')
      ?.find(part => part.trim().startsWith(`${key}=`))
      ?.split('=') || [];
  return value;
};

// ===== Support Utilities =====

beforeEach(() => {
  cy.document({ timeout: 30000 }).should('have.property', 'readyState', 'complete');
});

Cypress.config('defaultCommandTimeout', 10000);

// Optional: clean logs for headless
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
