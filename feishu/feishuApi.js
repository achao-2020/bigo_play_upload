// feishu/feishuApi.js

// 后端基础地址：
// - 本地开发（由 server.js 同时提供前后端时）：可以留空，使用相对路径 /api/...
// - 前后端分离部署时（前端在 Cloudflare Pages，后端在 Render/Railway）：
//   在 index.html 中通过 window.FEISHU_BACKEND_BASE_URL 配置，例如：
//   window.FEISHU_BACKEND_BASE_URL = 'https://your-backend.onrender.com';
const BACKEND_BASE_URL =
  (typeof window !== 'undefined' && window.FEISHU_BACKEND_BASE_URL) || '';

function buildApiUrl(path) {
  if (!BACKEND_BASE_URL) {
    return path; // 兼容本地：仍然使用 /api/... 相对路径
  }
  // 去掉结尾的 /，避免出现双斜杠
  const base = BACKEND_BASE_URL.replace(/\/+$/, '');
  return `${base}${path}`;
}

// 获取登录 token
function getAuthToken() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('auth_token') || '';
  }
  return '';
}

// 构建带认证头的请求配置
function buildAuthHeaders(additionalHeaders = {}) {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && {
      'Authorization': `Bearer ${token}`,
      'x-auth-token': token
    }),
    ...additionalHeaders
  };
}

export async function addBitableRecords(records, tableId = '') {
  // 获取第一个不为空的比赛id
  let gameId = null;
  console.log('开始获取第一个不为空的比赛id, records:', records);
  console.log('records[0]:', records[0]);
  console.log('records[0][比赛id]:', records[0]['比赛id']);

  for (const record of records) {
    if (record['比赛id']) {
      // 检查比赛id是否是对象数组格式（飞书API响应格式）
      if (Array.isArray(record['比赛id']) && record['比赛id'][0] && record['比赛id'][0].text) {
        gameId = record['比赛id'][0].text;
      } else {
        // 如果是直接的值（前端传递格式），直接使用
        gameId = record['比赛id'];
      }
      break;
    }
  }

  console.log('gameId:', gameId, typeof gameId);

  if (gameId) {
    // 根据tableId确定对应的view_id
    let viewId = '';
    if (tableId === 'tblK9ypDJ2sFyC6i') { // 比赛球队数据
      viewId = 'vewiURewir';
    } else if (tableId === 'tblK0ZVeOvXnzaLe' || tableId === '') { // 比赛球员数据表或默认
      viewId = 'vewiURewir';
    } else if (tableId === 'tblZwxf96Tw1EC71') { // 比赛明细数据
      viewId = 'vewq4i29ck';
    }

    console.log('调用搜索接口，tableId:', tableId, 'viewId:', viewId, 'gameId:', gameId);

    // 调用搜索接口检查是否存在相同的比赛id
    const searchRes = await fetch(buildApiUrl('/api/feishu/search-records'), {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        tableId: tableId,
        viewId: viewId,
        gameId: gameId
      })
    });
    const searchData = await searchRes.json();
    if (searchData.code === 0 && searchData.data && searchData.data.items && searchData.data.items.length > 0) {
      throw new Error('存在比赛id一致的数据，请联系管理员删除原来的数据再上传。');
    }
  }

  // 调用本地/远程代理接口
  const res = await fetch(buildApiUrl('/api/feishu/add-records'), {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      records: records,
      tableId: tableId
    })
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`新增记录失败：${data.msg}`);
  }

  return data;
}
