
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

              // ✅ Switch from request to visit for browser-based redirect
              return cy.visit(redirectUrl).then(() => {
                // ✅ Read cookie from browser after redirect completes
                cy.getCookie('auth_verification').then(cookie => {
                  if (!cookie || !cookie.value) {
                    throw new Error('❌ auth_verification cookie not found');
                  }

                  Cypress.env('auth_verification', cookie.value);
                  cy.log(`✅ auth_verification = ${cookie.value}`);

                  // Optional: get other session cookies if needed
                  cy.getCookies().then(cookies => {
                    Cypress.env('cookieTime', new Date());
                    Cypress.env('appSession', cookies);
                  });
                });
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
