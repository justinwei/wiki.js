#!/usr/bin/env node
'use strict';

const fetch = require('node-fetch');

const DEFAULT_ROOT_PATH = process.env.WIKI_DELETE_ROOT || 'guliteos';
const DEFAULT_LOCALE = process.env.WIKI_LOCALE || 'zh';
const DEFAULT_BASE_URL = (process.env.WIKI_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootPath = normalizePath(options.root || DEFAULT_ROOT_PATH);
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const locale = options.locale || DEFAULT_LOCALE;
  const token = options.token || process.env.WIKI_API_TOKEN;
  const dryRun = options.dryRun;

  if (!rootPath) {
    console.error('必须提供要删除的根路径，例如 --root guliteos');
    process.exit(1);
  }

  if (!token) {
    console.error('缺少 Wiki.js API Token。请设置环境变量 WIKI_API_TOKEN 或使用 --token 参数。');
    process.exit(1);
  }

  const wikiClient = new WikiClient(baseUrl, token);

  let pages;
  try {
    pages = await wikiClient.listPages(locale);
  } catch (err) {
    console.error('获取页面列表失败：', err.message);
    process.exit(1);
  }

  const targets = pages.filter(page => {
    if (page.locale !== locale) {
      return false;
    }
    if (page.path === rootPath) {
      return true;
    }
    return page.path.startsWith(`${rootPath}/`);
  }).sort((a, b) => b.path.length - a.path.length);

  if (targets.length === 0) {
    console.log(`没有找到路径前缀为 "${rootPath}" 的页面。`);
    return;
  }

  console.log(`即将处理 ${targets.length} 个页面（路径前缀：${rootPath}，语言：${locale}）。`);
  if (dryRun) {
    console.log('当前处于 dry-run 模式，不会对 Wiki.js 做任何修改。');
  }

  let deletedCount = 0;
  for (const page of targets) {
    if (dryRun) {
      console.log(`[dry-run] 将删除：${page.path} (ID: ${page.id}, 标题: ${page.title || '无标题'})`);
      continue;
    }
    try {
      const result = await wikiClient.deletePage(page.id);
      if (result.succeeded) {
        deletedCount += 1;
        console.log(`已删除：${page.path}`);
      } else {
        console.error(`删除失败：${page.path} - ${result.errorCode || 'UNKNOWN'} ${result.message || ''}`);
      }
    } catch (err) {
      console.error(`删除失败：${page.path}`);
      console.error(err.message);
    }
  }

  if (!dryRun) {
    console.log(`完成删除，成功删除 ${deletedCount} 个页面。`);
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
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
      case '--execute':
        options.dryRun = false;
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

function normalizePath(input) {
  if (!input) {
    return '';
  }
  return input.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function printHelp() {
  console.log(`删除指定路径下的所有 Wiki.js 页面

用法：
  node scripts/delete-guliteos.js --root <路径> [选项]

选项：
      --root <path>     要删除的页面根路径（默认：${DEFAULT_ROOT_PATH}）
      --locale <code>   语言代码（默认：${DEFAULT_LOCALE}）
      --base-url <url>  Wiki.js 访问地址（默认：${DEFAULT_BASE_URL}）
      --token <token>   Wiki.js API Token（默认读取环境变量 WIKI_API_TOKEN）
      --execute         执行实际删除；默认仅 dry-run
      --dry-run         强制 dry-run（默认即为 dry-run）
  -h, --help            查看帮助
`);
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

  async listPages(locale) {
    const query = `
      query AllPages($locale: String) {
        pages {
          list(locale: $locale) {
            id
            path
            locale
            title
          }
        }
      }
    `;
    const data = await this.request(query, { locale });
    return data.pages.list || [];
  }

  async deletePage(id) {
    const mutation = `
      mutation DeletePage($id: Int!) {
        pages {
          delete(id: $id) {
            responseResult {
              succeeded
              errorCode
              message
            }
          }
        }
      }
    `;
    const data = await this.request(mutation, { id });
    const result = data.pages.delete.responseResult || {};
    return {
      succeeded: !!result.succeeded,
      errorCode: result.errorCode,
      message: result.message
    };
  }
}

main().catch(err => {
  console.error('脚本执行失败：', err);
  process.exit(1);
});

