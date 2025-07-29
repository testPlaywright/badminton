
Cypress.Commands.add('sessionLogin', () => {
  cy.session('login', () => {
    // Clear previous session data
    cy.clearCookies();
    cy.clearLocalStorage();
    sessionStorage.clear();

    // Visit main app page that initiates login
    cy.visit('https://rxc-cat-test.optum.com/tickets');

    // Wait for login to complete by checking for the auth_verification cookie
    cy.getCookie('auth_verification').should('exist');

    // Store auth_verification in Cypress env for use in tests
    cy.getCookie('auth_verification').then((cookie) => {
      Cypress.env('auth_verification', cookie.value);
      cy.log(`✅ auth_verification = ${cookie.value}`);
    });
  });
});
