import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import {
  CONTOURS, CONTOUR_VARIABLE, DEFAULT_CONTOUR, contourHostProblem, contourName, isDevContourHost,
  isProductionContourHost, requestHostname, robotsTxt,
} from '../src/lib/contour.mjs';
import { assertBuiltContour, assertContour, assertContourHost, contourProblems } from '../src/lib/contour-guard.mjs';
import { ekzaConfig, studioOrigin } from '../src/lib/ekza-link.mjs';
import { portalConfig } from '../src/lib/security.mjs';
import { contourSiteUrl } from '../src/lib/navigation.mjs';
import { DEV_LOCALE_COOKIE, LOCALE_COOKIE, localeCookie, localeCookieName, storedLocale } from '../src/lib/locale.mjs';

// Written out by hand, independent of the module under test.
const PROD = { registry: 'https://registry.ekza.io', studio: 'https://studio.ekza.io', portal: 'https://app.omoba.io', site: 'https://omoba.io' };
const DEV = { registry: 'https://registry.dev.ekza.io', studio: 'https://studio.dev.ekza.io', portal: 'https://app.dev.omoba.io', site: 'https://dev.omoba.io' };
const ORIGINS = { production: PROD, dev: DEV };
const other = (contour) => (contour === 'production' ? 'dev' : 'production');
// The production project's environment today (docs/vercel.md) and the dev project's.
const PROD_PROJECT = { NODE_ENV: 'production', OMOBA_PORTAL_ORIGIN: PROD.portal, OMOBA_ACCOUNT_MODE: 'disabled' };
const DEV_PROJECT = {
  NODE_ENV: 'production', OMOBA_CONTOUR: 'dev', OMOBA_PORTAL_ORIGIN: DEV.portal, OMOBA_ACCOUNT_MODE: 'disabled',
  OMOBA_REGISTRY_URL: DEV.registry, OMOBA_STUDIO_URL: DEV.studio, OMOBA_SITE_URL: DEV.site,
};

// Every origin a setting could plausibly hold, labelled with the contour it belongs to.
const CANDIDATES = [
  ...Object.values(PROD).map((value) => ({ value, zone: 'production' })),
  { value: 'https://api.omoba.io', zone: 'production' },
  { value: 'https://www.omoba.io', zone: 'production' },
  { value: 'https://app-dev.omoba.io', zone: 'production' },
  ...Object.values(DEV).map((value) => ({ value, zone: 'dev' })),
  { value: 'https://x.dev.ekza.io', zone: 'dev' },
  { value: 'https://dev.ekza.io', zone: 'dev' },
  { value: 'https://players.example', zone: 'neutral' },
  { value: 'https://dev.omoba.io.evil.example', zone: 'neutral' },
  { value: 'https://omoba-app-dev.vercel.app', zone: 'neutral' },
  { value: 'http://127.0.0.1:8018', zone: 'loopback' },
  { value: 'http://localhost:5188', zone: 'loopback' },
  { value: 'http://[::1]:3010', zone: 'loopback' },
];
const FOREIGN = { production: /is a dev-contour origin, but OMOBA_CONTOUR is production/, dev: /is a production origin, but OMOBA_CONTOUR=dev/ };

test('the contour map names exactly the hosted origins of each contour', () => {
  assert.equal(CONTOUR_VARIABLE, 'OMOBA_CONTOUR');
  assert.equal(DEFAULT_CONTOUR, 'production');
  assert.deepEqual(Object.keys(CONTOURS), ['production', 'dev']);
  assert.deepEqual({ ...CONTOURS.production }, PROD);
  assert.deepEqual({ ...CONTOURS.dev }, DEV);
  assert.ok(Object.isFrozen(CONTOURS) && Object.isFrozen(CONTOURS.production) && Object.isFrozen(CONTOURS.dev));
});

test('the switch defaults to production and accepts nothing but production or dev', () => {
  assert.equal(contourName({}), 'production');
  assert.equal(contourName({ OMOBA_CONTOUR: '' }), 'production');
  assert.equal(contourName({ OMOBA_CONTOUR: 'production' }), 'production');
  assert.equal(contourName({ OMOBA_CONTOUR: 'dev' }), 'dev');
  for (const value of ['prod', 'Production', 'PRODUCTION', 'development', 'Dev', 'DEV', ' dev', 'dev\n', 'staging', 'preview', '0', 'true'])
    assert.throws(() => contourName({ OMOBA_CONTOUR: value }), /OMOBA_CONTOUR must be "production" or "dev"/, JSON.stringify(value));
  // The earlier draft name is not an alias: it is simply ignored.
  assert.equal(contourName({ OMOBA_EKZA_CONTOUR: 'dev' }), 'production');
});

test('hosts are classified by contour; lookalikes belong to neither', () => {
  for (const { value, zone } of CANDIDATES) {
    const host = new URL(value).hostname;
    assert.equal(isDevContourHost(host), zone === 'dev', value);
    assert.equal(isProductionContourHost(host), zone === 'production', value);
  }
  for (const host of ['APP.DEV.OMOBA.IO', 'app.dev.omoba.io.']) assert.equal(isDevContourHost(host), true, host);
  for (const host of ['APP.OMOBA.IO', 'omoba.io.']) assert.equal(isProductionContourHost(host), true, host);
  for (const host of ['devomoba.io', 'omoba.io.evil.example', 'notomoba.io', '', null, undefined, 42]) {
    assert.equal(isDevContourHost(host), false, String(host));
    assert.equal(isProductionContourHost(host), false, String(host));
  }
});

/** Oracle for Registry and Studio: the contour's own origin, or loopback with the local flag. */
function expectService(contour, service, candidate, allowLocal) {
  if (candidate.value === ORIGINS[contour][service]) return candidate.value;
  if (candidate.zone === 'loopback' && allowLocal) return new URL(candidate.value).origin;
  return candidate.zone === other(contour) ? FOREIGN[contour] : /URL must be https:\/\//;
}

test('Registry and Studio accept exactly their contour origin, in every combination', () => {
  let checked = 0;
  for (const contour of ['production', 'dev'])
    for (const service of ['registry', 'studio'])
      for (const candidate of CANDIDATES)
        for (const allowLocal of [false, true]) {
          const variable = service === 'registry' ? 'OMOBA_REGISTRY_URL' : 'OMOBA_STUDIO_URL';
          const env = { OMOBA_CONTOUR: contour, [variable]: candidate.value, ...(allowLocal ? { OMOBA_ALLOW_INSECURE_LOCAL: '1' } : {}) };
          const label = `${contour} ${variable}=${candidate.value} local=${allowLocal}`;
          const expected = expectService(contour, service, candidate, allowLocal);
          if (typeof expected === 'string') {
            assert.equal(ekzaConfig(env)[service], expected, label);
            if (service === 'studio') assert.equal(studioOrigin(env), expected, label);
          } else {
            assert.throws(() => ekzaConfig(env), expected, label);
            if (service === 'studio')
              // production keeps its rule (link the production Studio) unless the value is
              // the dev contour's; dev hides the links. A link never crosses contours.
              assert.equal(studioOrigin(env), contour === 'production' && candidate.zone !== 'dev' ? PROD.studio : null, label);
          }
          checked++;
        }
  assert.equal(checked, 2 * 2 * CANDIDATES.length * 2);
});

test('defaults follow the contour; malformed overrides are refused in both', () => {
  assert.deepEqual(ekzaConfig({}), { registry: PROD.registry, studio: PROD.studio });
  assert.deepEqual(ekzaConfig({ OMOBA_CONTOUR: 'production' }), { registry: PROD.registry, studio: PROD.studio });
  assert.deepEqual(ekzaConfig({ OMOBA_CONTOUR: 'dev' }), { registry: DEV.registry, studio: DEV.studio });
  assert.deepEqual(ekzaConfig({ OMOBA_CONTOUR: 'dev', OMOBA_REGISTRY_URL: '', OMOBA_STUDIO_URL: '' }), { registry: DEV.registry, studio: DEV.studio });
  assert.equal(studioOrigin({ OMOBA_CONTOUR: 'dev' }), DEV.studio);
  for (const contour of ['production', 'dev'])
    for (const [value, pattern] of [
      [ORIGINS[contour].registry + '/', null], [ORIGINS[contour].registry + '/v2', /bare origin/], [ORIGINS[contour].registry + '/?x=1', /bare origin/],
      ['https://u:p@' + new URL(ORIGINS[contour].registry).host, /bare origin/], ['not a url', /Invalid Registry URL/],
      [ORIGINS[contour].registry.replace('https:', 'http:'), /URL must be https:\/\//], ['ftp://127.0.0.1', /URL must be/],
    ]) {
      const env = { OMOBA_CONTOUR: contour, OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_REGISTRY_URL: value };
      if (pattern === null) assert.equal(ekzaConfig(env).registry, ORIGINS[contour].registry, value);
      else assert.throws(() => ekzaConfig(env), pattern, `${contour} ${value}`);
    }
  // A wrong Registry override does not hide the Studio links (unchanged rule).
  assert.equal(studioOrigin({ OMOBA_CONTOUR: 'dev', OMOBA_REGISTRY_URL: PROD.registry }), DEV.studio);
});

test('an unknown contour gives no services, no Studio links, no portal and no site', () => {
  for (const value of ['prod', 'staging', 'Dev']) {
    assert.throws(() => ekzaConfig({ OMOBA_CONTOUR: value }), /OMOBA_CONTOUR must be/);
    assert.equal(studioOrigin({ OMOBA_CONTOUR: value }), null);
    assert.equal(studioOrigin({ OMOBA_CONTOUR: value, OMOBA_STUDIO_URL: PROD.studio }), null);
    assert.throws(() => portalConfig({ OMOBA_CONTOUR: value, OMOBA_PORTAL_ORIGIN: PROD.portal }), /OMOBA_CONTOUR must be/);
    assert.throws(() => contourSiteUrl({ OMOBA_CONTOUR: value }), /OMOBA_CONTOUR must be/);
  }
});

/** Oracle for the portal origin: production keeps "any HTTPS or loopback", minus dev hosts; dev is exact. */
function expectPortal(contour, candidate, allowLocal) {
  if (contour === 'production') return candidate.zone === 'dev' ? FOREIGN.production : new URL(candidate.value).origin;
  if (candidate.value === DEV.portal || (candidate.zone === 'loopback' && allowLocal)) return new URL(candidate.value).origin;
  return candidate.zone === 'production' ? FOREIGN.dev : /Portal origin must be https:\/\/app\.dev\.omoba\.io/;
}

test('the portal origin follows its contour in every combination', () => {
  for (const contour of ['production', 'dev'])
    for (const candidate of CANDIDATES)
      for (const allowLocal of [false, true]) {
        const env = { OMOBA_CONTOUR: contour, OMOBA_ACCOUNT_MODE: 'disabled', OMOBA_PORTAL_ORIGIN: candidate.value, ...(allowLocal ? { OMOBA_ALLOW_INSECURE_LOCAL: '1' } : {}) };
        const label = `${contour} OMOBA_PORTAL_ORIGIN=${candidate.value} local=${allowLocal}`;
        const expected = expectPortal(contour, candidate, allowLocal);
        if (typeof expected === 'string') assert.equal(portalConfig(env).origin, expected, label);
        else assert.throws(() => portalConfig(env), expected, label);
      }
});

test('production keeps its portal rules', () => {
  assert.deepEqual(portalConfig(PROD_PROJECT), { origin: PROD.portal, api: 'http://127.0.0.1:40550', secure: true, accountEnabled: false });
  assert.deepEqual(portalConfig({ ...PROD_PROJECT, OMOBA_CONTOUR: 'production' }), portalConfig(PROD_PROJECT));
  assert.equal(portalConfig({}).origin, 'http://127.0.0.1:3010');
  assert.throws(() => portalConfig({ NODE_ENV: 'production' }), /Production portal requires HTTPS/);
  assert.equal(portalConfig({ OMOBA_ACCOUNT_API_URL: 'https://api.omoba.io', OMOBA_ACCOUNT_INGRESS_KEY: 'a'.repeat(64) }).api, 'https://api.omoba.io');
  for (const api of ['https://api.dev.omoba.io', 'https://accounts.dev.ekza.io'])
    assert.throws(() => portalConfig({ ...PROD_PROJECT, OMOBA_ACCOUNT_API_URL: api }), /Account API .* dev-contour origin/, api);
});

test('the dev portal pins its hosted Account API and keeps local fixtures explicit', () => {
  assert.deepEqual(portalConfig(DEV_PROJECT), { origin: DEV.portal, api: 'http://127.0.0.1:40550', secure: true, accountEnabled: false });
  const { OMOBA_PORTAL_ORIGIN, ...unset } = DEV_PROJECT;
  assert.throws(() => portalConfig(unset), /HTTPS|app\.dev\.omoba\.io/);
  assert.throws(() => portalConfig({ OMOBA_CONTOUR: 'dev', OMOBA_PORTAL_ORIGIN: 'http://127.0.0.1:3010' }), /loopback only/);
  assert.equal(portalConfig({ OMOBA_CONTOUR: 'dev', OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_PORTAL_ORIGIN: 'http://127.0.0.1:3010' }).secure, false);
  for (const [api, pattern] of [['https://api.omoba.io', /production origin/], ['https://api.dev.omoba.io', /Account API must be/], ['https://accounts.example', /Account API must be/]])
    assert.throws(() => portalConfig({ ...DEV_PROJECT, OMOBA_ACCOUNT_API_URL: api }), pattern, api);
  assert.equal(portalConfig({ ...DEV_PROJECT, OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40551' }).api, 'http://127.0.0.1:40551');
});

test('the guard passes both real projects and lists every cross-contour mistake', () => {
  assert.equal(assertContour(PROD_PROJECT), 'production');
  assert.equal(assertContour({}), 'production');
  assert.equal(assertContour(DEV_PROJECT), 'dev');
  // Registry, Studio and site default to the dev contour's own origins.
  const { OMOBA_REGISTRY_URL, OMOBA_STUDIO_URL, OMOBA_SITE_URL, ...devDefaults } = DEV_PROJECT;
  assert.equal(assertContour(devDefaults), 'dev');
  // Local test runs (e2e suites) in either contour.
  const local = { NODE_ENV: 'production', OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_PORTAL_ORIGIN: 'http://127.0.0.1:3010', OMOBA_REGISTRY_URL: 'http://127.0.0.1:8018', OMOBA_STUDIO_URL: 'http://localhost:5188', OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40550' };
  assert.equal(assertContour(local), 'production');
  assert.equal(assertContour({ ...local, OMOBA_CONTOUR: 'dev', OMOBA_SITE_URL: 'http://127.0.0.1:3102' }), 'dev');

  // The dev project without its switch is production with dev URLs: refused, each named.
  const { OMOBA_CONTOUR, ...forgotten } = DEV_PROJECT;
  const problems = contourProblems(forgotten);
  assert.equal(problems.length, 4, problems.join('\n'));
  for (const name of ['OMOBA_REGISTRY_URL', 'OMOBA_STUDIO_URL', 'OMOBA_PORTAL_ORIGIN', 'OMOBA_SITE_URL'])
    assert.ok(problems.some((p) => p.startsWith(name + ' names the dev-contour host')), name);
  assert.throws(() => assertContour(forgotten), /OMOBA contour misconfigured, refusing to build or serve \(fail closed\)/);
  assert.throws(() => assertContour({ ...PROD_PROJECT, OMOBA_ACCOUNT_API_URL: 'https://api.dev.omoba.io' }), /OMOBA_ACCOUNT_API_URL names the dev-contour host/);

  // The production project switched to dev, or dev pointed at production: refused.
  assert.throws(() => assertContour({ ...PROD_PROJECT, OMOBA_CONTOUR: 'dev' }), /Portal origin https:\/\/app\.omoba\.io is a production origin/);
  for (const [name, value] of [['OMOBA_REGISTRY_URL', PROD.registry], ['OMOBA_STUDIO_URL', PROD.studio]])
    assert.throws(() => assertContour({ ...DEV_PROJECT, [name]: value }), new RegExp(name + ': .* is a production origin'), name);
  assert.throws(() => assertContour({ ...DEV_PROJECT, OMOBA_SITE_URL: PROD.site }), /OMOBA_SITE_URL must be https:\/\/dev\.omoba\.io .*omoba\.io is a production host/);
  assert.throws(() => assertContour({ ...DEV_PROJECT, OMOBA_SITE_URL: 'https://players.example' }), /OMOBA_SITE_URL must be https:\/\/dev\.omoba\.io/);
  assert.throws(() => assertContour({ ...DEV_PROJECT, OMOBA_SITE_URL: 'not a url' }), /OMOBA_SITE_URL is not a URL/);
  assert.throws(() => assertContour({ ...DEV_PROJECT, OMOBA_ACCOUNT_MODE: 'enabled', OMOBA_ACCOUNT_API_URL: 'https://api.omoba.io' }), /Account API https:\/\/api\.omoba\.io is a production origin/);
  assert.throws(() => assertContour({ ...DEV_PROJECT, OMOBA_CONTOUR: 'prod' }), /OMOBA_CONTOUR must be "production" or "dev"/);

  // production keeps request-time handling for anything that is not a dev host.
  assert.equal(assertContour({ ...PROD_PROJECT, OMOBA_REGISTRY_URL: 'https://registry.example' }), 'production');
});

test('on Vercel the guard also checks which project it runs in', () => {
  // Vercel system variable: the project's production domain, without a scheme.
  assert.equal(assertContour({ ...PROD_PROJECT, VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'app.omoba.io' }), 'production');
  assert.equal(assertContour({ ...DEV_PROJECT, VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'app.dev.omoba.io' }), 'dev');
  // A fresh dev project before its domain is attached.
  assert.equal(assertContour({ ...DEV_PROJECT, VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'omoba-app-dev.vercel.app' }), 'dev');
  // Dev settings landed on the production project.
  assert.throws(() => assertContour({ ...DEV_PROJECT, VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'app.omoba.io' }), /VERCEL_PROJECT_PRODUCTION_URL app\.omoba\.io is a production project/);
  // The dev project lost its switch (and every URL): still refused.
  assert.throws(() => assertContour({ NODE_ENV: 'production', VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'app.dev.omoba.io', OMOBA_PORTAL_ORIGIN: 'https://omoba-app-dev.vercel.app' }), /app\.dev\.omoba\.io is a dev-contour project/);
  // A hosted dev deployment never accepts loopback doubles.
  assert.throws(() => assertContour({ ...DEV_PROJECT, VERCEL: '1', OMOBA_ALLOW_INSECURE_LOCAL: '1' }), /OMOBA_ALLOW_INSECURE_LOCAL=1 is refused on Vercel/);
  assert.equal(assertContour({ ...DEV_PROJECT, OMOBA_ALLOW_INSECURE_LOCAL: '1' }), 'dev');
});

test('a build only runs in the contour it was built for', () => {
  assert.doesNotThrow(() => assertBuiltContour('production', 'production'));
  assert.doesNotThrow(() => assertBuiltContour('dev', 'dev'));
  assert.throws(() => assertBuiltContour('production', 'dev'), /made for OMOBA_CONTOUR=production but runs with OMOBA_CONTOUR=dev/);
  assert.throws(() => assertBuiltContour('dev', 'production'), /contour mismatch/);
  assert.throws(() => assertBuiltContour(undefined, 'production'), /<unknown>/);
});

test('a request is refused under the other contour\'s host', () => {
  for (const contour of ['production', 'dev'])
    for (const { value, zone } of CANDIDATES) {
      const host = new URL(value).hostname;
      const refused = zone === other(contour);
      assert.equal(contourHostProblem(contour, host) !== null, refused, `${contour} ${host}`);
      if (refused) assert.throws(() => assertContourHost(contour, host), /OMOBA contour mismatch, refusing to serve \(fail closed\): request host/);
      else assert.doesNotThrow(() => assertContourHost(contour, host));
    }
  assert.match(contourHostProblem('production', 'APP.DEV.OMOBA.IO'), /app\.dev\.omoba\.io is a dev-contour host/);
  assert.match(contourHostProblem('dev', 'app.omoba.io'), /app\.omoba\.io is a production host/);
  for (const host of ['', null, undefined]) for (const contour of ['production', 'dev']) assert.equal(contourHostProblem(contour, host), null);
  assert.equal(requestHostname('app.dev.omoba.io'), 'app.dev.omoba.io');
  assert.equal(requestHostname('127.0.0.1:3010'), '127.0.0.1');
  assert.equal(requestHostname('[::1]:3010'), '[::1]');
  assert.equal(requestHostname('APP.Dev.Omoba.IO:443'), 'app.dev.omoba.io');
  for (const value of [null, undefined, '', 'a b', 'x'.repeat(300)]) assert.equal(requestHostname(value), '', String(value));
});

test('robots.txt disallows everything in dev and does not exist in production', () => {
  assert.deepEqual(robotsTxt('dev'), { status: 200, body: 'User-agent: *\nDisallow: /\n' });
  assert.deepEqual(robotsTxt('production'), { status: 404, body: null });
});

test('the website link follows the contour', () => {
  assert.equal(contourSiteUrl({}), PROD.site);
  assert.equal(contourSiteUrl({ OMOBA_CONTOUR: 'dev' }), DEV.site);
  assert.equal(contourSiteUrl(DEV_PROJECT), DEV.site);
  assert.equal(contourSiteUrl({ OMOBA_SITE_URL: 'https://players.example' }), 'https://players.example');
  // A value publicSiteUrl rejects gives the contour's own site, never production's for dev.
  assert.equal(contourSiteUrl({ OMOBA_CONTOUR: 'dev', OMOBA_SITE_URL: 'https://dev.omoba.io/path' }), DEV.site);
  assert.equal(contourSiteUrl({ OMOBA_CONTOUR: 'dev', NODE_ENV: 'production', OMOBA_SITE_URL: 'http://127.0.0.1:3102' }), DEV.site);
  assert.equal(contourSiteUrl({ OMOBA_CONTOUR: 'dev', NODE_ENV: 'development', OMOBA_SITE_URL: 'http://127.0.0.1:3102' }), 'http://127.0.0.1:3102');
  assert.equal(contourSiteUrl({ NODE_ENV: 'production', OMOBA_SITE_URL: 'http://127.0.0.1:3102' }), PROD.site);
});

test('the language cookie is host-only in dev and shared only by production on omoba.io', () => {
  const HOSTS = [
    ['app.omoba.io', 'production'], ['omoba.io', 'production'], ['www.omoba.io', 'production'], ['app-dev.omoba.io', 'production'],
    ['app.dev.omoba.io', 'dev'], ['dev.omoba.io', 'dev'], ['x.y.dev.omoba.io', 'dev'],
    ['localhost', 'neutral'], ['127.0.0.1', 'neutral'], ['omoba-app-dev.vercel.app', 'neutral'], ['dev.omoba.io.evil.example', 'neutral'],
  ];
  for (const contour of ['production', 'dev'])
    for (const [hostname, zone] of HOSTS)
      for (const protocol of ['https:', 'http:']) {
        const label = `${contour} ${protocol}//${hostname}`;
        const devScope = contour === 'dev' || zone === 'dev';
        const name = devScope ? DEV_LOCALE_COOKIE : LOCALE_COOKIE;
        const shared = !devScope && zone === 'production';
        const expected = `${name}=ru; Path=/; Max-Age=31536000; SameSite=Lax${shared ? '; Domain=.omoba.io' : ''}${protocol === 'https:' ? '; Secure' : ''}`;
        assert.equal(localeCookieName(hostname, contour), name, label);
        assert.equal(localeCookie('ru', hostname, protocol, contour), expected, label);
        if (devScope) assert.doesNotMatch(localeCookie('ru', hostname, protocol, contour), /Domain=/i, label);
      }
  // Production callers that pass no contour are byte-for-byte what they were.
  assert.equal(localeCookie('zh', 'app.omoba.io'), 'omoba_locale=zh; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.omoba.io; Secure');
  assert.equal(localeCookie('en', 'localhost', 'http:'), 'omoba_locale=en; Path=/; Max-Age=31536000; SameSite=Lax');
});

test('the dev preference is read first; production\'s only as a read-only start', () => {
  const jar = (values) => (name) => values[name];
  for (const [hostname, contour] of [['app.dev.omoba.io', 'dev'], ['127.0.0.1', 'dev'], ['app.dev.omoba.io', 'production']]) {
    assert.equal(storedLocale(jar({ omoba_locale: 'zh', omoba_locale_dev: 'ru' }), hostname, contour), 'ru', hostname + contour);
    assert.equal(storedLocale(jar({ omoba_locale: 'zh' }), hostname, contour), 'zh', hostname + contour);
    assert.equal(storedLocale(jar({}), hostname, contour), undefined, hostname + contour);
  }
  // Production never looks at the dev cookie.
  for (const hostname of ['app.omoba.io', '127.0.0.1', '']) {
    assert.equal(storedLocale(jar({ omoba_locale: 'zh', omoba_locale_dev: 'ru' }), hostname, 'production'), 'zh', hostname);
    assert.equal(storedLocale(jar({ omoba_locale_dev: 'ru' }), hostname, 'production'), undefined, hostname);
    assert.equal(storedLocale(jar({ omoba_locale_dev: 'ru' }), hostname), undefined, hostname);
  }
});

test('next.config adds X-Robots-Tag only in dev and refuses a misconfigured contour', async () => {
  // Same approach as the dictionary test: strip types without a framework runtime.
  const source = stripTypeScriptTypes(await readFile(new URL('../next.config.ts', import.meta.url), 'utf8'))
    .replace("'./src/lib/contour-guard.mjs'", JSON.stringify(new URL('../src/lib/contour-guard.mjs', import.meta.url).href))
    .replace("'./src/lib/market-profile.mjs'", JSON.stringify(new URL('../src/lib/market-profile.mjs', import.meta.url).href));
  assert.match(source, /file:.*contour-guard\.mjs/);
  const saved = { ...process.env };
  const load = async (env, tag) => {
    for (const key of Object.keys(process.env)) if (key.startsWith('OMOBA_') || key.startsWith('VERCEL')) delete process.env[key];
    Object.assign(process.env, env);
    try {
      // A distinct module per load: the config reads the environment when evaluated.
      return (await import('data:text/javascript;base64,' + Buffer.from(source + '\n// ' + tag).toString('base64'))).default;
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  };
  const robots = async (config) => (await config.headers())[0].headers.filter((h) => h.key === 'X-Robots-Tag').map((h) => h.value);
  const prod = await load({ OMOBA_PORTAL_ORIGIN: PROD.portal, OMOBA_ACCOUNT_MODE: 'disabled' }, 'production');
  // The market is independent of the contour (tests/market-profile.test.mjs).
  const GLOBAL = 'global (ekza on, supporter on, vk_sign_in off)';
  assert.deepEqual(prod.env, { OMOBA_BUILT_CONTOUR: 'production', OMOBA_BUILT_MARKET: GLOBAL });
  assert.deepEqual(await robots(prod), []);
  const dev = await load(DEV_PROJECT, 'dev');
  assert.deepEqual(dev.env, { OMOBA_BUILT_CONTOUR: 'dev', OMOBA_BUILT_MARKET: GLOBAL });
  assert.deepEqual(await robots(dev), ['noindex, nofollow']);
  // The other security headers are the same in both contours.
  const others = async (config) => (await config.headers())[0].headers.filter((h) => h.key !== 'X-Robots-Tag');
  assert.deepEqual(await others(dev), await others(prod));
  const { OMOBA_CONTOUR, ...forgotten } = DEV_PROJECT;
  await assert.rejects(load(forgotten, 'forgotten'), /OMOBA contour misconfigured/);
  await assert.rejects(load({ OMOBA_CONTOUR: 'staging' }, 'typo'), /OMOBA_CONTOUR must be/);
});
