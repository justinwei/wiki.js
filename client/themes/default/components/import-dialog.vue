<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='700'
    persistent
  )
    v-card
      v-toolbar(color='primary', dark, dense, flat)
        v-icon(left) mdi-file-import
        .body-2 {{ $t('common:import.title') }}
      v-card-text.pt-5
        v-alert(v-if='error', type='error', text, dismissible, @input='error = null')
          | {{ error }}
        
        v-alert(v-if='!importing && !completed', type='info', text)
          | {{ $t('common:import.description') }}
        
        .text-center(v-if='importing')
          v-progress-circular(
            :value='isPolling ? 0 : progress'
            :indeterminate='isPolling'
            :size='100'
            :width='10'
            color='primary'
            rotate='270'
          )
            span.text-h6(v-if='!isPolling') {{ progress }}%
          .mt-4.subtitle-1 {{ statusMessage || $t('common:import.importing') }}
          .caption(v-if='currentFileName') 当前文件：{{ currentFileName }}
          v-progress-linear(
            v-if='progressTotal > 0'
            :value='progressPercent'
            height='6'
            color='primary'
            class='mt-4'
          )
          .caption.mt-1(v-if='progressTotal > 0')
            | 已完成 {{ processedCount }} / {{ progressTotal }} （{{ progressPercent }}%）
          v-list(
            v-if='progressEntries.length > 0'
            dense
            class='mt-3 import-progress-list'
            style='max-height: 220px; overflow-y: auto;'
          )
            v-list-item(
              v-for='(entry, idx) in progressEntries'
              :key='entry.file + idx'
            )
              v-list-item-content
                v-list-item-title
                  span {{ entry.file || entry.title }}
                  span.body-2.ml-2(:class="entry.status === 'failed' ? 'error--text' : (entry.status === 'success' ? 'success--text' : 'info--text')")
                    | {{ entry.status === 'failed' ? '失败' : entry.status === 'success' ? '完成' : '处理中' }}
                v-list-item-subtitle.error--text(v-if='entry.error') {{ entry.error }}
        
        v-alert(v-if='completed', type='success', text)
          .subtitle-1 {{ $t('common:import.completed') }}
          .mt-2
            div {{ $t('common:import.created') }}: {{ results.created }}
            div {{ $t('common:import.updated') }}: {{ results.updated }}
            div(v-if='results.failed > 0', class='error--text') {{ $t('common:import.failed') }}: {{ results.failed }}
          
          v-list(v-if='results.errors && results.errors.length > 0', dense, class='mt-3')
            v-subheader {{ $t('common:import.errors') }}
            v-list-item(v-for='(err, idx) in results.errors', :key='idx')
              v-list-item-content
                v-list-item-title {{ err.file }}
                v-list-item-subtitle.error--text {{ err.error }}
        
        v-file-input(
          v-if='!importing && !completed'
          v-model='file'
          :label='$t("common:import.selectFile")'
          :accept='acceptedFormats'
          prepend-icon='mdi-file-document'
          show-size
          @change='onFileChange'
        )
          template(v-slot:selection='{ text }')
            v-chip(small, label, color='primary')
              | {{ text }}
        
        v-text-field(
          v-if='!importing && !completed'
          v-model='targetPath'
          :label='$t("common:import.targetPath")'
          :hint='$t("common:import.targetPathHint")'
          persistent-hint
          outlined
          dense
          class='mt-3'
        )
      
      v-card-actions
        v-spacer
        v-btn(
          text
          @click='close'
          :disabled='importing'
        ) {{ $t('common:actions.cancel') }}
        v-btn(
          v-if='!completed'
          color='primary'
          @click='startImport'
          :disabled='!file || importing'
          :loading='importing'
        ) {{ $t('common:import.start') }}
        v-btn(
          v-if='completed'
          color='primary'
          @click='close'
        ) {{ $t('common:actions.close') }}
</template>

<script>
import gql from 'graphql-tag'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    currentPath: {
      type: String,
      default: ''
    },
    currentLocale: {
      type: String,
      default: 'zh'
    },
    parentId: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      file: null,
      targetPath: '',
      importing: false,
      completed: false,
      progress: 0,
      currentFile: '',
      error: null,
      results: {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: []
      },
      acceptedFormats: '.md,.zip',
      taskId: null,
      pollTimer: null,
      isPolling: false,
      statusMessage: '',
      progressEntries: [],
      progressTotal: 0,
      processedCount: 0,
      currentFileName: '',
      networkErrorCount: 0
    }
  },
  computed: {
    isShown: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    progressPercent() {
      if (!this.progressTotal) {
        return 0
      }
      const percent = (this.processedCount / this.progressTotal) * 100
      return Math.min(100, Math.round(percent))
    }
  },
  watch: {
    value(newVal) {
      if (newVal) {
        this.reset()
        this.targetPath = this.currentPath || ''
      }
    }
  },
  methods: {
    onFileChange() {
      this.error = null
    },
    reset() {
      this.stopPolling()
      this.file = null
      this.targetPath = this.currentPath || ''
      this.importing = false
      this.completed = false
      this.progress = 0
      this.currentFile = ''
      this.error = null
      this.results = {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: []
      }
      this.taskId = null
      this.statusMessage = ''
      this.progressEntries = []
      this.progressTotal = 0
      this.processedCount = 0
      this.currentFileName = ''
      this.networkErrorCount = 0
    },
    close() {
      this.stopPolling()
      if (this.completed) {
        // Show a notification to refresh the page tree manually
        this.$store.commit('showNotification', {
          message: '导入完成！请点击侧边栏的刷新按钮查看新导入的页面。',
          style: 'info',
          icon: 'information'
        })
      }
      this.$emit('input', false)
      this.isShown = false
    },
    async startImport() {
      if (!this.file) {
        this.error = this.$t('common:import.noFileSelected')
        return
      }
      
      this.importing = true
      this.progress = 0
      this.error = null
      this.statusMessage = '正在上传文件...'
      
      try {
        // Simulate progress during upload
        const progressInterval = setInterval(() => {
          if (this.progress < 90) {
            this.progress += 5
          }
        }, 200)
        
        this.currentFile = this.file.name
        this.currentFileName = this.file.name
        
        // Create FormData for file upload
        const formData = new FormData()
        formData.append('importFile', this.file)
        formData.append('targetPath', this.targetPath || '')
        formData.append('locale', this.currentLocale)
        if (this.parentId) {
          formData.append('parentId', this.parentId.toString())
        }
        
        // Upload file via REST API
        const response = await fetch('/import/markdown', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })
        
        clearInterval(progressInterval)
        this.progress = 100
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        } catch (err) {
          console.error('Import failed:', err)
          this.stopPolling()
          this.importing = false
          this.error = err.message
          this.$store.commit('showNotification', {
            message: `导入失败: ${err.message}`,
            style: 'error',
            icon: 'alert'
          })
          throw err
        }
        
        const result = await response.json()
        
        if (!result.succeeded || !result.taskId) {
          throw new Error(result.message || '导入任务创建失败')
        }

        this.taskId = result.taskId
        this.statusMessage = result.message || '导入任务已开始，正在后台处理中...'
        this.progressEntries = []
        this.progressTotal = 0
        this.processedCount = 0
        this.currentFileName = ''
        this.networkErrorCount = 0
        this.startPolling()
      } catch (err) {
        console.error('Import failed:', err)
        this.stopPolling()
        this.importing = false
        this.error = err.message
        this.$store.commit('showNotification', {
          message: `导入失败: ${err.message}`,
          style: 'error',
          icon: 'alert'
        })
        throw err
      }
    },
    startPolling() {
      if (!this.taskId) {
        return
      }
      this.isPolling = true
      this.networkErrorCount = 0
      this.pollStatus()
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
      }
      this.pollTimer = setInterval(() => {
        this.pollStatus()
      }, 3000)
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      this.isPolling = false
    },
    async pollStatus() {
      if (!this.taskId) {
        return
      }
      try {
        const response = await fetch(`/import/status/${this.taskId}`, {
          credentials: 'include'
        })
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        const data = await response.json()
        if (!data.succeeded) {
          throw new Error(data.message || '导入状态获取失败')
        }

        this.networkErrorCount = 0
        this.statusMessage = data.message || '导入任务正在后台处理中...'
        this.progressTotal = data.total || this.progressTotal
        this.processedCount = typeof data.processed === 'number' ? data.processed : this.processedCount
        this.currentFileName = data.currentFile || this.currentFileName
        this.progressEntries = Array.isArray(data.progress) ? data.progress : this.progressEntries

        if (data.status === 'success') {
          this.results = {
            total: data.total || 0,
            created: data.created || 0,
            updated: data.updated || 0,
            failed: data.failed || 0,
            errors: data.errors || []
          }
          this.progressEntries = Array.isArray(data.progress) ? data.progress : this.progressEntries
          this.completed = true
          this.importing = false
          this.taskId = null
          this.stopPolling()
          this.$store.commit('showNotification', {
            message: data.message || '导入成功',
            style: 'success',
            icon: 'check'
          })
        } else if (data.status === 'failed') {
          this.results.errors = data.errors || []
          this.progressEntries = Array.isArray(data.progress) ? data.progress : this.progressEntries
          this.error = data.message || '导入失败'
          this.importing = false
          this.taskId = null
          this.stopPolling()
          this.$store.commit('showNotification', {
            message: this.error,
            style: 'error',
            icon: 'alert'
          })
        } else {
          if (this.progress < 95) {
            this.progress += 1
          }
        }
      } catch (err) {
        console.error('Failed to poll import status:', err)
        this.networkErrorCount += 1
        this.statusMessage = `导入状态更新失败，正在重试 (${this.networkErrorCount})`
        if (this.networkErrorCount >= 5) {
          this.error = `导入状态更新失败: ${err.message}`
          this.importing = false
          this.taskId = null
          this.stopPolling()
          this.$store.commit('showNotification', {
            message: this.error,
            style: 'warning',
            icon: 'alert'
          })
        }
      }
    }
  },
  beforeDestroy() {
    this.stopPolling()
  }
}
</script>
