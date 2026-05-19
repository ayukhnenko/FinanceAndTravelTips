import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PROJECT_ROOT = process.cwd();
const API_ROOT = path.join(PROJECT_ROOT, "app", "api");

async function listRouteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listRouteFiles(fullPath);
      }
      if (entry.isFile() && entry.name === "route.ts") {
        return [fullPath];
      }
      return [];
    })
  );
  return nested.flat();
}

function uniq(values) {
  return [...new Set(values)];
}

function collectMatches(content, regex, groupIndex = 1) {
  const out = [];
  for (const match of content.matchAll(regex)) {
    if (match[groupIndex]) {
      out.push(match[groupIndex]);
    }
  }
  return uniq(out);
}

function extractBodyFields(content) {
  const fields = new Set();
  const typedBody = content.match(/let\s+body\s*:\s*\{([\s\S]*?)\}/m);
  if (typedBody) {
    for (const keyMatch of typedBody[1].matchAll(/([A-Za-z_]\w*)\??\s*:/g)) {
      fields.add(keyMatch[1]);
    }
  }
  for (const match of content.matchAll(/body\.([A-Za-z_]\w*)/g)) {
    fields.add(match[1]);
  }
  return [...fields];
}

function endpointPathFromFile(filePath) {
  const relativeDir = path.relative(API_ROOT, path.dirname(filePath));
  const routePart = relativeDir === "" ? "" : `/${relativeDir.replaceAll(path.sep, "/")}`;
  return `/api${routePart}`;
}

async function buildApiDescription() {
  const routeFiles = await listRouteFiles(API_ROOT);
  const endpoints = await Promise.all(
    routeFiles.map(async (filePath) => {
      const content = await readFile(filePath, "utf8");
      const methods = collectMatches(
        content,
        /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g
      );
      const queryParams = collectMatches(content, /searchParams\.get\("([^"]+)"\)/g);
      const bodyFields = extractBodyFields(content);
      const statuses = collectMatches(content, /status:\s*(\d{3})/g);

      return {
        path: endpointPathFromFile(filePath),
        methods,
        queryParams,
        bodyFields,
        knownErrorStatuses: statuses.map(Number).sort((a, b) => a - b),
        sourceFile: path.relative(PROJECT_ROOT, filePath).replaceAll(path.sep, "/"),
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    project: path.basename(PROJECT_ROOT),
    endpointCount: endpoints.length,
    endpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function buildSummary(apiDescription) {
  const lines = [
    `Project: ${apiDescription.project}`,
    `Generated at: ${apiDescription.generatedAt}`,
    `Endpoints: ${apiDescription.endpointCount}`,
    "",
  ];

  for (const endpoint of apiDescription.endpoints) {
    const methods = endpoint.methods.length ? endpoint.methods.join(", ") : "UNKNOWN";
    const query = endpoint.queryParams.length
      ? `query: ${endpoint.queryParams.join(", ")}`
      : "query: none";
    const body = endpoint.bodyFields.length
      ? `body: ${endpoint.bodyFields.join(", ")}`
      : "body: none";
    lines.push(`- ${methods} ${endpoint.path}`);
    lines.push(`  ${query}; ${body}`);
  }

  return lines.join("\n");
}

const server = new McpServer({
  name: "loan-payment-api-docs",
  version: "1.0.0",
});

server.registerTool(
  "get_api_description",
  {
    description:
      "Returns up-to-date API documentation derived from app/api route files.",
    inputSchema: {
      format: z.enum(["summary", "json"]).optional().default("summary"),
      pathFilter: z
        .string()
        .optional()
        .describe("Optional substring filter for endpoint path, e.g. '/auth'"),
    },
  },
  async ({ format = "summary", pathFilter }) => {
    const apiDescription = await buildApiDescription();
    const filtered = pathFilter
      ? {
          ...apiDescription,
          endpoints: apiDescription.endpoints.filter((ep) => ep.path.includes(pathFilter)),
          endpointCount: apiDescription.endpoints.filter((ep) => ep.path.includes(pathFilter))
            .length,
        }
      : apiDescription;

    if (format === "json") {
      const text = JSON.stringify(filtered, null, 2);
      return {
        content: [{ type: "text", text }],
      };
    }

    return {
      content: [{ type: "text", text: buildSummary(filtered) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
