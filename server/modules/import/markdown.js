const fs = require('fs-extra')
const path = require('path')
const unzipper = require('unzipper')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  /**
   * Import markdown files from uploaded file or zip
   */
  async importFiles({ uploadPath, originalName, targetPath, locale, parentId, user, onProgress }) {
    // Ensure locale has a valid value
    locale = locale || WIKI.config.lang.code || 'zh'
    
    WIKI.logger.info(`[Import] Starting import: ${originalName}`)
    WIKI.logger.info(`[Import] Upload path: ${uploadPath}`)
    WIKI.logger.info(`[Import] Target path: ${targetPath}`)
    WIKI.logger.info(`[Import] Locale: ${locale}`)
    WIKI.logger.info(`[Import] User: ${user ? user.name : 'unknown'}`)
    
    const files = []
    let tempDir = null
    
    // Get file extension from original name
    const fileExt = path.extname(originalName).toLowerCase()
    WIKI.logger.info(`[Import] File extension: ${fileExt}`)
    
    try {
      // Check if it's a zip file
      if (fileExt === '.zip') {
        // Extract zip to temp directory
        tempDir = path.join(WIKI.SERVERPATH, 'data/temp', `import-${Date.now()}`)
        await fs.ensureDir(tempDir)
        WIKI.logger.info(`[Import] Extracting ZIP to: ${tempDir}`)
        
        await fs.createReadStream(uploadPath)
          .pipe(unzipper.Extract({ path: tempDir }))
          .promise()
        
        // Collect markdown files from extracted directory
        const extracted = await this.collectMarkdownFiles(tempDir)
        files.push(...extracted)
        WIKI.logger.info(`[Import] Found ${files.length} markdown files in ZIP`)
      } else if (fileExt === '.md') {
        // Single markdown file
        files.push(uploadPath)
        WIKI.logger.info(`[Import] Processing single markdown file`)
      } else {
        throw new Error('Unsupported file type. Only .md and .zip files are allowed.')
      }
      
      if (files.length === 0) {
        throw new Error('No markdown files found in the uploaded archive.')
      }
      
      const results = {
        total: files.length,
        created: 0,
        updated: 0,
        failed: 0,
        errors: []
      }
      
      // Get parent page info if parentId is provided
      let parentPath = targetPath || ''
      if (parentId) {
        const parentPage = await WIKI.models.pages.query()
          .select('path', 'localeCode')
          .findById(parentId)
        if (parentPage) {
          parentPath = parentPage.path
          locale = locale || parentPage.localeCode
        }
      }
      
      // Import each file
      for (let index = 0; index < files.length; index++) {
        const filePath = files[index]
        const isSingleFile = files.length === 1 && fileExt === '.md'
        const baseDir = tempDir || path.dirname(files[0])
        const relativePath = isSingleFile ? originalName : path.relative(baseDir, filePath)
        const fileName = isSingleFile ? path.parse(originalName).name : path.parse(filePath).name
        const progressFile = relativePath || originalName

        if (typeof onProgress === 'function') {
          await onProgress({
            stage: 'start',
            total: results.total,
            index,
            file: progressFile,
            title: fileName
          })
        }

        try {
          const content = await fs.readFile(filePath, 'utf8')
          if (!content || !content.trim()) {
            WIKI.logger.warn(`[Import] Skipping empty file: ${filePath}`)
            results.errors.push({
              file: path.basename(filePath),
              error: 'File content empty. Skipped.'
            })
            if (typeof onProgress === 'function') {
              await onProgress({
                stage: 'success',
                total: results.total,
                index,
                file: progressFile,
                title: fileName
              })
            }
            continue
          }
          
          const pagePath = this.buildPagePath(relativePath, parentPath, fileName)
          const title = this.extractTitle(fileName)
          const description = this.extractDescription(content, title)
          // Try to create or update page
          const result = await this.createOrUpdatePage({
            content,
            title,
            description,
            path: pagePath,
            locale: locale || WIKI.config.lang.code,
            isPublished: true,
            isPrivate: false,
            editor: 'markdown',
            user
          })
          
          if (result.success) {
            if (result.status === 'created') {
              results.created++
            } else if (result.status === 'updated') {
              results.updated++
            }
          } else {
            results.failed++
            results.errors.push({
              file: path.basename(filePath),
              error: result.error
            })
          }

          if (typeof onProgress === 'function') {
            await onProgress({
              stage: 'success',
              total: results.total,
              index,
              file: progressFile,
              title
            })
          }
        } catch (err) {
          results.failed++
          results.errors.push({
            file: path.basename(filePath),
            error: err.message
          })
          WIKI.logger.warn(`Failed to import file ${filePath}: ${err.message}`)

          if (typeof onProgress === 'function') {
            await onProgress({
              stage: 'failed',
              total: results.total,
              index,
              file: progressFile,
              title: fileName,
              error: err.message
            })
          }
        }
      }
      
      return results
    } finally {
      // Clean up temp directory if it was created
      if (tempDir) {
        await fs.remove(tempDir).catch(err => {
          WIKI.logger.warn(`Failed to clean up temp directory ${tempDir}: ${err.message}`)
        })
      }
    }
  },
  
  /**
   * Collect all markdown files recursively
   */
  async collectMarkdownFiles(dir, baseDir = dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []
    
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('__MACOSX')) {
        continue
      }
      
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const childFiles = await this.collectMarkdownFiles(fullPath, baseDir)
        files.push(...childFiles)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(fullPath)
      }
    }
    
    return files
  },
  
  /**
   * Build page path from file structure
   */
  buildPagePath(relativePath, parentPath, fileName) {
    const segments = relativePath.split(path.sep)
      .map(seg => this.sanitizeSegment(seg))
      .filter(Boolean)
    
    // Remove the filename from segments since we'll use it separately
    if (segments.length > 0) {
      segments.pop()
    }
    
    const parts = [
      ...(parentPath ? [parentPath] : []),
      ...segments,
      this.sanitizeSegment(fileName)
    ].filter(Boolean)
    
    return parts.join('/')
  },
  
  /**
   * Sanitize path segment
   */
  sanitizeSegment(segment) {
    return segment
      .replace(/\.md$/i, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/\./g, '-')
      .replace(/\\/g, '-')
      .replace(/\//g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/, '')
      .replace(/-$/, '') || 'untitled'
  },
  
  /**
   * Extract title from content or filename
   */
  extractTitle(fallback) {
    return fallback || '未命名'
  },
  
  /**
   * Extract description from content
   */
  extractDescription(content, fallback) {
    const plain = this.stripMarkdown(content).trim()
    if (!plain) {
      return fallback
    }
    const normalized = plain.replace(/\s+/g, ' ')
    if (normalized.length <= 180) {
      return normalized
    }
    return `${normalized.slice(0, 177)}...`
  },
  
  /**
   * Strip markdown syntax
   */
  stripMarkdown(markdown) {
    return markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s*/gm, '')
      .replace(/[*_~`]/g, '')
      .replace(/\|/g, ' ')
      .replace(/\r?\n+/g, ' ')
  },
  
  /**
   * Create or update page
   */
  async createOrUpdatePage(pageData) {
    try {
      // Ensure locale is set
      const locale = pageData.locale || WIKI.config.lang.code || 'en'
      
      WIKI.logger.info(`[Import] Processing page: ${pageData.path} (locale: ${locale})`)
      WIKI.logger.info(`[Import] pageData.path type: ${typeof pageData.path}, value: ${JSON.stringify(pageData.path)}`)
      WIKI.logger.info(`[Import] locale type: ${typeof locale}, value: ${JSON.stringify(locale)}`)
      
      // Validate required fields
      if (!pageData.path) {
        throw new Error('Page path is required')
      }
      if (!locale) {
        throw new Error('Locale is required')
      }
      
      // Check if page exists
      const existingPage = await WIKI.models.pages.query()
        .where('path', pageData.path)
        .where('localeCode', locale)
        .first()

      if (existingPage) {
        WIKI.logger.info(`[Import] Updating existing page: ${pageData.path}`)
        // Update existing page
        await WIKI.models.pages.updatePage({
          id: existingPage.id,
          content: pageData.content,
          title: pageData.title,
          description: pageData.description,
          isPublished: pageData.isPublished,
          isPrivate: pageData.isPrivate,
          user: pageData.user,
          skipStorage: true
        })
        WIKI.logger.info(`[Import] Successfully updated page: ${pageData.path}`)
        return { success: true, status: 'updated', path: pageData.path }
      } else {
        WIKI.logger.info(`[Import] Creating new page: ${pageData.path}`)
        // Create new page
        const page = await WIKI.models.pages.createPage({
          content: pageData.content,
          title: pageData.title,
          description: pageData.description,
          path: pageData.path,
          locale: locale,
          isPublished: pageData.isPublished,
          isPrivate: pageData.isPrivate,
          editor: pageData.editor,
          tags: [],
          user: pageData.user,
          skipStorage: true
        })
        WIKI.logger.info(`[Import] Successfully created page: ${pageData.path}, ID: ${page.id}`)
        return { success: true, status: 'created', path: pageData.path }
      }
    } catch (error) {
      WIKI.logger.error(`[Import] Failed to process page ${pageData.path}: ${error.message}`)
      return { success: false, error: error.message, path: pageData.path }
    }
  }
}
