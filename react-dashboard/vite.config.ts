import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: [
        "same-runtime/dist/jsx-dev-runtime",
        "same-runtime/dist/jsx-runtime",
      ],
    },
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
      // Fügen Sie diese Zeile hinzu:
      'process.env': JSON.stringify(env),
      // Oder spezifischer, nur die benötigten Variablen:
      // 'process.env.NODE_ENV': JSON.stringify(mode),
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
  };
});