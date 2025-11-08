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
        div.d-flex.align-center(v-if='showSortControls')
          v-progress-circular.mr-2(v-if='sortLoading', indeterminate, color='primary', size='14', width='2')
          v-btn(
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
          )
            v-list-item-avatar(size='24')
              v-icon(v-if='element.isFolder') mdi-folder
              v-icon(v-else) mdi-text-box
            v-list-item-title {{ element.title }}
            v-list-item-action(v-if='isSorting && canReorder')
              v-icon.nav-sidebar__handle mdi-drag
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
      sortLoading: false
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
      if (!newLocale || newLocale === oldLocale) {
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
    async fetchBrowseItems (item) {
      this.isSorting = false
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
        fetchPolicy: 'cache-first',
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
        await this.fetchBrowseItems(this.currentParent)
      } catch (err) {
        console.error(err)
        this.$store.commit('showNotification', {
          message: err.message || 'Unable to update order.',
          style: 'red',
          icon: 'alert'
        })
        await this.fetchBrowseItems()
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
        this.fetchBrowseItems(this.currentParent)
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
</style>
