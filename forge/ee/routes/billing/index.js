/**
 * Routes related to the EE forge billing api
 *
 * @namespace api
 * @memberof forge.ee.billing
 */
const { Readable } = require('stream')

module.exports = async function (app) {
    const stripe = require('stripe')(app.config.billing.stripe.key)

    function logStripeEvent (event, team, teamId = null) {
        if (team) {
            app.log.info(`Stripe ${event.type} event ${event.data.object.id} received for team '${team.hashid}'`)
        } else {
            app.log.error(`Stripe ${event.type} event ${event.data.object.id} received for unknown team '${teamId}'`)
        }
    }

    async function parseChargeEvent (event) {
        const stripeCustomerId = event.data.object.customer
        const subscription = await app.db.models.Subscription.byCustomer(stripeCustomerId)
        const team = subscription?.Team

        logStripeEvent(event, team, stripeCustomerId)

        return {
            stripeCustomerId, subscription, team
        }
    }

    async function parseCheckoutEvent (event) {
        const stripeCustomerId = event.data.object.customer
        const stripeSubscriptionId = event.data.object.subscription
        const teamId = event.data.object.client_reference_id

        const team = await app.db.models.Team.byId(teamId)
        logStripeEvent(event, team, teamId)

        return {
            stripeSubscriptionId, stripeCustomerId, team
        }
    }

    /**
     * Need to work out what auth needs to have happend
     */
    app.addHook('preHandler', async (request, response) => {
        if (request.params.teamId) {
            request.teamMembership = await request.session.User.getTeamMembership(request.params.teamId)
            if (!request.teamMembership && !request.session.User.admin) {
                response.code(404).type('text/html').send('Not Found')
            }
            request.team = await app.db.models.Team.byId(request.params.teamId)
            if (!request.team) {
                response.code(404).type('text/html').send('Not Found')
            }
        }
    })

    /**
     * Callback for Stripe to report events
     * @name /ee/billing/callback
     * @static
     * @memberof forge.ee.billing
     */
    app.post('/callback',
        {
            config: {
                allowAnonymous: true
            },
            preParsing: function (request, reply, payload, done) {
                const chunks = []
                payload.on('data', chunk => {
                    chunks.push(chunk)
                })
                payload.on('end', () => {
                    const raw = Buffer.concat(chunks)
                    request.rawBody = raw
                    done(null, Readable.from(raw))
                })
            },
            schema: {
                body: {
                    type: 'object',
                    required: ['type', 'data'],
                    properties: {
                        type: { type: 'string' },
                        data: { type: 'object' }
                    }
                }
            }
        },
        async (request, response) => {
            const sig = request.headers['stripe-signature']
            let event = request.body
            if (app.config.billing?.stripe?.wh_secret) {
                try {
                    event = stripe.webhooks.constructEvent(request.rawBody, sig, app.config.billing.stripe.wh_secret)
                } catch (err) {
                    app.log.error(`Stripe event failed signature: ${err.toString()}`)
                    response.code(400).type('text/hml').send('Failed Signature')
                    return
                }
            }

            switch (event.type) {
            case 'charge.failed': {
                await parseChargeEvent(event)

                // Do nothing - just log event (handled above)

                break
            }

            case 'checkout.session.completed': {
                const { team, stripeSubscriptionId, stripeCustomerId } = await parseCheckoutEvent(event)
                if (!team) {
                    response.status(200).send()
                    return
                }

                await app.db.controllers.Subscription.createSubscription(team, stripeSubscriptionId, stripeCustomerId)
                await app.auditLog.Team.billing.session.completed(request.session?.User || 'system', null, team, event.data.object)

                app.log.info(`Created Subscription for team ${team.hashid}`)

                break
            }

            case 'checkout.session.expired': {
                await parseCheckoutEvent(event)

                // Do nothing - just log (handled above)

                break
            }

            case 'customer.subscription.created':

                break
            case 'customer.subscription.updated':

                break
            case 'customer.subscription.deleted':

                break
            }

            response.code(200).send()
        }
    )

    /**
     * Get Billing details for a team
     * @name /ee/billing/teams/:team
     * @static
     * @memberof forge.ee.billing
     */
    app.get('/teams/:teamId', {
        preHandler: app.needsPermission('team:edit')
    }, async (request, response) => {
        const team = request.team
        const sub = await app.db.models.Subscription.byTeam(team.id)
        if (!sub) {
            try {
                let cookie
                if (request.cookies.ff_coupon) {
                    cookie = request.unsignCookie(request.cookies.ff_coupon)?.valid ? request.unsignCookie(request.cookies.ff_coupon).value : undefined
                }
                const session = await app.billing.createSubscriptionSession(team, cookie) // request.session.User)
                await app.auditLog.Team.billing.session.created(request.session.User, null, team, session)
                response.code(402).type('application/json').send({ billingURL: session.url })
                return
            } catch (err) {
                let responseMessage
                if (err.errors) {
                    responseMessage = err.errors.map(err => err.message).join(',')
                } else {
                    responseMessage = err.toString()
                }
                response.clearCookie('ff_coupon', { path: '/' })
                response.code(402).type('application/json').send({ error: responseMessage })
                return
            }
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(
            sub.subscription,
            {
                expand: ['items.data.price.product']
            }
        )

        const information = {
            next_billing_date: stripeSubscription.current_period_end,
            items: []
        }
        stripeSubscription.items.data.forEach(item => {
            information.items.push({
                name: item.price.product.name,
                price: item.price.unit_amount,
                quantity: item.quantity
            })
        })

        response.status(200).send(information)
    })

    /**
     * Redirect to the Stripe Customer portal
     * @name /ee/billing/teams/:team/customer-portal
     * @static
     * @memberof forge.ee.billing
     */
    app.get('/teams/:teamId/customer-portal', {
        preHandler: app.needsPermission('team:edit')
    }, async (request, response) => {
        const team = request.team
        const sub = await app.db.models.Subscription.byTeam(team.id)
        const portal = await stripe.billingPortal.sessions.create({
            customer: sub.customer,
            return_url: `${app.config.base_url}/team/${team.slug}/overview`
        })

        response.redirect(303, portal.url)
    })
}
