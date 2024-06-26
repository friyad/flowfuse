<template>
    <ff-dialog ref="dialog" :header="title" confirm-label="Upload" :disable-primary="!formValid" :closeOnConfirm="false" @confirm="confirm()" @cancel="cancel">
        <template #default>
            <form class="space-y-6 mt-2" @submit.prevent>
                <FormRow :error="validateField.file ? errors.file : ''" data-form="import-snapshot-filename">
                    Snapshot File
                    <template #input>
                        <ff-text-input v-model="input.file" :error="errors.file" disabled />
                    </template>
                    <template #append>
                        <input id="fileUpload" ref="fileUpload" type="file" accept="application/json, text/plain, *" style="display:none;">
                        <ff-button v-ff-tooltip:top="'Select Snapshot'" kind="tertiary" @click="selectSnapshot">
                            <template #icon><DocumentIcon /></template>
                            <!-- <span class="hidden sm:flex pl-1">Select Snapshot</span> -->
                        </ff-button>
                    </template>
                </FormRow>
                <FormRow v-if="snapshotNeedsSecret" v-model="input.secret" :error="validateField.secret ? errors.secret : ''" data-form="import-snapshot-secret">Credentials Secret</FormRow>
                <FormRow v-model="input.name" :error="validateField.name ? errors.name : ''" data-form="import-snapshot-name">Name</FormRow>
                <FormRow data-form="import-snapshot-description">
                    Description
                    <template #input>
                        <textarea v-model="input.description" rows="8" class="ff-input ff-text-input" style="height: auto" />
                    </template>
                </FormRow>
            </form>
        </template>
    </ff-dialog>
</template>
<script>

import { DocumentIcon } from '@heroicons/vue/outline'

import snapshotsApi from '../../api/snapshots.js'
import alerts from '../../services/alerts.js'
import { isSnapshot } from '../../utils/snapshot.js'
import FormRow from '../FormRow.vue'

export default {
    name: 'SnapshotImportDialog',
    components: {
        FormRow,
        DocumentIcon
    },
    props: {
        owner: {
            type: Object,
            required: true
        },
        ownerType: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: 'Upload Snapshot'
        }
    },
    emits: ['snapshot-import-failed', 'snapshot-import-success', 'canceled'],
    setup () {
        return {
            show () {
                this.setKeys(this.input, '')
                this.setKeys(this.errors, '')
                this.setKeys(this.validateField, false)
                this.$refs.dialog.show()
                setTimeout(() => {
                    this.validate()
                    this.shown = true
                }, 5)
            }
        }
    },
    data () {
        return {
            shown: false,
            input: {
                file: '',
                secret: '',
                name: '',
                description: '',
                snapshot: ''
            },
            errors: {
                file: '',
                secret: '',
                name: ''
            },
            validateField: {
                file: false,
                secret: false,
                name: false
            }
        }
    },
    computed: {
        formValid () {
            return !Object.values(this.errors).some(error => !!error) && this.input.file && this.input.name && (!this.snapshotNeedsSecret || this.input.secret)
        },
        snapshotNeedsSecret () {
            return !!(this.input.snapshot && this.input.snapshot.flows?.credentials)
        }
    },
    watch: {
        'input.name': function () {
            if (this.shown) {
                this.validateField.name = true
                this.validate()
            }
        },
        'input.file': function () {
            if (this.shown) {
                this.validateField.file = true
                this.validate()
            }
        },
        'input.secret': function () {
            if (this.shown) {
                this.validateField.secret = true
                this.validate()
            }
        }
    },
    mounted () {
        this.$refs.fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0]
            this.input.snapshot = null
            this.input.file = ''
            this.errors.file = null
            this.validateField.file = true
            this.validateField.secret = true
            const reader = new FileReader()
            reader.onload = () => {
                const data = reader.result
                try {
                    const snapshot = JSON.parse(data)
                    if (isSnapshot(snapshot)) {
                        this.input.name = snapshot.name
                        this.input.description = snapshot.description
                        this.input.snapshot = snapshot
                        this.input.file = file.name
                    } else {
                        throw new Error('Invalid snapshot file')
                    }
                } catch (e) {
                    console.warn(e)
                    alerts.emit('Failed to read snapshot file')
                    this.errors.file = 'Invalid snapshot file'
                } finally {
                    this.validate()
                }
            }
            reader.readAsText(file)
        })
    },
    methods: {
        validate () {
            this.errors.file = !this.input.file ? 'Snapshot file is required' : ''
            this.errors.name = !this.input.name ? 'Name is required' : ''
            this.errors.secret = this.snapshotNeedsSecret ? (this.input.secret ? '' : 'Secret is required') : ''
            return this.formValid
        },
        confirm () {
            this.setKeys(this.validateField, true) // validate all fields
            if (this.validate()) {
                this.shown = true
                const importSnapshot = {
                    ...this.input.snapshot
                }
                if (this.input.name) {
                    importSnapshot.name = this.input.name
                }
                if (this.input.description) {
                    importSnapshot.description = this.input.description
                }
                let secret
                if (this.snapshotNeedsSecret) {
                    secret = this.input.secret
                }
                snapshotsApi.importSnapshot(this.owner.id, this.ownerType, importSnapshot, secret).then((response) => {
                    this.$emit('snapshot-import-success', response)
                    this.$refs.dialog.close()
                    this.shown = false
                }).catch(err => {
                    this.$emit('snapshot-import-failed', err)
                })
            }
        },
        cancel () {
            this.shown = false
            this.$refs.dialog.close()
            this.$emit('canceled')
        },
        selectSnapshot () {
            const fileUpload = this.$refs.fileUpload
            fileUpload.click()
        },
        setKeys (obj, value = '') {
            Object.keys(obj).forEach(key => {
                obj[key] = value
            })
        }
    }
}
</script>
