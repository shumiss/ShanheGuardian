import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { handleRequest } from '../server.js';

const modes = ['safety-first', 'balanced', 'experience-first'];
const scenarios = [
  { id: 'family-rain-2d', travelerType: 'family', preference: 'safe', weather: 'rain', days: 2, intensity: 35 },
  { id: 'family-clear-3d', travelerType: 'family', preference: 'nature', weather: 'clear', days: 3, intensity: 50 },
  { id: 'senior-fog-2d', travelerType: 'senior', preference: 'lowload', weather: 'fog', days: 2, intensity: 28 },
  { id: 'senior-clear-3d', travelerType: 'senior', preference: 'safe', weather: 'clear', days: 3, intensity: 32 },
  { id: 'study-clear-3d', travelerType: 'study', preference: 'culture', weather: 'clear', days: 3, intensity: 55 },
  { id: 'study-rain-2d', travelerType: 'study', preference: 'safe', weather: 'rain', days: 2, intensity: 45 },
  { id: 'nature-clear-2d', travelerType: 'wellness', preference: 'nature', weather: 'clear', days: 2, intensity: 68 },
  { id: 'nature-rain-3d', travelerType: 'wellness', preference: 'nature', weather: 'rain', days: 3, intensity: 62 },
  { id: 'balanced-clear-4d', travelerType: 'wellness', preference: 'culture', weather: 'clear', days: 4, intensity: 52 },
  { id: 'balanced-heat-3d', travelerType: 'family', preference: 'safe', weather: 'heat', days: 3, intensity: 40 },
  { id: 'lowload-rain-4d', travelerType: 'senior', preference: 'lowload', weather: 'rain', days: 4, intensity: 25 },
  { id: 'explore-fog-3d', travelerType: 'wellness', preference: 'nature', weather: 'fog', days: 3, intensity: 78 },
];

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

try {
  const records = [];
  for (const scenario of scenarios) {
    for (const routeMode of modes) {
      const request = {
        request: `从贵阳出发去贵州，${scenario.id}，生成可执行安全行程`,
        origin: '贵阳',
        destinationRegion: '贵州',
        startDate: '2026-09-15',
        ...scenario,
        routeMode,
        includeRoadRoute: false,
      };
      const startedAt = performance.now();
      const response = await fetch(`${base}/api/tourism/route-plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error(`benchmark_request_failed_${response.status}`);
      const route = await response.json();
      records.push({
        scenarioId: scenario.id,
        routeMode,
        latencyMs: Math.round(performance.now() - startedAt),
        objectiveScore: route.optimization.objectiveScore,
        averageRisk: route.metrics.averageRisk,
        serviceCoverage: route.metrics.serviceCoverage,
        constraintsPassed: route.optimization.constraintsPassed,
        constraintsTotal: route.optimization.constraintsTotal,
        schedulePassed: route.executableSchedule.qualityGate.passed,
        scheduleViolations: route.executableSchedule.qualityGate.violations,
        traceSteps: route.agentTrace.steps.length,
        photoCoverage: route.optimization.constraints.find(item => item.id === 'photo-evidence')?.value || '0/0',
        twoOptImprovementPercent: route.optimization.solver.improvementPercent,
        routeOrder: route.routeOrder,
      });
    }
  }

  const groups = scenarios.map(scenario => records.filter(record => record.scenarioId === scenario.id));
  const constraintPasses = records.filter(record => record.constraintsPassed === record.constraintsTotal).length;
  const schedulePasses = records.filter(record => record.schedulePassed).length;
  const tracePasses = records.filter(record => record.traceSteps >= 8).length;
  const diverseGroups = groups.filter(group => new Set(group.map(record => record.routeOrder.join('|'))).size >= 2).length;
  const latencies = records.map(record => record.latencyMs);
  const result = {
    generatedAt: new Date().toISOString(),
    sampleRegion: '贵州',
    scenarioCount: scenarios.length,
    requestCount: records.length,
    strategyCount: modes.length,
    metrics: {
      constraintPassRate: Number((constraintPasses / records.length * 100).toFixed(1)),
      scheduleFeasibilityRate: Number((schedulePasses / records.length * 100).toFixed(1)),
      strategyDiversityRate: Number((diverseGroups / groups.length * 100).toFixed(1)),
      completeTraceRate: Number((tracePasses / records.length * 100).toFixed(1)),
      averageTwoOptImprovementPercent: Number((records.reduce((sum, record) => sum + record.twoOptImprovementPercent, 0) / records.length).toFixed(1)),
      latencyP50Ms: percentile(latencies, 0.5),
      latencyP95Ms: percentile(latencies, 0.95),
    },
    records,
  };
  const outputDir = join(process.cwd(), '..', 'work');
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'route-benchmark-latest.json');
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, ...result.metrics }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
