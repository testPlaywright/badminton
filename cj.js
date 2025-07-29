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

              // ✅ Final redirect to callback — where auth_verification is set
              return cy
                .request({
                  method: 'GET',
                  url: redirectUrl
                })
                .then(response => {
                  const authVerification = getAuthVerification(response); // ✅ moved here
                  Cypress.env('auth_verification', authVerification);
                  cy.log(`✅ auth_verification=${authVerification}`);

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

// ===== Optional Session Wrapper =====

Cypress.Commands.add('ssoLoginOnce', () => {
  const sessionTimeout = 25 * 60 * 1000; // 25 minutes
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

const getAuthVerification = response => {
  const setCookies = response.headers['set-cookie'];
  const cookieHeader = setCookies?.find(c => c.includes('auth_verification='));

  if (!cookieHeader) {
    throw new Error('❌ auth_verification cookie not found in Set-Cookie');
  }

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
