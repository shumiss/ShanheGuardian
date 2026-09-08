# 开源参考与融合边界

山河守护保持独立代码结构。本轮升级研究了下列开源项目的产品机制、求解思路与质量保障方法，没有直接复制其界面或大段源代码。

## TravelPal

- 仓库：https://github.com/xiaojiune/TravelPal
- 许可证：MIT
- 参考内容：营业时间窗、停留时长、真实道路耗时、可执行日程、VNS/CA 路线求解、方案调整。
- 山河守护实现：在现有 Node.js 多目标优化器中增加 POI 2.0 营业时间、2-opt 局部改良、分钟级时间表和时间窗质量门。

## JourneyPilot

- 仓库：https://github.com/Dreamaker-TA/JourneyPilot
- 许可证：MIT
- 参考内容：行程与证据共用同一交付记录、天气调整面板、质量门、事实来源和失败降级说明。
- 山河守护实现：所有路线、风险、日程、应急资源和情景推演继续绑定同一 `planId`；降雨推演生成独立快照，未经确认不覆盖主计划。

## TourEase

- 仓库：https://github.com/Suhani1234-5/TourEase
- 许可证：MIT
- 参考内容：附近医院、公安机构、游客服务和安全问题处置。
- 山河守护实现：使用高德 POI 2.0 周边搜索返回真实应急资源，并写入游客端和管理端风险证据。

## TOPTW 与旅行智能体评测示例

- TOPTW：https://github.com/miladbarooni/TOPTW （MIT）
- LangChain 示例：https://github.com/langchain-samples/travel-planner-deepagents-workshop （MIT）
- 参考内容：时间窗问题定义、约束验证、轨迹完整性、执行效率和策略对比。
- 山河守护实现：`backend/tests/route-optimizer-benchmark.mjs` 对多种人群、天气、天数和路线策略进行可复现评测。

## 项目差异

上述项目主要解决通用行程生成或旅行管理。山河守护保留自己的核心边界：复杂地形风险、老人儿童与研学人群、天气和客流风险、真实应急资源、景区管理端、安全派单与处置闭环，以及全国能力与贵州本地样板并存的数据策略。
