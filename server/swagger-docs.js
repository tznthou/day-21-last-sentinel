/**
 * Swagger API Documentation
 * JSDoc annotations for all API endpoints
 */

// ============================================
// Auth API
// ============================================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 註冊新哨兵
 *     description: 建立新的哨兵身份，成功後自動登入
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callsign
 *               - passcode
 *             properties:
 *               callsign:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 description: 哨兵代號 (3-20 字元，英數字和底線)
 *                 example: ALPHA_01
 *               passcode:
 *                 type: string
 *                 minLength: 4
 *                 description: 通行碼 (至少 4 字元)
 *                 example: secret123
 *     responses:
 *       201:
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 哨兵身份已建立
 *                 sentinel:
 *                   $ref: '#/components/schemas/Sentinel'
 *       400:
 *         description: 輸入驗證失敗
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: 代號已被使用
 *       429:
 *         description: 請求次數過多
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 哨兵登入
 *     description: 驗證哨兵身份並建立 session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callsign
 *               - passcode
 *             properties:
 *               callsign:
 *                 type: string
 *                 description: 哨兵代號
 *                 example: ALPHA_01
 *               passcode:
 *                 type: string
 *                 description: 通行碼
 *                 example: secret123
 *     responses:
 *       200:
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 身份驗證成功
 *                 sentinel:
 *                   $ref: '#/components/schemas/Sentinel'
 *       401:
 *         description: 驗證失敗
 *       429:
 *         description: 嘗試次數過多
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: 哨兵登出
 *     description: 結束當前 session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 登出成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 已離開崗位
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 取得當前哨兵資訊
 *     description: 檢查登入狀態並取得哨兵資訊
 *     tags: [Auth]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 已登入
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                   example: true
 *                 sentinel:
 *                   $ref: '#/components/schemas/Sentinel'
 *       401:
 *         description: 尚未登入
 */

// ============================================
// Targets API
// ============================================

/**
 * @swagger
 * /api/targets:
 *   get:
 *     summary: 取得所有監聽頻率
 *     description: 取得當前哨兵的所有監聽頻率
 *     tags: [Targets]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Target'
 *       401:
 *         description: 未授權
 *
 *   post:
 *     summary: 新增監聽頻率
 *     description: 新增一個要監聽的網站頻率
 *     tags: [Targets]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - keywords
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: 要監聽的網址
 *                 example: https://news.ycombinator.com
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 要監聽的關鍵字 (1-20 個)
 *                 example: ["AI", "GPT", "機器人"]
 *               name:
 *                 type: string
 *                 description: 頻率名稱 (選填)
 *                 example: HackerNews
 *               check_interval:
 *                 type: integer
 *                 minimum: 60
 *                 description: 檢查間隔秒數 (最小 60)
 *                 example: 60
 *     responses:
 *       201:
 *         description: 建立成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Target'
 *       400:
 *         description: 驗證失敗 (URL 無效、關鍵字格式錯誤等)
 *       401:
 *         description: 未授權
 *       429:
 *         description: 超過頻率建立限制 (每小時 10 個)
 */

/**
 * @swagger
 * /api/targets/{id}:
 *   put:
 *     summary: 更新監聽頻率
 *     description: 更新指定頻率的設定
 *     tags: [Targets]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 頻率 ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *               name:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 頻率不存在
 *       401:
 *         description: 未授權
 *
 *   delete:
 *     summary: 刪除監聽頻率
 *     description: 刪除指定的監聽頻率
 *     tags: [Targets]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 頻率 ID
 *     responses:
 *       200:
 *         description: 刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Target deleted
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/targets/{id}/signals:
 *   get:
 *     summary: 取得頻率的訊號記錄
 *     description: 取得指定頻率攔截到的訊號
 *     tags: [Targets]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Signal'
 */

// ============================================
// Stream API
// ============================================

/**
 * @swagger
 * /api/stream/connect:
 *   get:
 *     summary: 建立 SSE 連線
 *     description: |
 *       建立 Server-Sent Events 連線，接收即時訊號推送。
 *
 *       **事件類型：**
 *       - `connected` - 連線建立成功
 *       - `signal` - 訊號攔截通知
 *       - `scan` - 掃描狀態更新
 *       - `noise` - 背景噪音數據
 *       - `heartbeat` - 心跳 (每 30 秒)
 *       - `status` - 系統狀態訊息
 *     tags: [Stream]
 *     responses:
 *       200:
 *         description: SSE 連線建立
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 event: connected
 *                 data: {"message":"SENTINEL LINK ESTABLISHED"}
 */

/**
 * @swagger
 * /api/stream/start:
 *   post:
 *     summary: 開始監聽
 *     description: 啟動監聽循環，開始掃描所有頻率
 *     tags: [Stream]
 *     responses:
 *       200:
 *         description: 監聽已啟動
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: MONITORING INITIATED
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: 尚未建立 SSE 連線
 */

/**
 * @swagger
 * /api/stream/stop:
 *   post:
 *     summary: 停止監聽
 *     description: 暫停監聽循環
 *     tags: [Stream]
 *     responses:
 *       200:
 *         description: 監聽已暫停
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: MONITORING SUSPENDED
 */

/**
 * @swagger
 * /api/stream/status:
 *   get:
 *     summary: 取得監聽狀態
 *     description: 取得當前監聽 session 的狀態
 *     tags: [Stream]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isActive:
 *                       type: boolean
 *                       description: 是否正在監聽
 *                     sessionId:
 *                       type: string
 *                       nullable: true
 *                     connected:
 *                       type: boolean
 *                       description: SSE 連線狀態
 */

/**
 * @swagger
 * /api/stream/scan:
 *   post:
 *     summary: 強制掃描
 *     description: 立即掃描所有頻率，不等待定時任務
 *     tags: [Stream]
 *     responses:
 *       200:
 *         description: 掃描已啟動
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: MANUAL SCAN INITIATED
 *       400:
 *         description: 尚未建立 SSE 連線
 *       429:
 *         description: 掃描次數超過限制 (每分鐘 5 次)
 */

// ============================================
// System API
// ============================================

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 系統健康檢查
 *     description: 檢查系統運作狀態
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 系統正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OPERATIONAL
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: 系統運行秒數
 *                 version:
 *                   type: string
 *                   example: "4.0.1"
 *                 codename:
 *                   type: string
 *                   example: SENTINEL
 */
