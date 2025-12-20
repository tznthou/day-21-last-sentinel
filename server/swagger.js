/**
 * Swagger Configuration
 * API Documentation for The Last Sentinel
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'The Last Sentinel API',
      version: '4.0.1',
      description: `
# 末世哨兵 API 文件

末日後的廢土上，這是最後的網路監聽終端。

## 認證方式

大部分 API 需要先透過 \`/api/auth/login\` 登入取得 session，
後續請求會自動帶上 session cookie。

## Rate Limiting

- 一般 API: 100 requests / 15 分鐘
- 認證 API: 10 requests / 15 分鐘
- 掃描 API: 5 requests / 分鐘
- 新增頻率: 10 requests / 小時
      `,
      contact: {
        name: 'Sentinel Support',
        url: 'https://github.com/tznthou/day-21-last-sentinel'
      },
      license: {
        name: 'AGPL-3.0',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://last-sentinel.zeabur.app',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: '哨兵身份認證'
      },
      {
        name: 'Targets',
        description: '監聽頻率管理'
      },
      {
        name: 'Stream',
        description: '即時串流與監控'
      },
      {
        name: 'System',
        description: '系統狀態'
      }
    ],
    components: {
      schemas: {
        Sentinel: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '哨兵 ID'
            },
            callsign: {
              type: 'string',
              description: '哨兵代號'
            }
          }
        },
        Target: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '頻率 ID'
            },
            url: {
              type: 'string',
              format: 'uri',
              description: '監聽網址'
            },
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: '監聽關鍵字'
            },
            name: {
              type: 'string',
              description: '頻率名稱'
            },
            is_active: {
              type: 'boolean',
              description: '是否啟用'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: '建立時間'
            }
          }
        },
        Signal: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            target_id: {
              type: 'string',
              format: 'uuid'
            },
            content: {
              type: 'string',
              description: '攔截內容'
            },
            matched_keywords: {
              type: 'array',
              items: { type: 'string' }
            },
            ai_summary: {
              type: 'string',
              description: 'AI 摘要'
            },
            ai_threat_level: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'],
              description: '威脅等級'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: '錯誤代碼'
            },
            message: {
              type: 'string',
              description: '錯誤訊息'
            }
          }
        }
      },
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sentinel.sid',
          description: 'Session cookie (登入後自動設定)'
        }
      }
    }
  },
  apis: ['./server/routes/*.js', './server/swagger-docs.js']
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 * @param {Express} app - Express application
 */
export function setupSwagger(app) {
  // Serve Swagger UI at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .info .title { color: #33ff00 }
    `,
    customSiteTitle: 'Last Sentinel API Docs'
  }));

  // Serve raw OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
