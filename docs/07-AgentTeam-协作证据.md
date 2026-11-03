# Agent Team 协作证据

本文件记录「基于 Vue 3 的校园自习室预约系统」这套毕业设计在 Agent Team 模式下的协作过程、阶段产物与验收记录。所有数字都可在仓库内找到对应文件复核。

## 一、团队构成

| 角色 | 职责 | 主要产出 |
|---|---|---|
| 需求拆解 Agent | 读题、拆场景、定角色与约束 | `docs/01-需求规格说明书.md` |
| 设计 Agent | 分层设计、模块接口、数据模型 | `docs/02-概要设计.md`、`docs/03-详细设计.md` |
| 编码 Agent | 按分层约定实现领域模块与页面 | `src/domain/*`、`src/views/*` |
| 测试 Agent | 补边界用例、跑全量回归、出覆盖率 | `tests/*.spec.js`、`docs/04-测试报告.md` |
| 评审 Agent | 交叉核对文档与代码、发现问题退回 | 评审记录（见第四节） |
| 本人（答辩人） | 定义验收标准、拍板取舍、最终验收 | 验收清单 |

> 说明：Agent Team 不是「一句话生成全部」，而是每个角色只对一段产物负责，产物之间靠文件交接，最后由人验收。下文每一节的产物路径都可以点开核对。

## 二、阶段交接与产物对照

| 阶段 | 输入 | 产物 | 验收方式 |
|---|---|---|---|
| 1 需求 | 校园自习室现状描述 | 需求规格说明书（角色、场景、约束） | 逐条对照场景，缺项退回 |
| 2 设计 | 需求规格说明书 | 概要设计（分层）、详细设计（模块接口与数据模型） | 检查接口是否覆盖全部约束 |
| 3 编码 | 详细设计 | `src/domain` 六个模块 + 学生端/管理端页面 | 构建通过、页面可点通 |
| 4 测试 | 编码产物 | 6 个测试文件、97 个用例、覆盖率报告 | 全绿 + 边界用例齐备 |
| 5 文档 | 前四阶段产物 | 毕业论文（六章）、测试报告 | 数字与代码一致才通过 |

## 三、真实运行记录

### 3.1 单元测试

命令：`npm test`（Vitest）

```
✓ tests/domain/time.spec.js         (20 tests)
✓ tests/domain/conflict.spec.js     (10 tests)
✓ tests/domain/statistics.spec.js   (12 tests)
✓ tests/domain/reservation.spec.js  (26 tests)
✓ tests/domain/allocation.spec.js   (15 tests)
✓ tests/domain/credit.spec.js       (14 tests)

Test Files  6 passed (6)
     Tests  97 passed (97)
  Duration  830ms
```

完整输出见 `docs/evidence/test-run.log`。

### 3.2 覆盖率

命令：`npm run test:coverage`，原始数据见 `docs/evidence/coverage-summary.json`。

| 模块 | 语句 | 分支 | 函数 |
|---|---|---|---|
| `src/domain/time.js` | 100% | 100% | 94.11% |
| `src/domain/credit.js` | 100% | 97.43% | 100% |
| `src/domain/reservation.js` | 99.15% | 98.46% | 100% |
| `src/domain/allocation.js` | 99.11% | 96% | 100% |
| `src/domain/statistics.js` | 98.91% | 97.67% | 100% |
| `src/domain/conflict.js` | 98.33% | 95% | 100% |
| **合计** | **99.3%** | **97.9%** | **98.14%** |

### 3.3 构建

命令：`npm run build`（Vite）

```
dist/index.html                   0.56 kB │ gzip:  0.40 kB
dist/assets/index-CoWlMSIY.css   21.62 kB │ gzip:  4.84 kB
dist/assets/index-ipYVNEQ7.js   146.06 kB │ gzip: 53.68 kB
✓ built in 598ms
```

完整输出见 `docs/evidence/build.log`。

## 四、协作中的评审与返工

真实发生过的问题与处理，用来证明「交叉评审」这一步不是走过场：

1. **文档数字与代码不一致**：测试报告初稿写「90 个用例」，实际跑出来 97 个。评审 Agent 对照 `vitest` 输出后判定不一致，退回测试报告修改，并同步修正论文第 6 章的数字。
2. **时段边界判断反了**：初版冲突检测把「起止相邻」判为冲突，`conflict.spec.js` 的边界用例失败。编码 Agent 改为半开区间判断后回归通过。
3. **改签失败未回滚**：改签流程先释放原时段再校验新时段，新时段冲突时原预约已被释放。测试用例捕获后补了「先校验后释放」的顺序，并在 `reservation.spec.js` 增加回滚断言。
4. **统计口径不统一**：使用率分子分母取值不同（含候补 vs 不含候补），统计模块与需求文档表述不一致，统一为「不含候补」后更新文档。

## 五、答辩材料

| 文件 | 说明 |
|---|---|
| `docs/01-需求规格说明书.md` | 角色、场景、约束 |
| `docs/02-概要设计.md` | 分层与模块划分 |
| `docs/03-详细设计.md` | 接口、数据模型、时序 |
| `docs/04-测试报告.md` | 用例清单与结果 |
| `docs/05-毕业论文.md` | 六章、一万余字 |
| `docs/06-毕业答辩.pptx` | 13 页答辩演示文稿 |
| `docs/evidence/test-run.log` | 单元测试原始输出 |
| `docs/evidence/build.log` | 构建原始输出 |
| `docs/evidence/coverage-summary.json` | 覆盖率原始数据 |

## 六、结论

这套毕业设计的每一条线（需求、设计、编码、测试、文档）都有独立的产物文件，且产出的数字可以在同一仓库内被复跑验证。Agent Team 的作用是把工作切成可验收的小份并交叉检查，判断与取舍仍然由人来做。
