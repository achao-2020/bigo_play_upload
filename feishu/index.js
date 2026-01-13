// feishu/index.js
import { addBitableRecords } from './feishuApi.js';

/**
 * 获取19:30的时间戳
 * @param {number} operationTime - 操作时间（秒时间戳），如果提供则使用其日期部分
 */
function get1930Timestamp(operationTime = null) {
  let date;
  if (operationTime) {
    // 操作时间是秒时间戳，转换为毫秒
    date = new Date(operationTime);
  } else {
    // 如果没有提供操作时间，则使用当前日期
    date = new Date();
  }
  
  // 使用日期部分，但将时间设置为19:30
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    19,
    30,
    0,
    0
  ).getTime();
}

/**
 * JSON → 飞书 records
 */
// 辅助函数：获取球队比赛结果映射
function getTeamResultMap(json) {
  const teamScores = json?.game?.[0]?.teamScores || {};
  const scores = Object.values(teamScores);
  const maxScore = Math.max(...scores);
  
  // 创建球队结果映射对象
  const teamResultMap = {};
  Object.entries(teamScores).forEach(([team, score]) => {
    teamResultMap[team] = score === maxScore ? "胜" : "负";
  });
  
  return teamResultMap;
}

export function parseGameJson(json) {
  const players = json?.game?.[0]?.players || [];
  const matchId = json?.game?.[0]?.id || 3;
  const teamResultMap = getTeamResultMap(json);
  
  // 查找比赛明细中第一条操作时间不为空的数据
  const details = json?.details || [];
  const firstValidDetail = details.find(detail => detail.timestamp !== null && detail.timestamp !== undefined);
  const operationTime = firstValidDetail?.timestamp;
  
  // 生成比赛时间（使用操作时间的日期部分，时间为19:30）
  const matchTime = get1930Timestamp(operationTime);

  return players.map(p => ({
    "比赛id": matchId,
    "球队": p.team,
    "球员姓名": p.name,
    "球衣号码": p.number,
    "出场时间(s)": Math.round(p.totalTime+p.currentTime),
    "得分": p.score,
    "犯规次数": p.fouls,
    "正负值": p.plusMinus,
    "比赛时间": matchTime,
    "比赛结果": teamResultMap[p.team] || ""
  }));
}

/**
 * 解析球队得分数据
 */
export function parseTeamScores(json) {
  const teamScores = json?.game?.[0]?.teamScores || {};
  const matchId = json?.game?.[0]?.id || 3;
  
  // 查找比赛明细中第一条操作时间不为空的数据
  const details = json?.details || [];
  const firstValidDetail = details.find(detail => detail.timestamp !== null && detail.timestamp !== undefined);
  const operationTime = firstValidDetail?.timestamp;
  
  // 生成比赛时间（使用操作时间的日期部分，时间为19:30）
  const matchTime = get1930Timestamp(operationTime);
  
  // 找出最高分
  const scores = Object.values(teamScores);
  const maxScore = Math.max(...scores);
  
  // 转换为数组格式
  return Object.entries(teamScores).map(([team, score]) => ({
    "比赛id": matchId,
    "球队": team,
    "得分": score,
    "比赛时间": matchTime,
    "比赛结果": score === maxScore ? "胜" : "负"
  }));
}

/**
 * 解析比赛明细数据
 */
export function parseDetails(json) {
  const details = json?.details || [];
  const matchId = json?.game?.[0]?.id || 3;
  
  // 查找比赛明细中第一条操作时间不为空的数据
  const firstValidDetail = details.find(detail => detail.timestamp !== null && detail.timestamp !== undefined);
  const operationTime = firstValidDetail?.timestamp;
  
  // 生成比赛时间（使用操作时间的日期部分，时间为19:30）
  const matchTime = get1930Timestamp(operationTime);  // 比赛时间，和球员表一致
  
  // 转换为数组格式，处理null值
  return details.map(detail => ({
    "比赛id": matchId,
    "比赛时间": matchTime,
    "当前节": detail.period,
    "比赛进行时间": detail.gameTime,
    "类型": detail.type,
    "球队": detail.team !== null && detail.team !== undefined ? detail.team : "",  // 如果没有值，默认传递空字符串
    "球员": detail.player,
    "号码": detail.number !== null && detail.number !== undefined ? parseInt(detail.number) || -999 : -999,  // 转换为整数，如果转换失败或没有值，默认传递-999
    "得分": detail.value !== null && detail.value !== undefined ? detail.value : -999,  // 如果没有值，默认传递-999
    "操作时间": detail.timestamp
  }));
}

/**
 * 提交到飞书
 * @param {Array} records - 要提交的记录数组
 * @param {string} tableId - 目标表格ID（可选，默认使用球员表格）
 */
export async function submitToFeishu(records, tableId = '') {
  return addBitableRecords(records, tableId);
}

// 表格ID常量
export const TABLE_IDS = {
  PLAYER: '',  // 默认（球员表格）
  TEAM: 'tblK9ypDJ2sFyC6i',  // 球队表格
  DETAIL: 'tblZwxf96Tw1EC71'  // 比赛明细数据表格
};
