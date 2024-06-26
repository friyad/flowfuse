import multipleBlueprints from '../../fixtures/blueprints/multiple-blueprints.json'
import singleBlueprint from '../../fixtures/blueprints/single-blueprint.json'

describe('FlowForge - Blueprints', () => {
    // Blueprint Details
    const NAME = 'Test Blueprint'
    const CATEGORY = 'Category A'
    const ICON = 'cog'
    const ORDER = 0
    const DESCRIPTION = 'This is a test blueprint'

    const FLOWS = '{ "flows": [] }'
    const MODULES = '{}'

    beforeEach(() => {
        cy.login('alice', 'aaPassword')
        cy.home()
    })

    it('should be available in the Admin navigation', () => {
        cy.visit('/admin/overview')
        cy.get('[data-nav="admin-flow-blueprints"]').should('exist')
        cy.get('[data-nav="admin-flow-blueprints"] [data-el="premium-feature"]').should('not.exist')
    })

    it('should not be accessible in OS version', () => {
        cy.visit('/admin/flow-blueprints')
        cy.url().should('include', '/admin/flow-blueprints')
    })

    it('can be created', () => {
        cy.intercept('GET', '/api/*/flow-blueprints*').as('getFlowBlueprints')

        cy.visit('/admin/flow-blueprints')

        cy.wait('@getFlowBlueprints').then(({ response }) => {
            const blueprintCount = response.body.count
            const name = NAME + ' ' + blueprintCount
            cy.get('[data-el="create-blueprint-dialog"]').should('not.be.visible')
            cy.get('[data-action="create-flow-blueprint"]').click()
            cy.get('[data-el="create-blueprint-dialog"]').should('be.visible')

            cy.get('[data-el="create-blueprint-dialog"] [data-form="confirm-dialog"]').should('be.disabled')

            cy.get('[data-el="create-blueprint-dialog"] [data-form="name"] input[type="text"]').type(name)
            cy.get('[data-el="create-blueprint-dialog"] [data-form="default"] label.ff-checkbox').click()
            cy.get('[data-el="create-blueprint-dialog"] [data-form="category"] input[type="text"]').type(CATEGORY)
            cy.get('[data-el="create-blueprint-dialog"] [data-form="icon"] input[type="text"]').type(ICON)
            cy.get('[data-el="create-blueprint-dialog"] [data-form="order"] input[type="number"]').type(ORDER)
            cy.get('[data-el="create-blueprint-dialog"] [data-form="description"] textarea').type(DESCRIPTION)

            cy.get('[data-el="create-blueprint-dialog"] [data-form="flows"] textarea').type(FLOWS, { parseSpecialCharSequences: false })
            cy.get('[data-el="create-blueprint-dialog"] [data-form="modules"] textarea').type(MODULES, { parseSpecialCharSequences: false })

            cy.get('[data-el="create-blueprint-dialog"] [data-form="confirm-dialog"]').should('not.be.disabled')
            cy.get('[data-el="create-blueprint-dialog"] [data-form="confirm-dialog"]').click()

            cy.get('[data-el="create-blueprint-dialog"]').should('not.be.visible')

            // check the blueprint was created
            cy.get('[data-el="blueprints"] [data-el="blueprint-tile"]').its('length').should('eq', blueprintCount + 1)
            cy.get('[data-el="blueprints"] [data-el="blueprint-tile"]').last().should('contain', name)
            cy.get('[data-el="blueprints"] [data-el="blueprint-tile"]').last().should('contain', DESCRIPTION)
        })
    })

    it('cannot change Blueprint if only 1 is available be used when creating an Instance', () => {
        cy.intercept('GET', '/api/*/flow-blueprints*', singleBlueprint).as('getFlowBlueprints')
        cy.visit('/team/ateam/instances/create')

        cy.get('[data-form="blueprint"]').should('exist')
        cy.get('[data-form="blueprint"]').contains(singleBlueprint.blueprints[0].name)

        cy.get('[data-action="choose-blueprint"]').should('not.exist')

        cy.get('[data-form="blueprint-selection"]').should('not.exist')
        cy.get('[data-form="project-name"]').should('exist')
        cy.get('[data-form="project-type"]').should('exist')
    })

    it('can change Blueprint if more than 1 are available when creating an Instance', () => {
        cy.intercept('GET', '/api/*/flow-blueprints*', multipleBlueprints).as('getFlowBlueprints')
        cy.visit('/team/ateam/instances/create')

        cy.get('[data-form="blueprint"]').should('exist')
        cy.get('[data-form="blueprint"]').contains(multipleBlueprints.blueprints[0].name)

        cy.get('[data-action="choose-blueprint"]').should('exist')
        cy.get('[data-action="choose-blueprint"] span').click()

        cy.get('[data-form="blueprint-selection"]').should('exist')
        cy.get('[data-form="project-name"]').should('not.exist')
        cy.get('[data-form="project-type"]').should('not.exist')

        // check we have two blueprint groups
        cy.get('[data-form="blueprint-group"]').its('length').should('eq', 2)
        // and one blueprint in the first group, and 2 in the second
        cy.get('[data-form="blueprint-group"]').first().find('[data-el="blueprint-tile"]').its('length').should('eq', 1)
        cy.get('[data-form="blueprint-group"]').eq(1).find('[data-el="blueprint-tile"]').its('length').should('eq', 2)

        // select the second blueprint
        cy.get('[data-form="blueprint-group"]').eq(1).find('[data-el="blueprint-tile"] [data-action="select-blueprint"]').first().click()

        // chck our newly selected blueprint is now in the blueprint preview with the CreateInstance form
        cy.get('[data-form="blueprint"]').contains(multipleBlueprints.blueprints[1].name)
    })

    it('are included in the POST request when creating an Instance', () => {
        const INSTANCE_NAME = 'test-instance'
        let defaultBlueprint = null
        cy.intercept('POST', '/api/*/projects', 'success').as('createInstance')
        cy.intercept('GET', '/api/*/flow-blueprints*', singleBlueprint).as('getFlowBlueprints')

        cy.visit('/team/ateam/instances/create')

        cy.wait('@getFlowBlueprints')
            .then(({ response }) => {
                // get default blueprint
                const blueprints = response.body.blueprints
                defaultBlueprint = blueprints.find((blueprint) => blueprint.default) || blueprints[0]

                cy.get('[data-form="blueprint"]').should('exist')
                cy.get('[data-form="blueprint"]').contains(defaultBlueprint.name)

                // fill out form

                // select application
                cy.get('[data-form="application-id"]').click()
                cy.get('[data-form="application-id"] .ff-dropdown-options').should('be.visible')
                cy.get('[data-form="application-id"] .ff-dropdown-options > .ff-dropdown-option').first().click()

                // give instance a name
                cy.get('[data-form="project-name"] input').clear()
                cy.get('[data-form="project-name"] input').type(INSTANCE_NAME)

                // select instance type
                cy.get('[data-form="project-type"]').contains('type1').click()

                cy.get('[data-form="project-template"]').should('exist') // template section visible for create

                cy.get('[data-action="create-project"]').should('not.be.disabled').click()

                return cy.wait('@createInstance')
            })
            .then((interception) => {
                const requestBody = interception.request.body
                cy.wrap(requestBody).its('flowBlueprintId').should('eq', defaultBlueprint.id)
            })
    })

    it('can display blueprint flow previews', () => {
        cy.intercept('GET', '/api/*/flow-blueprints*', {
            meta: {},
            ...multipleBlueprints
        }).as('getFlowBlueprints')

        cy.visit('/admin/flow-blueprints')

        cy.wait('@getFlowBlueprints')

        cy.get('[data-el="flow-view-dialog"]').should('not.be.visible')

        cy.get('[data-el="blueprint-tile"]').each(($div) => cy.wrap($div).within(() => {
            cy.get('[data-action="show-blueprint"]').click()
            cy.get('[data-el="flow-view-dialog"]').should('be.visible')
            cy.get('[data-action="dialog-confirm"]').click()
            cy.get('[data-el="flow-view-dialog"]').should('not.be.visible')
        }))
    })
})
