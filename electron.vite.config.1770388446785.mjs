// electron.vite.config.ts
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "electron-vite";
var __electron_vite_injected_dirname = "C:\\Users\\HiteVision station\\Documents\\LanStart\\LanStartWrite";
var pkg = JSON.parse(readFileSync("package.json", "utf-8"));
var electron_vite_config_default = defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts")
        }
      }
    }
  },
  renderer: {
    root: resolve(__electron_vite_injected_dirname, "src/renderer"),
    plugins: [react()],
    define: {
      "__APP_VERSION__": JSON.stringify(pkg.version)
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss({ config: resolve(__electron_vite_injected_dirname, "src/Tailwind/tailwind.config.cjs") }),
          autoprefixer()
        ]
      }
    },
    server: {
      fs: {
        allow: [resolve(__electron_vite_injected_dirname, "src")]
      }
    },
    build: {
      outDir: resolve(__electron_vite_injected_dirname, "out/renderer")
    }
  }
});
export {
  electron_vite_config_default as default
};
