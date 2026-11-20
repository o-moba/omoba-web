// Build-, startup- and render-time guard for the deployment contour. It refuses
// a configuration that would let one contour reach the other's services, serve
// under the other's host or link to the other's site, with one error that lists
// every problem. production keeps its request-time rules and only refuses
// dev-contour hosts; dev is strict and checks every rule before the first request.
import {
  CONTOURS,
  CONTOUR_VARIABLE,
  contourHostProblem,
  contourName,
  contourServiceOrigin,
  isDevContourHost,
  isLoopbackHost,
  isProductionContourHost,
} from "./contour.mjs";
import { portalConfig } from "./security.mjs";

/** Every URL setting the app reads. Under production none may name a dev-contour host. */
export const URL_VARIABLES = Object.freeze([
  "OMOBA_REGISTRY_URL",
  "OMOBA_STUDIO_URL",
  "OMOBA_PORTAL_ORIGIN",
  "OMOBA_ACCOUNT_API_URL",
  "OMOBA_SITE_URL",
]);

/** @param {string | undefined} raw */
function hostOf(raw) {
  if (raw === undefined || raw === "") return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/**
 * Vercel's system variable names the project's production domain without a
 * scheme (`app.omoba.io`). It tells which project a build runs in, so dev
 * settings on the production project, or a dev project without its switch, are
 * refused even when every OMOBA_* URL looks right. Absent outside Vercel.
 * @param {Record<string, string | undefined>} env
 */
function vercelProductionHost(env) {
  const raw = env.VERCEL_PROJECT_PRODUCTION_URL;
  return raw ? hostOf("https://" + raw) : null;
}

/** @param {unknown} error */
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function contourProblems(env = process.env) {
  let contour;
  try {
    contour = contourName(env);
  } catch (error) {
    return [message(error)];
  }
  const problems = [];
  const project = vercelProductionHost(env);
  if (contour === "production") {
    for (const name of URL_VARIABLES) {
      const host = hostOf(env[name]);
      if (host !== null && isDevContourHost(host))
        problems.push(name + " names the dev-contour host " + host + ", but " + CONTOUR_VARIABLE + " is production (unset means production); set " + CONTOUR_VARIABLE + "=dev");
    }
    if (project !== null && isDevContourHost(project))
      problems.push("VERCEL_PROJECT_PRODUCTION_URL " + project + " is a dev-contour project, but " + CONTOUR_VARIABLE + " is production (unset means production); set " + CONTOUR_VARIABLE + "=dev on that project");
    return problems;
  }
  const allowLocal = env.OMOBA_ALLOW_INSECURE_LOCAL === "1";
  for (const [name, service, label] of /** @type {const} */ ([
    ["OMOBA_REGISTRY_URL", "registry", "Registry"],
    ["OMOBA_STUDIO_URL", "studio", "Studio"],
  ])) {
    try {
      contourServiceOrigin(env[name], contour, service, allowLocal, label);
    } catch (error) {
      problems.push(name + ": " + message(error));
    }
  }
  try {
    portalConfig(env);
  } catch (error) {
    problems.push(message(error));
  }
  // "About the game" links to the dev landing; loopback stays possible for next dev.
  if (env.OMOBA_SITE_URL) {
    let site = null;
    try {
      site = new URL(env.OMOBA_SITE_URL);
    } catch {}
    if (!site) problems.push("OMOBA_SITE_URL is not a URL");
    else if (!isLoopbackHost(site.hostname) && site.origin !== CONTOURS.dev.site)
      problems.push(
        "OMOBA_SITE_URL must be " + CONTOURS.dev.site + " when " + CONTOUR_VARIABLE + "=dev" +
          (isProductionContourHost(site.hostname) ? " (" + site.hostname + " is a production host)" : ""),
      );
  }
  // A hosted dev deployment accepts exactly the dev origins, never loopback doubles.
  if (env.VERCEL === "1" && allowLocal)
    problems.push("OMOBA_ALLOW_INSECURE_LOCAL=1 is refused on Vercel when " + CONTOUR_VARIABLE + "=dev");
  if (project !== null && isProductionContourHost(project))
    problems.push("VERCEL_PROJECT_PRODUCTION_URL " + project + " is a production project, but " + CONTOUR_VARIABLE + "=dev; dev settings belong to the dev project only");
  return problems;
}

/**
 * Throws when the contour is misconfigured; otherwise returns it.
 * @param {Record<string, string | undefined>} [env]
 * @returns {"production" | "dev"}
 */
export function assertContour(env = process.env) {
  const problems = contourProblems(env);
  if (problems.length)
    throw new Error("OMOBA contour misconfigured, refusing to build or serve (fail closed):\n  - " + problems.join("\n  - "));
  return contourName(env);
}

/**
 * Response headers such as X-Robots-Tag are fixed when the app is built, so a
 * build may only run in the contour it was built for.
 * @param {string | undefined} built the contour inlined at build time
 * @param {"production" | "dev"} running
 */
export function assertBuiltContour(built, running) {
  if (built !== running)
    throw new Error(
      "OMOBA contour mismatch, refusing to serve (fail closed): this build was made for " + CONTOUR_VARIABLE + "=" +
        (built || "<unknown>") + " but runs with " + CONTOUR_VARIABLE + "=" + running + "; rebuild with the runtime contour",
    );
}

/**
 * Refuses a request that reached this contour under the other contour's host.
 * @param {"production" | "dev"} contour
 * @param {string | null | undefined} hostname
 */
export function assertContourHost(contour, hostname) {
  const problem = contourHostProblem(contour, hostname);
  if (problem) throw new Error("OMOBA contour mismatch, refusing to serve (fail closed): " + problem);
}
