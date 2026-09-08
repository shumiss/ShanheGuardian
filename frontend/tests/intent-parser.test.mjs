import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTravelIntent } from '../src/intentParser.js';

const stops = [
  { id: 'huangguoshu', name: '黄果树旅游景区' },
  { id: 'fanjingshan', name: '梵净山风景区' },
  { id: 'qingyan', name: '青岩古镇' },
  { id: 'xiaoqikong', name: '小七孔景区' },
  { id: 'zhenyuan', name: '镇远古城' },
  { id: 'zhaoxing', name: '肇兴侗寨' },
];

const options = {
  today: '2026-07-24T00:00:00+08:00',
  originCities: ['贵阳', '遵义', '毕节', '成都', '长沙'],
  regions: ['贵州', '阿坝', '张家界', '丽江'],
  stops,
};

test('extracts a family rain-safe trip from natural language', () => {
  const result = parseTravelIntent(
    '7月28日从遵义出发去贵州，带父母和孩子玩3天，不想太累，担心下雨路滑，想去黄果树和梵净山',
    options
  );

  assert.equal(result.values.startDate, '2026-07-28');
  assert.equal(result.values.origin, '遵义');
  assert.equal(result.values.destinationRegion, '贵州');
  assert.equal(result.values.days, 3);
  assert.equal(result.values.travelerType, 'family');
  assert.deepEqual(result.values.preferences, ['safe', 'lowload', 'nature']);
  assert.equal(result.values.intensity, 30);
  assert.equal(result.values.weather, 'rain');
  assert.deepEqual(result.values.stopIds, ['huangguoshu', 'fanjingshan']);
});

test('round-trips the structured planner summary', () => {
  const result = parseTravelIntent(
    '2026-07-23从毕节出发，亲子家庭旅行3天，偏好安全优先、山地自然，希望去青岩古镇、黄果树旅游景区、小七孔景区，路线强度适中，结合实时天气动态调整',
    options
  );

  assert.equal(result.values.startDate, '2026-07-23');
  assert.equal(result.values.origin, '毕节');
  assert.equal(result.values.days, 3);
  assert.equal(result.values.travelerType, 'family');
  assert.deepEqual(result.values.stopIds, ['huangguoshu', 'qingyan', 'xiaoqikong']);
  assert.equal(result.values.intensity, 55);
  assert.equal(result.values.weather, 'auto');
});

test('supports an arbitrary origin and culture destinations', () => {
  const result = parseTravelIntent(
    '从北京出发，独自旅行2天，去镇远古城和肇兴侗寨，重点规避大雾',
    options
  );

  assert.equal(result.values.origin, '北京');
  assert.equal(result.values.days, 2);
  assert.equal(result.values.travelerType, 'solo');
  assert.equal(result.values.weather, 'fog');
  assert.deepEqual(result.values.stopIds, ['zhenyuan', 'zhaoxing']);
});

test('links a nationwide destination region to the structured planner', () => {
  const result = parseTravelIntent(
    '从成都出发去阿坝玩3天，带父母和孩子，担心下雨，希望去九寨沟',
    options
  );

  assert.equal(result.values.origin, '成都');
  assert.equal(result.values.destinationRegion, '阿坝');
  assert.equal(result.values.days, 3);
  assert.equal(result.values.travelerType, 'family');
  assert.equal(result.values.weather, 'rain');
});
