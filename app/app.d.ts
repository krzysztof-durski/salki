/// <reference types="@cloudflare/workers-types" />
/// <reference path="./cloudflare-env.d.ts" />

import type { AppLoadContext as RRAppLoadContext } from "react-router";

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: CloudflareEnv;
      ctx: ExecutionContext;
    };
  }
}
