# STATE · 当前状态快照

> **本文件是所有 agent session 的第一入口**（30 秒重入）。规则：≤50 行；每次合并 PR 后由
> `/handoff-sync` 技能（或手动）更新；只写"现在在哪 + 下一步 + 阻塞"，历史和决策依据一律
> 指向 HANDOFF/notes，不在这里复述。

## 当前位置（2026-10-02 · HANDOFF v2.0）

- **Milestone**：M1 收尾阶段。Phase 0–5.5 全部 ✅ Done。
- **2026-10-02 合入**：PR #36（`@types/react` + 修 2 个 tsc 错误 + GitHub Actions CI：typecheck / lint / format / test / build）、PR #38（侧栏「粘贴 JD」入口，D4 第二层兜底）、PR #40（后端代理雏形，见文末）。
- **Phase 4.6**：数据层 ✅（PR #31）；最简文字 banner 已随 PR #34 占位；完整视觉 2f/2g 延后 M3。
- **反通胀 smoke 已自动化**：`src/core/unionInflation.smoke.test.ts`。**实测发现缺口**：激活"什么都会"简历时分数反超专精简历（71.3 → 78.7），breakdown 也把它排第一，详见 `doc/phase-4-6-notes.md` §4.1。

## 下一步（重入锚点 · 按优先级）

1. **反通胀缺口怎么修，等用户拍板**（选项见 phase-4-6-notes §4.1 实测记录）。拍板后：改 `scoreSkillEvidence` / `computeResumeBreakdown`，bump `scoringVersion` + `rubricVersion`，把 smoke 里两条 `it.fails` 改回 `it`。
2. **待补欠账**：`doc/phase-5-5-notes.md` §4 手动 smoke 清单四项未勾（需真实 Gemini key，Codex 本地跑）。
3. M2 已并行启动：后端代理（Phase 6.4，PR #40 已合，见文末）与 Track C 浏览器扩展（Phase 6.1–6.3）各由独立线程推进；M1 宣告 Done 只差第 1 条。

## 阻塞 / 待用户拍板

- 反通胀缺口修法（见上）。4.6 完整视觉（2f/2g）按既定决策等 M3 + Claude Design，无需现在拍板。

## 快速读文指引（重复接手用）

- 状态类变更集中在：HANDOFF §2（状态）/ §5 Phase 4.6 & 5.5 / §11（接力）——v2.0 已同步到 PR #34 后事实。
- 首次接手仍按 `CLAUDE.md` §0 的必读链全量读；重复接手读完本文件 + 上面列的变更章节即可。
- 项目技能（任何 Claude session 可用）：`/brief-writer` `/adversarial-prompt-review` `/iron-rules-review` `/handoff-sync`（见 `.claude/skills/`）。

## 冬眠前必做（sprint 结束仪式）

结束一轮冲刺前，最后一个 commit 必须更新本文件的"下一步"为**具体到第一个动作**的描述
（坏例子："继续 Phase 6"；好例子："给 Codex 写 Phase 6 brief，先定 MV3 manifest 权限清单"）。

---
*STATE v1.1 · 2026-10-02 · 同步 PR #36 / #38 / #40 + 反通胀 smoke 实测*

## 后端代理（Phase 6.4 · 并行线程 · 2026-10-02）

- 代理雏形在 `server/`（`contract.ts` 契约 / `handler.ts` 处理 / `worker.ts` Cloudflare 入口 /
  `vitePlugin.ts` 本地同端口）；前端经 `services/llmClient.ts` 走 `/api/generate`，Key 已不在浏览器。
- 接口契约 v1 与扩展对接要点见 `doc/backend-proxy.md` §2；扩展线程按它对接。
- 下一步：补 `wrangler.toml` 并真部署一次 Worker；上线前加限流（见 `doc/backend-proxy.md` §5）。

## 代理部署准备（并行线程 · 2026-10-02）

- `wrangler.jsonc`：一个 Worker 托管网页 `dist/` 和 `/api/*`（同源）；按 IP 限流 20 次 / 分钟，超限 429 `RATE_LIMITED`。
- `npm run deploy` / `npm run deploy:dry-run`；密钥只走 `wrangler secret put`。
- 下一步（Flora 亲手）：按 `doc/backend-proxy.md` §7.2 登录 wrangler → 部署 → 设两个 secret → §7.3 验证。
