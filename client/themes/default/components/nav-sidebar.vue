<template lang="pug">
  div
    .pa-3.d-flex(v-if='navMode === `MIXED`', :class='$vuetify.theme.dark ? `grey darken-5` : `blue darken-3`')
      v-btn(
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='min-width:0;'
        @click='goHome'
        :aria-label='$t(`common:header.home`)'
        )
        v-icon(size='20') mdi-home
      v-btn.ml-3(
        v-if='currentMode === `custom`'
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='flex: 1 1 100%;'
        @click='switchMode(`browse`)'
        )
        v-icon(left) mdi-file-tree
        .body-2.text-none {{$t('common:sidebar.browse')}}
      v-btn.ml-3(
        v-else-if='currentMode === `browse`'
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='flex: 1 1 100%;'
        @click='switchMode(`custom`)'
        )
        v-icon(left) mdi-navigation
        .body-2.text-none {{$t('common:sidebar.mainMenu')}}
    v-divider
    //-> Custom Navigation
    v-list.py-2(v-if='currentMode === `custom`', dense, :class='color', :dark='dark')
      template(v-for='item of items')
        v-list-item(
          v-if='item.k === `link`'
          :href='item.t'
          :target='item.y === `externalblank` ? `_blank` : `_self`'
          :rel='item.y === `externalblank` ? `noopener` : ``'
        )
          v-list-item-avatar(size='24', tile)
            v-icon(v-if='item.c.match(/fa[a-z] fa-/)', size='19') {{ item.c }}
            v-icon(v-else) {{ item.c }}
          v-list-item-title {{ item.l }}
        v-divider.my-2(v-else-if='item.k === `divider`')
        v-subheader.pl-4(v-else-if='item.k === `header`') {{ item.l }}
    //-> Browse
    v-list.py-2(v-else-if='currentMode === `browse`', dense, :class='color', :dark='dark')
      template(v-if='parents.length > 0')
        v-list-item(v-for='(item, idx) of parents', :key='`parent-` + item.id', @click='fetchBrowseItems(item)', style='min-height: 30px;')
          v-list-item-avatar(size='18', :style='`padding-left: ` + (idx * 8) + `px; width: auto; margin: 0 5px 0 0;`')
            v-icon(small) mdi-folder-open
          v-list-item-title {{ item.title }}
        v-divider.mt-2
        v-list-item.mt-2(v-if='currentParent && currentParent.pageId > 0', :href='`/` + currentParent.locale + `/` + currentParent.path', :key='`directorypage-` + currentParent.id', :input-value='path === currentParent.path')
          v-list-item-avatar(size='24')
            v-icon mdi-text-box
          v-list-item-title {{ currentParent.title }}
      v-subheader.pl-4.d-flex.align-center.justify-space-between
        span {{$t('common:sidebar.currentDirectory')}}
        div.d-flex.align-center(v-if='showSortControls || canReorder')
          v-btn(
            v-if='canReorder && !isSorting'
            icon
            x-small
            :title='$t("common:import.title")'
            @click='openImportDialog'
          )
            v-icon mdi-file-import
          v-btn(
            v-if='!isSorting'
            icon
            x-small
            title='刷新页面树'
            @click='refreshBrowseTree'
          )
            v-icon mdi-refresh
          v-progress-circular.mr-2(v-if='sortLoading', indeterminate, color='primary', size='14', width='2')
          v-btn(
            v-if='showSortControls'
            icon
            x-small
            :class='isSorting ? `primary--text` : ``'
            :aria-label='sortButtonLabel'
            :title='sortButtonLabel'
            :disabled='sortLoading'
            @click='toggleSortMode'
          )
            v-icon {{ isSorting ? 'mdi-check' : 'mdi-swap-vertical' }}
      template(v-if='currentItems.length > 0')
        vuedraggable(
          tag='div'
          v-model='currentItems'
          item-key='id'
          handle='.nav-sidebar__handle'
          :animation='150'
          :disabled='!isSorting || !canReorder'
          @end='onSortEnd'
        )
          v-list-item(
            v-for='element in currentItems'
            :key='`child-` + element.id'
            :href='element.isFolder || (isSorting && canReorder) ? undefined : (`/` + element.locale + `/` + element.path)'
            :input-value='!element.isFolder && path === element.path'
            @click='element.isFolder ? onFolderClick(element) : onPageClick($event)'
            :class='element.isFolder ? "nav-sidebar__folder-item" : ""'
          )
            v-list-item-avatar(size='24')
              v-icon(v-if='element.isFolder') mdi-folder
              v-icon(v-else) mdi-text-box
            v-list-item-title {{ element.title }}
            v-list-item-action(v-if='isSorting && canReorder')
              v-icon.nav-sidebar__handle mdi-drag
            v-list-item-action.nav-sidebar__folder-action(v-if='!isSorting && element.isFolder && canReorder')
              v-btn(
                icon
                x-small
                @click.stop='renameFolder(element)'
                :title='$t("common:actions.rename")'
              )
                v-icon(small, color='primary') mdi-pencil
            v-list-item-action.nav-sidebar__folder-action(v-if='!isSorting && element.isFolder && canReorder')
              v-btn(
                icon
                x-small
                @click.stop='deleteFolder(element)'
                :title='$t("common:actions.delete")'
              )
                v-icon(small, color='error') mdi-delete
    
    //-> Delete Folder Progress Dialog
    v-dialog(
      v-model='deleteFolderDialog.shown'
      max-width='600'
      persistent
    )
      v-card
        v-toolbar(color='error', dark, dense, flat)
          v-icon(left) mdi-delete
          .body-2 删除文件夹
        v-card-text.pt-5
          v-alert(v-if='deleteFolderDialog.error', type='error', text, dismissible, @input='deleteFolderDialog.error = null')
            | {{ deleteFolderDialog.error }}
          
          .text-center(v-if='deleteFolderDialog.deleting')
            v-progress-circular(
              :value='deleteFolderDialog.progress'
              :size='100'
              :width='10'
              color='error'
              rotate='270'
            )
              span.text-h6 {{ deleteFolderDialog.progress }}%
            .mt-4.subtitle-1 正在删除文件夹 "{{ deleteFolderDialog.folderTitle }}"...
            .caption.mt-2(v-if='deleteFolderDialog.currentFile') 当前删除：{{ deleteFolderDialog.currentFile }}
            .caption.mt-1
              | 已删除 {{ deleteFolderDialog.deletedCount }} / {{ deleteFolderDialog.totalCount }} 个文件
          
          v-alert(v-if='deleteFolderDialog.completed', type='success', text)
            .subtitle-1 删除完成
            .mt-2
              div 已删除 {{ deleteFolderDialog.deletedCount }} 个文件
              div(v-if='deleteFolderDialog.failedCount > 0', class='error--text') 失败 {{ deleteFolderDialog.failedCount }} 个
        
        v-card-actions
          v-spacer
          v-btn(
            v-if='deleteFolderDialog.completed'
            color='primary'
            @click='closeDeletionDialog'
          ) 关闭
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import Vuedraggable from 'vuedraggable'
import { get } from 'vuex-pathify'

/* global siteLangs, siteConfig */

const reorderTreeMutation = gql`
  mutation ($parent: Int, $order: [Int!]!, $locale: String!) {
    pages {
      reorderTree(parent: $parent, order: $order, locale: $locale) {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

const deleteFolderMutation = gql`
  mutation ($path: String!, $locale: String!) {
    pages {
      deleteFolder(path: $path, locale: $locale) {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

const renameFolderMutation = gql`
  mutation ($path: String!, $locale: String!, $newTitle: String!) {
    pages {
      renameFolder(path: $path, locale: $locale, newTitle: $newTitle) {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

const getFolderPagesQuery = gql`
  query ($path: String!, $locale: String!) {
    pages {
      folderPages(path: $path, locale: $locale) {
        id
        path
        title
      }
    }
  }
`

const deletePageMutation = gql`
  mutation ($id: Int!) {
    pages {
      delete(id: $id) {
        responseResult {
          succeeded
          message
        }
      }
    }
  }
`

export default {
  components: {
    Vuedraggable
  },
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    },
    items: {
      type: Array,
      default: () => []
    },
    navMode: {
      type: String,
      default: 'MIXED'
    }
  },
  data() {
    return {
      currentMode: 'custom',
      currentItems: [],
      currentParent: {
        id: 0,
        title: '/ (root)',
        locale: null
      },
      parents: [],
      loadedCache: [],
      isSorting: false,
      sortLoading: false,
      deleteFolderDialog: {
        shown: false,
        deleting: false,
        completed: false,
        error: null,
        folderTitle: '',
        folderPath: '',
        folderLocale: '',
        progress: 0,
        currentFile: '',
        totalCount: 0,
        deletedCount: 0,
        failedCount: 0
      }
    }
  },
  computed: {
    path: get('page/path'),
    locale: get('page/locale'),
    permissions: get('user/permissions'),
    activeLocale () {
      if (this.locale) {
        return this.locale
      }
      if (Array.isArray(siteLangs) && siteLangs.length > 0) {
        const first = siteLangs[0]
        if (first) {
          if (typeof first === 'string') {
            return first
          } else if (typeof first === 'object' && first.code) {
            return first.code
          }
        }
      }
      if (typeof siteConfig !== 'undefined' && siteConfig && siteConfig.lang) {
        return siteConfig.lang
      }
      return 'en'
    },
    canReorder () {
      return _.intersection(this.permissions || [], ['manage:system', 'manage:pages', 'write:pages']).length > 0
    },
    showSortControls () {
      return this.canReorder && this.currentMode === 'browse'
    },
    sortButtonLabel () {
      return this.isSorting ? this.$t('common:sidebar.finishSorting') : this.$t('common:sidebar.reorder')
    }
  },
  watch: {
    locale (newLocale, oldLocale) {
      // 避免页面加载时不必要的刷新
      // 只在 locale 真正改变时才刷新
      if (!newLocale || newLocale === oldLocale) {
        return
      }
      // 如果当前父节点的 locale 已经是新的 locale，不需要刷新
      if (this.currentParent.locale === newLocale) {
        return
      }
      if (this.currentMode !== 'browse') {
        return
      }
      this.currentParent.locale = newLocale
      this.loadedCache = []
      this.fetchBrowseItems(this.currentParent)
    }
  },
  methods: {
    switchMode (mode) {
      const prevMode = this.currentMode
      console.log('[nav-sidebar] switch mode', prevMode, '->', mode)
      this.isSorting = false
      this.currentMode = mode
      window.localStorage.setItem('navPref', mode)
      if (mode === `browse`) {
        if (prevMode !== 'browse') {
          this.parents = [this.currentParent]
        }
        this.loadedCache = []
        this.fetchBrowseItems(this.currentParent)
      }
    },
    async fetchBrowseItems (item, forceRefresh = false, keepSortingMode = false) {
      if (!keepSortingMode) {
        this.isSorting = false
      }
      this.$store.commit(`loadingStart`, 'browse-load')
      if (!item) {
        item = this.currentParent
      }

      if (this.loadedCache.indexOf(item.id) < 0) {
        this.currentItems = []
      }

      if (item.id === 0) {
        this.parents = []
      } else {
        const flushRightIndex = _.findIndex(this.parents, ['id', item.id])
        if (flushRightIndex >= 0) {
          this.parents = _.take(this.parents, flushRightIndex)
        }
        if (this.parents.length < 1) {
          this.parents.push(this.currentParent)
        }
        this.parents.push(item)
      }

      this.currentParent = item
      
      // 保存当前导航状态到 localStorage
      this.saveNavigationState()

      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int, $locale: String!) {
            pages {
              tree(parent: $parent, mode: ALL, locale: $locale) {
                id
                path
                title
                isFolder
                pageId
                parent
                locale
              }
            }
          }
        `,
        fetchPolicy: forceRefresh ? 'network-only' : 'cache-first',
        variables: {
          parent: item.id,
          locale: this.activeLocale
        }
      })
      this.loadedCache = _.union(this.loadedCache, [item.id])
      const treeItems = _.get(resp, 'data.pages.tree', [])
      console.log('[nav-sidebar] fetched items for parent', item.id, treeItems.length)
      this.currentItems = treeItems
      this.$store.commit(`loadingStop`, 'browse-load')
    },
    toggleSortMode () {
      console.log('[nav-sidebar] toggle sort', !this.isSorting)
      if (!this.showSortControls || this.sortLoading) {
        return
      }
      this.isSorting = !this.isSorting
    },
    async onSortEnd (evt) {
      console.log('[nav-sidebar] sort end', evt && evt.oldIndex, evt && evt.newIndex)
      if (!this.isSorting || this.sortLoading) {
        return
      }
      if (!evt || evt.oldIndex === evt.newIndex) {
        return
      }
      await this.persistOrder()
    },
    async persistOrder () {
      if (this.currentItems.length < 1) {
        return
      }
      this.sortLoading = true
      try {
        console.log('[nav-sidebar] persist order', this.currentItems.map(i => i.id))
        const order = this.currentItems.map(item => item.id)
        const parentId = this.currentParent && this.currentParent.id > 0 ? this.currentParent.id : null
        const resp = await this.$apollo.mutate({
          mutation: reorderTreeMutation,
          variables: {
            parent: parentId,
            order,
            locale: this.activeLocale
          }
        })
        const result = _.get(resp, 'data.pages.reorderTree.responseResult', {})
        if (!result || !result.succeeded) {
          throw new Error(result.message || 'Unable to update order.')
        }
        this.$store.commit('showNotification', {
          message: result.message || 'Directory order updated.',
          style: 'success',
          icon: 'check'
        })
        await this.fetchBrowseItems(this.currentParent, true, true)
      } catch (err) {
        console.error(err)
        this.$store.commit('showNotification', {
          message: err.message || 'Unable to update order.',
          style: 'red',
          icon: 'alert'
        })
        await this.fetchBrowseItems(this.currentParent, true, true)
      } finally {
        this.sortLoading = false
      }
    },
    onFolderClick (item) {
      if (this.isSorting || this.sortLoading) {
        return
      }
      this.fetchBrowseItems(item)
    },
    onPageClick (event) {
      if (this.isSorting || this.sortLoading) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    goHome () {
      window.location.assign(siteLangs.length > 0 ? `/${this.activeLocale}/home` : '/')
    },
    openImportDialog () {
      this.$root.$emit('openImportDialog', {
        currentPath: this.currentParent && this.currentParent.id > 0 ? this.currentParent.path : '',
        locale: this.activeLocale,
        parentId: this.currentParent ? this.currentParent.id : 0
      })
    },
    refreshBrowseTree () {
      // Force refresh the current view
      this.fetchBrowseItems(this.currentParent, true)
    },
    async deleteFolder (folder) {
      const confirmed = confirm(
        `确定要删除文件夹 "${folder.title}" 及其下的所有页面吗？此操作不可恢复。`
      )
      
      if (!confirmed) {
        return
      }
      
      // Reset dialog state
      this.deleteFolderDialog = {
        shown: true,
        deleting: true,
        completed: false,
        error: null,
        folderTitle: folder.title,
        folderPath: folder.path,
        folderLocale: folder.locale || this.activeLocale,
        progress: 0,
        currentFile: '',
        totalCount: 0,
        deletedCount: 0,
        failedCount: 0
      }
      
      try {
        // Step 1: Get all pages in the folder
        const pagesResp = await this.$apollo.query({
          query: getFolderPagesQuery,
          variables: {
            path: folder.path,
            locale: folder.locale || this.activeLocale
          },
          fetchPolicy: 'network-only'
        })
        
        const pages = pagesResp.data.pages.folderPages || []
        
        if (pages.length === 0) {
          throw new Error('文件夹中没有找到页面')
        }
        
        this.deleteFolderDialog.totalCount = pages.length
        
        // Step 2: Delete pages one by one
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          this.deleteFolderDialog.currentFile = page.path
          
          try {
            const deleteResp = await this.$apollo.mutate({
              mutation: deletePageMutation,
              variables: {
                id: page.id
              }
            })
            
            if (deleteResp.data.pages.delete.responseResult.succeeded) {
              this.deleteFolderDialog.deletedCount++
            } else {
              this.deleteFolderDialog.failedCount++
            }
          } catch (err) {
            console.error(`Failed to delete page ${page.path}:`, err)
            this.deleteFolderDialog.failedCount++
          }
          
          // Update progress
          this.deleteFolderDialog.progress = Math.round(((i + 1) / pages.length) * 100)
        }
        
        // Step 3: Rebuild tree
        await this.$apollo.mutate({
          mutation: gql`
            mutation {
              pages {
                rebuildTree {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `
        })
        
        this.deleteFolderDialog.deleting = false
        this.deleteFolderDialog.completed = true
        this.deleteFolderDialog.currentFile = ''
        
        this.$store.commit('showNotification', {
          message: `成功删除 ${this.deleteFolderDialog.deletedCount} 个文件`,
          style: 'success',
          icon: 'check'
        })
        
        // Refresh the current view
        this.fetchBrowseItems(this.currentParent, true)
      } catch (err) {
        console.error(err)
        this.deleteFolderDialog.error = err.message
        this.deleteFolderDialog.deleting = false
        this.$store.commit('showNotification', {
          message: `删除失败: ${err.message}`,
          style: 'error',
          icon: 'alert'
        })
      }
    },
    closeDeletionDialog () {
      this.deleteFolderDialog.shown = false
      // Reset after a delay
      setTimeout(() => {
        this.deleteFolderDialog = {
          shown: false,
          deleting: false,
          completed: false,
          error: null,
          folderTitle: '',
          folderPath: '',
          folderLocale: '',
          progress: 0,
          currentFile: '',
          totalCount: 0,
          deletedCount: 0,
          failedCount: 0
        }
      }, 300)
    },
    async renameFolder (folder) {
      const newTitle = prompt(
        `请输入新的文件夹名称:`,
        folder.title
      )
      
      if (!newTitle || newTitle.trim() === '') {
        return
      }
      
      if (newTitle === folder.title) {
        return
      }
      
      this.sortLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: renameFolderMutation,
          variables: {
            path: folder.path,
            locale: folder.locale || this.activeLocale,
            newTitle: newTitle.trim()
          }
        })
        
        if (resp.data.pages.renameFolder.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: resp.data.pages.renameFolder.responseResult.message || '文件夹已重命名',
            style: 'success',
            icon: 'check'
          })
          
          // Refresh the current view
          this.fetchBrowseItems(this.currentParent, true)
        } else {
          throw new Error(resp.data.pages.renameFolder.responseResult.message)
        }
      } catch (err) {
        console.error(err)
        this.$store.commit('showNotification', {
          message: `重命名失败: ${err.message}`,
          style: 'error',
          icon: 'alert'
        })
      } finally {
        this.sortLoading = false
      }
    },
    saveNavigationState () {
      // 保存当前导航树的展开状态
      try {
        const state = {
          currentParentId: this.currentParent.id,
          currentParentPath: this.currentParent.path,
          currentParentTitle: this.currentParent.title,
          parents: this.parents.map(p => ({
            id: p.id,
            path: p.path,
            title: p.title,
            locale: p.locale
          })),
          locale: this.activeLocale
        }
        window.localStorage.setItem('navTreeState', JSON.stringify(state))
      } catch (err) {
        console.warn('Failed to save navigation state:', err)
      }
    },
    restoreNavigationState () {
      // 恢复之前保存的导航树状态
      try {
        const stateStr = window.localStorage.getItem('navTreeState')
        if (!stateStr) {
          return false
        }
        
        const state = JSON.parse(stateStr)
        
        // 只在 locale 匹配时恢复状态
        if (state.locale !== this.activeLocale) {
          return false
        }
        
        // 恢复 currentParent 和 parents
        if (state.currentParentId !== undefined) {
          this.currentParent = {
            id: state.currentParentId,
            path: state.currentParentPath,
            title: state.currentParentTitle,
            locale: state.locale
          }
          
          if (state.parents && state.parents.length > 0) {
            this.parents = state.parents
          }
          
          return true
        }
      } catch (err) {
        console.warn('Failed to restore navigation state:', err)
      }
      return false
    }
  },
  mounted () {
    this.currentParent.title = `/ ${this.$t('common:sidebar.root')}`
    this.currentParent.locale = this.locale || this.activeLocale
    this.parents = [this.currentParent]
    if (this.navMode === 'TREE') {
      this.currentMode = 'browse'
    } else if (this.navMode === 'STATIC') {
      this.currentMode = 'custom'
    } else {
      this.currentMode = window.localStorage.getItem('navPref') || 'custom'
    }
    if (this.currentMode === 'browse') {
      if (this.locale) {
        // 尝试恢复之前保存的导航状态
        const restored = this.restoreNavigationState()
        if (restored) {
          // 如果成功恢复状态，加载恢复的目录内容
          this.fetchBrowseItems(this.currentParent)
        } else {
          // 否则加载根目录
          this.fetchBrowseItems(this.currentParent)
        }
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.nav-sidebar__handle {
  cursor: grab;
}

.nav-sidebar__handle:active {
  cursor: grabbing;
}

.nav-sidebar__folder-action {
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.nav-sidebar__folder-item:hover .nav-sidebar__folder-action {
  opacity: 1;
}
</style>
