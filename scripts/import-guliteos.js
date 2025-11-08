#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

const DEFAULT_SOURCE_DIR = process.env.WIKI_SOURCE_DIR || 'guLiteOS应用开发';
const DEFAULT_ROOT_PATH = process.env.WIKI_ROOT_PATH || 'guliteos';
const DEFAULT_LOCALE = process.env.WIKI_LOCALE || 'zh';
const DEFAULT_BASE_URL = (process.env.WIKI_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGkiOjEsImdycCI6MSwiaWF0IjoxNzYyNTc0MDY0LCJleHAiOjE3OTQxMzE2NjQsImF1ZCI6InVybjp3aWtpLmpzIiwiaXNzIjoidXJuOndpa2kuanMifQ.KQEDKNBYfWKvIVfZLbdks3cEKbxfHMoltKDHQZfhDR_kqn3P9jZZrt0cGCStnMksI9Bm5XVjMbXcHE94rKWU1XKecaWPHM6A1C33i5blZLkMkES97dD7mxYVgsJgWSwRcKGDeWi5ZXaizkGTf49U2Tsf9R15UbGHIw1xVs6plL9sNARA0ATbzsVt-kgfVEvMcCEItEPyU6Zf2eKle5jMevnRlaeronLgOAYT8B6dHzzJ7c80ZP7SaD8cxx0T4csDQulhBxNU1HxHcE9XwhLCnpSGGWTL6j6SYvKNG2a46PO03KmXO5p84KzLSsjn0s61vy3miPsv8k97Y2axEP3saA"
  const sourceDir = path.resolve(process.cwd(), options.dir || DEFAULT_SOURCE_DIR);
  const rootPath = sanitizeSegment(options.root || DEFAULT_ROOT_PATH);
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const locale = options.locale || DEFAULT_LOCALE;
  const token = options.token || process.env.WIKI_API_TOKEN;
  const includeTags = options.includeTags;
  const dryRun = options.dryRun;

  if (!token && !dryRun) {
    console.error('缺少 Wiki.js API Token。请设置环境变量 WIKI_API_TOKEN 或使用 --token 参数。');
    process.exit(1);
  }
  if (!token && dryRun) {
    console.warn('未提供 Wiki.js API Token，当前以 dry-run 方式运行，不会访问 Wiki.js。');
  }

  let sourceStats;
  try {
    sourceStats = await fs.stat(sourceDir);
  } catch (err) {
    console.error(`无法访问目录：${sourceDir}`);
    console.error(err.message);
    process.exit(1);
  }
  if (!sourceStats.isDirectory()) {
    console.error(`路径不是有效目录：${sourceDir}`);
    process.exit(1);
  }

  const markdownFiles = await collectMarkdownFiles(sourceDir);
  if (markdownFiles.length === 0) {
    console.log('指定目录下没有找到 Markdown 文件。');
    return;
  }

  console.log(`准备导入 ${markdownFiles.length} 个文件，目标根路径：${rootPath}，语言：${locale}`);
  if (dryRun) {
    console.log('当前处于 dry-run 模式，不会对 Wiki.js 做任何修改。');
  }

  const wikiClient = dryRun ? null : new WikiClient(baseUrl, token);
  const seenPaths = new Set();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedEmptyCount = 0;

  for (const absoluteFile of markdownFiles) {
    const relativePath = path.relative(sourceDir, absoluteFile);
    const wikiPathBase = buildWikiPath(relativePath, rootPath);
    const wikiPath = ensureUniquePath(wikiPathBase, seenPaths);
    const content = await fs.readFile(absoluteFile, 'utf8');
    const meta = deriveMeta(content, relativePath);
    const tags = includeTags ? buildTags(relativePath) : [];

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      skippedEmptyCount += 1;
      console.warn(`[skip-empty] ${relativePath} -> ${wikiPath} (文件内容为空，已跳过)`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${relativePath} -> ${wikiPath} (${meta.title})`);
      continue;
    }

    try {
      const result = await createOrUpdatePage(wikiClient, {
        content,
        description: meta.description,
        editor: 'markdown',
        isPrivate: false,
        isPublished: true,
        locale,
        path: wikiPath,
        tags,
        title: meta.title
      });

      if (result.action === 'created') {
        createdCount += 1;
        console.log(`已创建：${wikiPath}`);
      } else if (result.action === 'updated') {
        updatedCount += 1;
        console.log(`已更新：${wikiPath}`);
      }
    } catch (err) {
      console.error(`导入失败：${relativePath}`);
      console.error(err.message);
    }
  }

  if (skippedEmptyCount > 0) {
    console.log(`跳过 ${skippedEmptyCount} 个内容为空的文件。`);
  }

  if (!dryRun) {
    console.log(`完成导入。新建 ${createdCount} 个页面，更新 ${updatedCount} 个页面。`);
  }
}

function parseArgs(argv) {
  const options = {
    includeTags: false,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-d':
      case '--dir':
        options.dir = argv[++i];
        break;
      case '-r':
      case '--root':
        options.root = argv[++i];
        break;
      case '--locale':
        options.locale = argv[++i];
        break;
      case '--base-url':
        options.baseUrl = argv[++i];
        break;
      case '--token':
        options.token = argv[++i];
        break;
      case '--tags':
        options.includeTags = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`未知参数：${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`将指定目录下的 Markdown 文件导入 Wiki.js

用法：
  node scripts/import-guliteos.js [选项]

选项：
  -d, --dir <path>      要导入的根目录（默认：${DEFAULT_SOURCE_DIR}）
  -r, --root <path>     Wiki 页面根路径（默认：${DEFAULT_ROOT_PATH}）
      --locale <code>   语言代码（默认：${DEFAULT_LOCALE}）
      --base-url <url>  Wiki.js 访问地址（默认：${DEFAULT_BASE_URL}）
      --token <token>   Wiki.js API Token（默认读取环境变量 WIKI_API_TOKEN）
      --tags            使用子目录名称作为标签
      --dry-run         仅输出将要执行的操作，不产生实际写入
  -h, --help            查看帮助
`);
}

async function collectMarkdownFiles(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childFiles = await collectMarkdownFiles(fullPath, baseDir);
      files.push(...childFiles);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }
  files.sort((a, b) => naturalComparePaths(
    path.relative(baseDir, a),
    path.relative(baseDir, b)
  ));
  return files;
}

function naturalComparePaths(pathA, pathB) {
  const segmentsA = pathA.split(path.sep);
  const segmentsB = pathB.split(path.sep);
  const maxLen = Math.max(segmentsA.length, segmentsB.length);

  for (let i = 0; i < maxLen; i += 1) {
    const segA = segmentsA[i];
    const segB = segmentsB[i];

    if (segA === undefined) {
      return -1;
    }
    if (segB === undefined) {
      return 1;
    }

    const normA = normalizeSegmentForCompare(segA);
    const normB = normalizeSegmentForCompare(segB);

    const cmp = normA.localeCompare(normB, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) {
      return cmp;
    }
  }

  return 0;
}

function normalizeSegmentForCompare(segment) {
  return normalizeForPath(segment.replace(/\.md$/i, ''));
}

function buildWikiPath(relativeFilePath, rootPath) {
  const segments = relativeFilePath.split(path.sep).map((segment, index, arr) => {
    const withoutExt = index === arr.length - 1 ? segment.replace(/\.md$/i, '') : segment;
    return sanitizeSegment(withoutExt);
  }).filter(Boolean);
  const parts = [...(rootPath ? [rootPath] : []), ...segments];
  return parts.join('/');
}

function ensureUniquePath(basePath, seen) {
  let candidate = basePath;
  let counter = 1;
  while (seen.has(candidate)) {
    counter += 1;
    candidate = `${basePath}-${counter}`;
  }
  seen.add(candidate);
  return candidate;
}

function buildTags(relativeFilePath) {
  const segments = relativeFilePath.split(path.sep);
  segments.pop();
  return segments.map(segment => sanitizeSegmentForTag(segment)).filter(Boolean);
}

function sanitizeSegment(segment) {
  const trimmed = segment
    .replace(/\.md$/i, '')
    .trim();
  if (!trimmed) {
    return 'untitled';
  }
  return normalizeForPath(trimmed) || 'untitled';
}

function sanitizeSegmentForTag(segment) {
  const trimmed = segment
    .replace(/\.md$/i, '')
    .trim();
  return normalizeForPath(trimmed) || 'untitled';
}

function deriveMeta(content, relativePath) {
  const title = createTitleFromFilename(relativePath);
  const description = extractDescription(content, title);
  return { title, description };
}

function createTitleFromFilename(relativePath) {
  const baseName = path.parse(relativePath).name;
  return baseName.trim() || '未命名';
}

function normalizeForPath(str) {
  return str
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .replace(/\\/g, '-')
    .replace(/\//g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
}

function extractDescription(content, fallback) {
  const plain = stripMarkdown(content).trim();
  if (!plain) {
    return fallback;
  }
  const normalized = plain.replace(/\s+/g, ' ');
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 177)}...`;
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\r?\n+/g, ' ');
}

async function createOrUpdatePage(client, payload) {
  const createResult = await client.createPage(payload);
  if (createResult.responseResult && createResult.responseResult.succeeded) {
    return { action: 'created', id: createResult.page ? createResult.page.id : null };
  }

  const response = createResult.responseResult || {};
  if (response.errorCode === 'PAGE_DUPLICATE_CREATE') {
    const existing = await client.getPageByPath(payload.path, payload.locale);
    if (!existing) {
      throw new Error(`检测到重复路径 ${payload.path}，但无法获取现有页面。`);
    }
    const updateResult = await client.updatePage({
      id: existing.id,
      content: payload.content,
      description: payload.description,
      editor: payload.editor,
      isPrivate: payload.isPrivate,
      isPublished: payload.isPublished,
      locale: payload.locale,
      path: payload.path,
      tags: payload.tags,
      title: payload.title
    });
    if (updateResult.responseResult && updateResult.responseResult.succeeded) {
      return { action: 'updated', id: existing.id };
    }
    const updateResp = updateResult.responseResult || {};
    throw new Error(`更新页面失败：${updateResp.errorCode || 'UNKNOWN'} - ${updateResp.message || ''}`);
  }

  throw new Error(`创建页面失败：${response.errorCode || 'UNKNOWN'} - ${response.message || ''}`);
}

class WikiClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(query, variables) {
    const res = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({ query, variables })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GraphQL 请求失败：HTTP ${res.status} - ${text}`);
    }

    const payload = await res.json();
    if (payload.errors && payload.errors.length > 0) {
      const message = payload.errors.map(err => err.message).join('; ');
      throw new Error(`GraphQL 返回错误：${message}`);
    }

    return payload.data;
  }

  async createPage(input) {
    const mutation = `
      mutation CreatePage(
        $content: String!
        $description: String!
        $editor: String!
        $isPrivate: Boolean!
        $isPublished: Boolean!
        $locale: String!
        $path: String!
        $tags: [String!]!
        $title: String!
      ) {
        pages {
          create(
            content: $content
            description: $description
            editor: $editor
            isPrivate: $isPrivate
            isPublished: $isPublished
            locale: $locale
            path: $path
            tags: $tags
            title: $title
          ) {
            responseResult {
              succeeded
              errorCode
              message
            }
            page {
              id
              path
            }
          }
        }
      }
    `;
    const data = await this.request(mutation, input);
    return data.pages.create;
  }

  async updatePage(input) {
    const mutation = `
      mutation UpdatePage(
        $id: Int!
        $content: String!
        $description: String!
        $editor: String!
        $isPrivate: Boolean!
        $isPublished: Boolean!
        $locale: String!
        $path: String!
        $tags: [String!]!
        $title: String!
      ) {
        pages {
          update(
            id: $id
            content: $content
            description: $description
            editor: $editor
            isPrivate: $isPrivate
            isPublished: $isPublished
            locale: $locale
            path: $path
            tags: $tags
            title: $title
          ) {
            responseResult {
              succeeded
              errorCode
              message
            }
            page {
              id
              path
            }
          }
        }
      }
    `;
    const data = await this.request(mutation, input);
    return data.pages.update;
  }

  async getPageByPath(pagePath, locale) {
    const query = `
      query PageByPath($path: String!, $locale: String!) {
        pages {
          singleByPath(path: $path, locale: $locale) {
            id
            path
          }
        }
      }
    `;
    const data = await this.request(query, { path: pagePath, locale });
    return data.pages.singleByPath;
  }
}

main().catch(err => {
  console.error('脚本执行失败：', err);
  process.exit(1);
});
