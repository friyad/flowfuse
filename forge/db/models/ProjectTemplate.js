/**
 * A Project Template definition
 * @namespace forge.db.models.ProjectTemplate
 */
const { DataTypes, Op, literal } = require('sequelize')

module.exports = {
    name: 'ProjectTemplate',
    schema: {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        active: { type: DataTypes.BOOLEAN, defaultValue: true },
        description: { type: DataTypes.TEXT, defaultValue: '' },
        settings: {
            type: DataTypes.TEXT,
            set (value) {
                this.setDataValue('settings', JSON.stringify(value))
            },
            get () {
                const rawValue = this.getDataValue('settings') || '{}'
                return JSON.parse(rawValue)
            }
        },
        policy: {
            type: DataTypes.TEXT,
            set (value) {
                this.setDataValue('policy', JSON.stringify(value))
            },
            get () {
                const rawValue = this.getDataValue('policy') || '{}'
                return JSON.parse(rawValue)
            }
        },
        links: {
            type: DataTypes.VIRTUAL,
            get () {
                return {
                    self: process.env.FLOWFORGE_BASE_URL + '/api/v1/templates/' + this.hashid
                }
            }
        }
    },
    associations: function (M) {
        this.hasMany(M.Project)
        this.belongsTo(M.User, { as: 'owner' })
    },
    hooks: {
        beforeDestroy: async (template, opts) => {
            const projectCount = await template.projectCount()
            if (projectCount > 0) {
                throw new Error('Cannot delete template that is used by projects')
            }
        }
    },
    finders: function (M) {
        const self = this
        return {
            static: {
                byId: async function (id) {
                    if (typeof id === 'string') {
                        id = M.ProjectTemplate.decodeHashid(id)
                    }
                    return self.findOne({
                        where: { id },
                        include: [
                            { model: M.User, as: 'owner' }
                        ],
                        attributes: {
                            include: [
                                [
                                    literal(`(
                                        SELECT COUNT(*)
                                        FROM "Projects" AS "project"
                                        WHERE
                                        "project"."ProjectTemplateId" = "ProjectTemplate"."id"
                                    )`),
                                    'projectCount'
                                ]
                            ]
                        }
                    })
                },
                getAll: async (pagination = {}) => {
                    const limit = parseInt(pagination.limit) || 30
                    const where = {}
                    if (pagination.cursor) {
                        where.id = {
                            [Op.gt]: M.ProjectTemplate.decodeHashid(pagination.cursor)
                        }
                    }
                    const { count, rows } = await this.findAndCountAll({
                        where,
                        order: [['id', 'ASC']],
                        limit,
                        include: [
                            { model: M.User, as: 'owner' }
                        ],
                        attributes: {
                            include: [
                                [
                                    literal(`(
                                        SELECT COUNT(*)
                                        FROM "Projects" AS "project"
                                        WHERE
                                        "project"."ProjectTemplateId" = "ProjectTemplate"."id"
                                    )`),
                                    'projectCount'
                                ]
                            ]
                        }
                    })
                    return {
                        meta: {
                            next_cursor: rows.length === limit ? rows[rows.length - 1].hashid : undefined
                        },
                        count: count,
                        templates: rows
                    }
                }
            },
            instance: {
                projectCount: async function () {
                    return await M.Project.count({ where: { ProjectTemplateId: this.id } })
                }
            }
        }
    }
}
