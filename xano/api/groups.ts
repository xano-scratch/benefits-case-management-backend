import { apiGroup } from "@xanots/sdk";

// One API group per resource. The `canonical` slug is PINNED so the public path
// (`/api:<canonical>/<name>`) is stable and `getPath()` resolves in the browser
// bundle from the source alone, without a lock file.
export const authApi = apiGroup({ name: "auth", canonical: "auth" });
export const casesApi = apiGroup({ name: "cases", canonical: "cases" });
export const verificationsApi = apiGroup({ name: "verifications", canonical: "verifications" });
export const determinationsApi = apiGroup({ name: "determinations", canonical: "determinations" });
export const appealsApi = apiGroup({ name: "appeals", canonical: "appeals" });
export const seedApi = apiGroup({ name: "seed", canonical: "seed" });
