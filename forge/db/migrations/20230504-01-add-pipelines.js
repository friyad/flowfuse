/**
 * Add the ProjectStacks table
 */
const { DataTypes } = require('sequelize')

module.exports = {
    up: async (context) => {
        await context.createTable('Pipelines', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: { type: DataTypes.STRING, allowNull: false },

            createdAt: { type: DataTypes.DATE },
            updatedAt: { type: DataTypes.DATE },

            ApplicationId: {
                type: DataTypes.INTEGER,
                references: { model: 'Applications', key: 'id' },
                onDelete: 'cascade',
                onUpdate: 'cascade'
            }
        })

        await context.createTable('PipelineStages', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: { type: DataTypes.STRING, allowNull: false },
            target: { type: DataTypes.INTEGER, allowNull: true }, // @TODO: this is the next stage ID in the pipeline, needs relations declaring...

            PipelineId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'Pipelines', key: 'id' },
                onDelete: 'cascade',
                onUpdate: 'cascade'
            },

            createdAt: { type: DataTypes.DATE },
            updatedAt: { type: DataTypes.DATE }
        })
        })
    },
    down: async (context) => {
    }
}
