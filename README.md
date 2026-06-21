# Plot3D — 科研数据可视化工具

Plot3D 是一款面向科研工作者的交互式数据可视化应用，支持 2D/3D 图表创建、数据编辑、标注与导出，适合论文配图与数据探索。

## 功能特性

### 图表类型

| 2D 图表 | 3D 图表 |
|---------|---------|
| 折线图 (Line) | 曲面图 (Surface) |
| 散点图 (Scatter) | 3D 散点 (Scatter 3D) |
| 柱状图 (Bar) | 等高线 (Contour 3D) |
| 面积图 (Area) | 3D 柱状 (Bar 3D) |
| 饼图 (Pie) | |
| 极坐标图 (Polar) | |

### 数据处理

- **导入**：CSV、Excel (.xlsx)
- **编辑**：单元格直接编辑、添加/删除行列、列类型设置 (X/Y/Z/label/error)
- **变换**：数学函数 (log, sqrt, abs, exp, 1/x)、三角函数、排序、归一化、计算列
- **生成**：正弦波、Sinc 曲面、球体、随机数据等示例数据集

### 图表配置

- 坐标轴：标签、范围、对数刻度、科学计数法、网格线
- 多图层：独立数据集映射、颜色/线型/点型配置、双 Y 轴
- 误差棒：支持对称/非对称误差列
- 颜色映射：jet、viridis、hot、coolwarm、parula、plasma
- 图例：显示/隐藏、位置调整

### 标注系统

- 文本标注、LaTeX 公式 (KaTeX)、箭头、矩形
- 标注可拖拽移动，支持百分比/数据坐标模式

### 3D 场景

- 交互式旋转/缩放/平移 (OrbitControls)
- 光照角度与强度调节
- 透明度控制
- 坐标轴与色条显示
- Bloom 后处理效果

### 导出

- PNG、SVG、PDF
- 分辨率倍率 (1x/2x/4x)
- 背景透明/白色/跟随主题

### 其他

- 撤销/重做 (Ctrl+Z / Ctrl+Y)，最多 50 步历史
- 深色/浅色主题切换
- 中/英双语界面

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 (HMR) |
| `npm run build` | TypeScript 编译 + Vite 构建 |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | ESLint 代码检查 |
| `npm run check` | TypeScript 类型检查 |

## 技术栈

- **框架**：React 18 + TypeScript
- **构建**：Vite 6
- **2D 图表**：Plotly.js (懒加载)
- **3D 渲染**：Three.js + React Three Fiber + Drei
- **状态管理**：Zustand v5
- **样式**：Tailwind CSS 3 + CSS 变量
- **国际化**：i18next + react-i18next
- **数据处理**：PapaParse (CSV)、SheetJS (Excel)
- **导出**：jsPDF (PDF)、html-to-image (光栅化)
- **LaTeX**：KaTeX

## 项目结构

```
src/
├── components/          # UI 组件
│   ├── ribbon/          # Ribbon 工具栏标签页
│   └── scene3d/         # 3D 场景子组件
├── pages/               # 页面组件
│   └── Workspace.tsx    # 主工作区
├── store/               # Zustand 状态管理
│   ├── chartStore.ts    # 图表配置 + 撤销/重做
│   ├── datasetStore.ts  # 数据集管理
│   ├── scene3DStore.ts  # 3D 场景配置
│   └── uiStore.ts       # 主题与语言
├── utils/               # 工具函数
│   ├── chart.ts         # 图表类型判断
│   ├── colormaps.ts     # 颜色映射
│   ├── sampleData.ts    # 示例数据生成
│   ├── annotations.tsx  # 标注工具
│   └── latex.ts         # LaTeX 渲染
├── i18n/                # 国际化
│   ├── en.json          # 英文
│   ├── zh.json          # 中文
│   └── index.ts         # i18next 配置
├── types.ts             # TypeScript 类型定义
├── App.tsx              # 应用入口
└── main.tsx             # 渲染入口
```

## License

MIT
