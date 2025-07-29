import {
  BASE_URL,
  USERNAME,
  PASSWORD,
  CANCEL,
  CLICKED,
} from '../constants';

// Utility to extract redirect URL
const getRedirectUrl = (response) => {
  const redirectRegex = /^https?:\/\/.+/;
  const match = redirectRegex.exec(response.redirects?.[0] || '');
  return match ? match[0] : null;
};

// Extract from 'set-cookie' header
const getAuthVerification = (response) => {
  console.log('🔍 Full Headers:', response.headers); // Debug log
  const cookieHeader = response.headers['set-cookie']?.[0];

  if (!cookieHeader) {
    throw new Error('❌ auth_verification cookie not found in response headers');
  }

  return extractValueFromCookie(cookieHeader, 'auth_verification');
};

// Parse specific cookie value
const extractValueFromCookie = (cookie, key) => {
  const [value] =
    cookie
      ?.split(';')
      ?.find((part) => part.trim().startsWith(`${key}=`))
      ?.split('=') || [];
  return value;
};

// Get cookie from response directly
const getAppSession = (response) => {
  return response.headers['set-cookie'];
};

Cypress.Commands.add('ssoLogin', () => {
  return cy
    .request({
      method: 'GET',
      url: BASE_URL,
      failOnStatusCode: false,
    })
    .then((response) => {
      const locationUrl = getLocationUrl(response);

      return cy.request({
        method: 'POST',
        url: locationUrl,
        form: true,
        body: {
          'pf.username': USERNAME,
          'pf.pass': PASSWORD,
          'pf.ok': CLICKED,
          'pf.cancel': CANCEL,
        },
      });
    })
    .then((response) => {
      // ✅ Moved cookie extraction to here (correct response)
      const authVerification = getAuthVerification(response);
      Cypress.env('auth_verification', authVerification);

      const redirectUrl = getRedirectUrl(response);
      cy.log(`✅ auth_verification=${authVerification}`);

      return cy.request({
        method: 'GET',
        url: redirectUrl,
        headers: {
          Cookie: `auth_verification=${Cypress.env('auth_verification')}`,
        },
      });
    })
    .then((response) => {
      // Extract and store app session (optional)
      const appSession = getAppSession(response);
      Cypress.env('appSession', appSession);
      return cy.wrap(null); // To make the chainable
    });
});

// Wrap in cy.session for reuse
Cypress.Commands.add('ssoLoginOnce', () => {
  const sessionTimeout = 25 * 60 * 1000; // 25 minutes
  const cookieTime = Cypress.env('cookieTime');
  const appSession = Cypress.env('appSession');
  const currentTime = new Date().getTime();
  const sessionAge = new Date(cookieTime).getTime();

  if (appSession && sessionAge < sessionTimeout) {
    console.log('♻️ Reusing existing session');
    return;
  }

  cy.session('cat-sso-session', () => {
    return cy.ssoLogin();
  });
});

// Get redirect location
const getLocationUrl = (response) => {
  const headers = response.allRequestResponses?.[0]?.['Response Headers'];
  return headers?.['location'];
};
