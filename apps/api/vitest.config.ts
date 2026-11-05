import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const apiRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(apiRoot, "../..");

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(apiRoot, "src"),
            "@config": resolve(apiRoot, "config"),
            "@packages": resolve(repositoryRoot, "packages"),
            "@db": resolve(apiRoot, "prisma/db.ts")
        }
    },
    test: {
        environment: "node",
        include: ["test/**/*.test.ts"],
        setupFiles: ["./test/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            thresholds: {
                lines: 80,
                branches: 80
            }
        }
    }
});
