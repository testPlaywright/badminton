updateTicketFlow() {
  cy.get('@createdTicketId').then((ticketID) => {
    const m = String(ticketID).match(/^([A-Z]+)(\d+)$/);
    if (!m) throw new Error(`Invalid ticket ID format: ${ticketID}`);

    this.ticketPrefix = m[1];
    this.ticketNumber = m[2];
    this.ticketId     = ticketID;

    cy.log(`Using ticket: ${this.ticketId}`);
  });
}