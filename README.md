# plot3d.xyz — 科研数据可视化工具

plot3d.xyz 是一款面向科研工作者的交互式数据可视化应用，支持 2D/3D 图表创建、数据编辑、标注与导出，适合论文配图与数据探索。

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
- 颜色映射：jet、viridis、hot、coolwarm、parula、plasma、cividis（色盲友好）、inferno、magma、turbo、batlow（色盲友好）
- 图例：显示/隐藏、位置调整

### 标注系统

- 文本标注、LaTeX 公式 (KaTeX)、箭头、矩形
- 标注可拖拽移动，支持百分比/数据坐标模式

### 3D 场景

- 交互式旋转/缩放/平移
- 坐标轴标签、范围、网格线统一配置
- 专业颜色映射与色条
- 矢量导出 (SVG/PDF)

### 曲线拟合

- 线性回归、多项式回归 (1-6 阶)、指数拟合
- 拟合统计量：R²、RMSE、MAE

### 导出

- PNG、SVG、PDF、EPS、TIFF (300 DPI)
- 分辨率倍率 (1x/2x/4x)
- 背景透明/白色/跟随主题
- 图表右键可直接导出或复制到剪贴板

### 项目文件

- `.plot3d` 工程文件格式，保存完整状态（数据集、图表配置、主题、语言）
- Ctrl+S 快速保存，文件菜单打开项目

### 其他

- 撤销/重做 (Ctrl+Z / Ctrl+Y)，最多 50 步历史
- 深色/浅色主题切换
- 中/英双语界面
- 自定义右键上下文菜单（数据表格、图表画布、图层面板）

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
| `npm run check` | TypeScript 类型检查 (strict 模式) |

## 技术栈

- **框架**：React 18 + TypeScript (strict 模式)
- **构建**：Vite 6
- **图表渲染**：Plotly.js（2D + 3D 统一引擎，懒加载）
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
│   ├── ChartView.tsx    # 统一 2D/3D 图表渲染
│   ├── ConfigPanel.tsx  # 右侧配置面板
│   ├── ContextMenu.tsx  # 自定义右键菜单
│   ├── DataTable.tsx    # 数据表格
│   └── LayerPanel.tsx   # 图层管理
├── pages/               # 页面组件
│   └── Workspace.tsx    # 主工作区
├── store/               # Zustand 状态管理
│   ├── chartStore.ts    # 图表配置
│   ├── datasetStore.ts  # 数据集管理
│   ├── historyStore.ts  # 撤销/重做历史
│   └── uiStore.ts       # 主题与语言
├── utils/               # 工具函数
│   ├── chart.ts         # 图表类型判断
│   ├── colormaps.ts     # 颜色映射（含色盲友好）
│   ├── curveFitting.ts  # 曲线拟合算法
│   ├── projectFile.ts   # .plot3d 项目文件
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

[GNU General Public License v3.0](LICENSE)
