// cypress/support/commands.js

Cypress.Commands.add('ssoLoginOnce', () => {
  cy.session('ssoSession', () => {
    cy.request({
      method: 'GET',
      url: 'https://rxc-cat-test.optum.com/login', // Adjust to actual SSO init URL
      followRedirect: false
    }).then((res1) => {
      const authLocation = res1.redirectedToUrl || res1.headers.location;

      cy.request({
        method: 'GET',
        url: authLocation,
        followRedirect: false
      }).then((res2) => {
        const callbackUrl = res2.redirectedToUrl || res2.headers.location;

        cy.request({
          method: 'GET',
          url: callbackUrl,
          followRedirect: false
        }).then((res3) => {
          const finalRedirect = res3.headers.location;

          cy.request({
            method: 'GET',
            url: finalRedirect,
            followRedirect: false
          }).then((res4) => {
            const cookies = res4.headers['set-cookie'] || [];

            cookies.forEach(cookieStr => {
              const [cookiePair] = cookieStr.split(';');
              const [name, value] = cookiePair.split('=');
              cy.setCookie(name.trim(), value.trim());
            });
          });
        });
      });
    });
  });
});
