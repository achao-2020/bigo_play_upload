const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
// 在云平台（如 Render/Railway）中通常会通过环境变量提供端口
const PORT = process.env.PORT || 3000;

// 启用CORS
app.use(cors());

// 解析JSON请求体
app.use(express.json());

// 提供静态文件
app.use(express.static(path.join(__dirname)));

// 飞书API配置
// 注意：部署到线上时，请通过环境变量提供以下配置，而不是硬编码在代码中
// 例如在 Render/Railway 的环境变量中设置：
// FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN,
// FEISHU_PLAYER_TABLE_ID, FEISHU_TEAM_TABLE_ID, FEISHU_DETAIL_TABLE_ID
const FEISHU_CONFIG = {
  BASE_URL: process.env.FEISHU_BASE_URL || 'https://open.feishu.cn/open-apis',
  APP_ID: process.env.FEISHU_APP_ID,
  APP_SECRET: process.env.FEISHU_APP_SECRET,
  BITABLE: {
    APP_TOKEN: process.env.FEISHU_APP_TOKEN,
    PLAYER_TABLE_ID: process.env.FEISHU_PLAYER_TABLE_ID,
    TEAM_TABLE_ID: process.env.FEISHU_TEAM_TABLE_ID,  // 球队数据表格ID
    DETAIL_TABLE_ID: process.env.FEISHU_DETAIL_TABLE_ID  // 比赛明细数据表格ID
  }
};

// 缓存访问令牌
let cachedToken = null;
let tokenExpireAt = 0;

// 获取飞书租户访问令牌
async function getTenantAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpireAt) {
    return cachedToken;
  }

  const res = await fetch(
    `${FEISHU_CONFIG.BASE_URL}/auth/v3/tenant_access_token/internal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_CONFIG.APP_ID,
        app_secret: FEISHU_CONFIG.APP_SECRET
      })
    }
  );

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 token 失败：${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  tokenExpireAt = now + (data.expire - 300) * 1000;
  return cachedToken;
}

// 代理接口：添加飞书多维表格记录（通用接口，支持指定表格ID）
app.post('/api/feishu/add-records', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const { APP_TOKEN } = FEISHU_CONFIG.BITABLE;
    
    // 从请求参数获取表格ID，如果没有指定则使用球员表格ID
    const tableId = req.body.tableId || FEISHU_CONFIG.BITABLE.PLAYER_TABLE_ID;
    
    // 打印发送到飞书API的records内容
    // 将fields保持为对象格式，符合飞书API要求
    const requestRecords = req.body.records.map(r => ({
      fields: r
    }));
    
    const response = await fetch(
      `${FEISHU_CONFIG.BASE_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/batch_create`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: requestRecords
        })
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代理接口：添加飞书多维表格记录（球员数据，保持向后兼容）
app.post('/api/feishu/player/add-records', async (req, res) => {
  // 复用通用接口，指定球员表格ID
  req.body.tableId = FEISHU_CONFIG.BITABLE.PLAYER_TABLE_ID;
  // 转发请求到通用接口
  app._router.handle(req, res);
});

// 代理接口：搜索飞书多维表格记录
app.post('/api/feishu/search-records', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const { APP_TOKEN } = FEISHU_CONFIG.BITABLE;
    const { tableId, viewId, gameId } = req.body;

    // 从请求参数获取表格ID，如果没有指定则使用球员表格ID
    const searchTableId = tableId || FEISHU_CONFIG.BITABLE.PLAYER_TABLE_ID;

    console.log('搜索飞书多维表格记录，viewId:', viewId, 'gameId:', gameId, 'tableId:', searchTableId);

    const response = await fetch(
      `${FEISHU_CONFIG.BASE_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${searchTableId}/records/search?page_size=1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          view_id: viewId,
          filter: {
            conjunction: 'and',
            conditions: [
              {
                field_name: '比赛id',
                operator: 'is',
                value: [
                  gameId
                ]
              }
            ]
          }
        })
      }
    );

    const data = await response.json();
    console.log('搜索飞书多维表格记录，响应数据:', data);
    res.json(data);
  } catch (error) {
    console.error('搜索飞书多维表格记录时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`访问 http://localhost:${PORT}/index.html 查看应用`);
});
