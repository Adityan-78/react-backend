import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tells Vite (the tool that runs our app) that we are using React.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 }, // the chart library is large; that's expected
});
