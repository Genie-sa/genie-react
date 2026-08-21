import { appDescription, appName, gitConfig, siteUrl } from './shared'

const markdownContent = {
  'text/markdown': {
    schema: { type: 'string' },
  },
} as const

const errorContent = {
  'application/json': {
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  },
} as const

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: `${appName} documentation site API`,
      version: '1.0.0',
      summary: `Machine-readable endpoints of the ${appName} documentation site.`,
      description: `${appDescription}\n\nThis specification covers the public HTTP endpoints of ${siteUrl}: documentation content as markdown, the docs search endpoint, and the discovery files agents use to index the site. The Genie React product itself is a local-first CLI and npm package (genie-react, @genie-react/cli) — it runs on the developer's machine and exposes no hosted API.`,
      contact: {
        name: `${appName} maintainers`,
        url: `https://github.com/${gitConfig.user}/${gitConfig.repo}/issues`,
      },
      license: {
        name: 'MIT',
        identifier: 'MIT',
      },
    },
    servers: [{ url: siteUrl, description: 'Production' }],
    tags: [
      { name: 'content', description: 'Documentation content as markdown.' },
      { name: 'search', description: 'Full-text search over the documentation.' },
      { name: 'discovery', description: 'Files agents use to discover and index this site.' },
    ],
    paths: {
      '/api/search': {
        get: {
          operationId: 'searchDocs',
          tags: ['search'],
          summary: 'Search the documentation',
          description:
            'Full-text search over every documentation page. Returns matching pages, headings, and text fragments with the URL to read each result.',
          parameters: [
            {
              name: 'query',
              in: 'query',
              required: true,
              description: 'Search terms. An empty or missing query returns an empty result list.',
              schema: { type: 'string', minLength: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of results to return.',
              schema: { type: 'integer', minimum: 1 },
            },
          ],
          responses: {
            '200': {
              description: 'Search results ordered by relevance.',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SearchResult' },
                  },
                },
              },
            },
            '500': {
              description: 'The search index failed to answer the query.',
              content: errorContent,
            },
          },
        },
      },
      '/docs/{pagePath}.md': {
        get: {
          operationId: 'getDocsPageMarkdown',
          tags: ['content'],
          summary: 'Read one documentation page as markdown',
          description:
            'Returns the markdown source of a documentation page. pagePath is the docs-relative path and may contain "/" (for example "getting-started/install" or "index"). The full list of pages with their markdown URLs is in /llms.txt. The same content negotiates on the HTML URL via the Accept: text/markdown request header.',
          parameters: [
            {
              name: 'pagePath',
              in: 'path',
              required: true,
              description: 'Docs-relative page path, for example "getting-started/install".',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'The page as markdown.',
              content: markdownContent,
            },
            '404': {
              description: 'No documentation page exists at this path.',
              content: markdownContent,
            },
          },
        },
      },
      '/llms.txt': {
        get: {
          operationId: 'getLlmsIndex',
          tags: ['discovery'],
          summary: 'llms.txt index of the documentation',
          description:
            'An llms.txt (llmstxt.org) index: when to use Genie React, plus every documentation page with title, description, and markdown URL.',
          responses: {
            '200': { description: 'The llms.txt index as markdown.', content: markdownContent },
          },
        },
      },
      '/llms-full.txt': {
        get: {
          operationId: 'getLlmsFullText',
          tags: ['discovery'],
          summary: 'Complete documentation as one markdown file',
          description:
            'Every documentation page concatenated into a single markdown document, for agents that prefer one fetch over crawling.',
          responses: {
            '200': {
              description: 'The complete documentation as markdown.',
              content: markdownContent,
            },
          },
        },
      },
      '/sitemap.xml': {
        get: {
          operationId: 'getSitemap',
          tags: ['discovery'],
          summary: 'XML sitemap',
          description: 'Every indexable URL on this site with last-modified dates.',
          responses: {
            '200': {
              description: 'The sitemap.',
              content: {
                'application/xml': { schema: { type: 'string' } },
              },
            },
          },
        },
      },
      '/openapi.json': {
        get: {
          operationId: 'getOpenApiDocument',
          tags: ['discovery'],
          summary: 'This OpenAPI document',
          description: 'The OpenAPI 3.1 description of this site, the document you are reading.',
          responses: {
            '200': {
              description: 'The OpenAPI document.',
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        SearchResult: {
          type: 'object',
          description: 'One search hit: a page, a heading, or a text fragment within a page.',
          required: ['id', 'url', 'type', 'content'],
          properties: {
            id: { type: 'string', description: 'Stable identifier of the hit.' },
            url: {
              type: 'string',
              description: 'Site-relative URL of the page (or heading anchor) that matched.',
            },
            type: {
              type: 'string',
              enum: ['page', 'heading', 'text'],
              description: 'What part of the page matched.',
            },
            content: { type: 'string', description: 'The matching text.' },
            breadcrumbs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Navigation trail of the page the hit belongs to.',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          description: 'Structured error returned by API endpoints.',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Stable machine-readable error code, for example "not_found".',
                },
                message: { type: 'string', description: 'Human-readable explanation.' },
                hint: {
                  type: 'string',
                  description: 'Where to look next to resolve the error.',
                },
              },
            },
          },
        },
      },
    },
  }
}
