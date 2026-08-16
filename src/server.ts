import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Import Start Handler dependencies directly
import { createStartHandler, defaultRenderHandler } from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";
import { getRouter } from "./router";

// 1. Intercept the manifest to guarantee serverRoutes is always a valid Array
function getSafeManifest() {
  const manifest = getRouterManifest();
  return {
    ...manifest,
    serverRoutes: Array.isArray(manifest?.serverRoutes) ? manifest.serverRoutes : [],
  };
}

// 2. Construct the Start handler directly, bypassing the buggy virtual server-entry
const startHandler = createStartHandler({
  createRouter: getRouter,
  getRouterManifest: getSafeManifest,
})(defaultRenderHandler);

// Your existing error handling
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // 3. Execute the handler safely
      const response = typeof startHandler === "function" 
        ? await (startHandler as any)(request, env, ctx) 
        : await (startHandler as any).fetch(request, env, ctx);
        
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};