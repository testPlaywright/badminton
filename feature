Feature: Edit Type Negative Validation Scenarios

  Background:
    Given I am logged into the CAT Application
    And I visit the "Tickets" page

  Scenario Outline: Validate Edit Type error states and auto-generate Excel row
    # Build the Excel row (from the blank template in fixtures) using these values
    Given I prepare intent row from outline
      | pdlmRow     | <pdlmRow>     |
      | editType    | <editType>    |
      | listIds     | <listIds>     |
      | lobCodes    | <lobCodes>    |
      | productType | <productType> |
      | productId   | <productId>   |
    # Run your existing flow (this will upload the generated file internally)
    Then I should see an error message for edit type <errorMessage>

    Examples:
      | pdlmRow | editType                                | listIds | lobCodes | productType | productId   | errorMessage               |
      | 10      |                                          | LIST1   | MPL1     | GPN         | 7000000001  | Field is Required.         |
      | 11      |    "   "                                 | LIST2   | MPL1     | GPN         | 7000000002  | field required             |
      | 12      | @@@INVALID@@@                            | LIST3   | MPL1     | NDC         | 7000000003  | Invalid Edit Type format   |
      | 13      | XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX | LIST4   | MPL1     | GPN         | 7000000004  | edit type length exceeded  |