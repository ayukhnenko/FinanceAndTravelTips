import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

export const runtime = "nodejs";

const PROJECT_ROOT = process.cwd();
const API_ROOT = path.join(PROJECT_ROOT, "app", "api");

type EndpointDescription = {
  path: string;
  methods: string[];
  queryParams: string[];
  bodyFields: string[];
  knownErrorStatuses: number[];
  sourceFile: string;
};

async function listRouteFiles(dir: string): Promise<string[]> {
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

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function collectMatches(content: string, regex: RegExp, groupIndex = 1): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    if (match[groupIndex]) {
      out.push(match[groupIndex]);
    }
    match = regex.exec(content);
  }
  return uniq(out);
}

function extractBodyFields(content: string): string[] {
  const fields = new Set<string>();
  const typedBody = content.match(/let\s+body\s*:\s*\{([\s\S]*?)\}/m);
  if (typedBody) {
    const fieldRegex = /([A-Za-z_]\w*)\??\s*:/g;
    let keyMatch: RegExpExecArray | null = fieldRegex.exec(typedBody[1]);
    while (keyMatch) {
      fields.add(keyMatch[1]);
      keyMatch = fieldRegex.exec(typedBody[1]);
    }
  }
  const bodyRegex = /body\.([A-Za-z_]\w*)/g;
  let match: RegExpExecArray | null = bodyRegex.exec(content);
  while (match) {
    fields.add(match[1]);
    match = bodyRegex.exec(content);
  }
  return Array.from(fields);
}

function endpointPathFromFile(filePath: string): string {
  const relativeDir = path.relative(API_ROOT, path.dirname(filePath));
  const routePart = relativeDir === "" ? "" : `/${relativeDir.replaceAll(path.sep, "/")}`;
  return `/api${routePart}`;
}

async function buildApiDescription() {
  const routeFiles = await listRouteFiles(API_ROOT);
  const endpoints: EndpointDescription[] = await Promise.all(
    routeFiles
      .filter((filePath) => !filePath.endsWith(`${path.sep}mcp${path.sep}route.ts`))
      .map(async (filePath) => {
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

function buildSummary(apiDescription: {
  project: string;
  generatedAt: string;
  endpointCount: number;
  endpoints: EndpointDescription[];
}): string {
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

function createServer() {
  const server = new McpServer({
    name: "loan-payment-api-docs-http",
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
      const endpoints = pathFilter
        ? apiDescription.endpoints.filter((ep) => ep.path.includes(pathFilter))
        : apiDescription.endpoints;
      const filtered = {
        ...apiDescription,
        endpoints,
        endpointCount: endpoints.length,
      };

      if (format === "json") {
        const text = JSON.stringify(filtered, null, 2);
        return { content: [{ type: "text", text }] };
      }

      return {
        content: [{ type: "text", text: buildSummary(filtered) }],
      };
    }
  );

  return server;
}

export async function POST(request: Request): Promise<Response> {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
    await transport.close();
  }
}

function methodNotAllowed() {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    },
    { status: 405 }
  );
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}
