# Medical Rule Builder - Frontend

基於 Next.js 14 (Pages Router) + TypeScript + SCSS 的醫療規則建構器前端應用。

## 技術棧

- **框架**: Next.js 14 (Pages Router)
- **語言**: TypeScript
- **樣式**: SCSS Modules
- **視覺化**: Blockly

## 專案結構

```
frontend/
├── components/          # React 元件
│   ├── BlocklyComponent/  # Blockly 視覺化區域
│   ├── ChatContainer/     # AI 聊天容器
│   ├── Header/            # 浮動標題列
│   ├── LeftPanel/         # 左側面板（編輯器 + AI 聊天）
│   ├── RightPanel/        # 右側面板（病人資料 + 變數）
│   └── ScoreCard/         # 分數顯示卡片
├── pages/               # Next.js 頁面路由
│   ├── _app.tsx           # 全域 App 元件
│   ├── _document.tsx      # HTML 文件自訂
│   └── index.tsx          # 首頁
├── styles/              # SCSS 樣式
│   ├── globals.scss       # 全域樣式
│   ├── Home.module.scss   # 首頁樣式
│   └── variables.scss     # SCSS 變數
├── types/               # TypeScript 型別定義
│   └── index.ts
├── utils/               # 工具函數
│   └── blocklyGenerator.ts
└── public/              # 靜態資源
```

## 開發指令

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 構建生產版本
npm run build

# 啟動生產伺服器
npm start

# 程式碼檢查
npm run lint
```

## 後端 API

前端連接到 `http://localhost:5000` 的後端服務，使用以下 API：

- `POST /parse` - 解析規則文本
- `POST /calculate` - 計算分數
- `POST /chat` - AI 聊天生成規則
