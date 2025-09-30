### 1. **載入優化**

**目的**：加快首屏渲染時間、減少不必要的資源消耗

**做法**：

- **動態導入** － 避免一次性載入整包 JS

  - 使用 Vue3 的動態 import 來做路由或大型套件的 lazy load：

    ```
    component: () => import("./views/HomeView.vue")
    ```

- **打包壓縮** － 減少 bundle 大小

  - 代碼分割（Code Splitting）
    <br>

    ```
    export default defineConfig({
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['vue', 'vue-router', 'pinia']
            },
          },
        },
      },
    });
    ```

  - Vite 的內建壓縮 (Rollup)，搭配 `terser` 進行 JS Minify：

    ```
    export default defineConfig({
      build: {
        minify: "terser", // 使用 terser 進行更徹底的代碼壓縮
        terserOptions: {
          compress: {
            drop_console: true, // 移除 console 語句
            pure_funcs: ["console.log"], // 移除指定的函數調用
            },
          },
        },
      });
    ```

  - CSS Minify：

    ```
    export default defineConfig({
      build: {
        cssMinify: 'lightningcss',
      },
    });
    ```

  - gzip 壓縮，使用 `vite-plugin-compression` 減少整體靜態資源的大小

---

### 2. **SEO 優化**

**目的**：處理 SPA 的 SEO 低下問題

**做法**：

- **SSR 與 SSG** － 預渲染，有利於搜尋引擎拿取完整 HTML

  - 使用 `vite-plugin-ssr`：

    ```
    import { ssr } from "vite-plugin-ssr/plugin";

    export default {
      plugins: [ssr({ prerender: true })],
    };
    ```

  - `VitePress` 的 SSG

  - 使用 `Nuxt 3`（若允許轉換框架）

- **Meta 與 Head** － 動態更新 `<head>` 資訊

  - `Unhead`

    ```
    <script lang="ts" setup>
    import { Head } from '@unhead/vue/components'
    </script>

    <template>
      <Head>
        <title>My awesome site</title>
        <meta name="description" content="My awesome site description">
      </Head>
    </template>
    ```

- **網站結構索引** － 使搜尋引擎更快、更完整地抓取頁面

  - `sitemap.xml`、`robots.txt`：

    ```
    import Sitemap from 'vite-plugin-sitemap'

    export default {
      plugins: [
        Vue(),
        Sitemap({ hostname: 'https://example.com' }),
      ],
    }
    ```

---

### 3. **Code Refactor 如何進行**

**流程**：引入規範 ➜ 整理結構 ➜ 自動化測試／部署

**做法**：

- **引入規範**

  - 程式碼品質工具

    - 使用 `ESLint + Prettier` 保持一致的程式風格。

    - 用 `TypeScript` 讓型別更安全。

- **整理結構**

  - 程式碼模組化 － 結構清晰，降低耦合度，維護成本低

    - 依功能拆分不同的 components（`/auth`, `/dashboard`, `/product`）

  - 共用元件與邏輯抽取 － 減少重複程式碼，提高一致性

    - 把 UI（如 Button、Card）抽成共用元件

    - 整理可重複邏輯（例如 API 呼叫）

  - 狀態管理 － 跨組件共享與應用

    - `Pinia`

      ```
      import { defineStore } from 'pinia'

      export const useCounterStore = defineStore('counter', {
        state: () => {
          return { count: 0 }
        },
        actions: {
          increment() {
            this.count++
          },
        },
      })
      ```

- **自動化測試／部署**

  - 測試

    - 單元測試：使用 `Vitest`，與 Vite 無縫整合

    - 組件與端對端測試：`Cypress`

    - Commit：配合 `Husky` + `lint-staged` 在 commit 前自動跑檢查。

  - 部署

    - CI/CD pipeline：自動化 lint、test、build

    - 部署時配合 Docker / Vercel / Netlify
