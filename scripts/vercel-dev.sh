#!/usr/bin/env bash
# Vercel project omoba-app-dev -> https://app.dev.omoba.io (the OMOBA dev contour).
#
#   scripts/vercel-dev.sh [--apply] plan|setup|deploy|check
#
# Without --apply nothing runs: every command is printed (dry run). The guards
# below run in both modes. See docs/vercel.md#dev-project-omoba-app-dev.
#
#   setup   create the project if missing, set build settings, set the dev env on
#           the production and preview targets, attach app.dev.omoba.io. Idempotent.
#   deploy  resolve the dev project id, export origin/dev with git archive into a
#           fresh temp dir, gate it (npm ci/test/typecheck/dev build), link THAT
#           dir, deploy --prod --project <dev>, then confirm the deployment's
#           projectId. The checkout this script lives in is only read, never linked.
#   check   read-only: domain config, env keys, live headers/robots/badge/links.
#   plan    setup + deploy + check, always as a dry run.
#
# Never touches omoba-app (production). It refuses production project names,
# hostnames and hosts, a non-dev ref, project overrides in the environment
# (VERCEL_PROJECT_ID, VERCEL_ORG_ID and the legacy NOW_PROJECT_ID, NOW_ORG_ID),
# a .vercel link in the checkout, an export linked to anything but the dev
# project, and reports a deployment that landed anywhere else.
set -euo pipefail

PROD_PROJECT_ID=prj_9pxN1QpGTWA2ZvuSOL13F4AWTrdL   # omoba-app; refusal guard only
DEV_DOMAIN=app.dev.omoba.io                        # fixed: the app accepts no other dev origin
DEV_PROJECT=${DEV_PROJECT:-omoba-app-dev}
VERCEL_SCOPE=${VERCEL_SCOPE:-wotoris-projects-c784733b}
VC=${VC:-npx --cache /tmp/npm-cache-vercel --yes vercel@63.1.2}
DEV_REF=${DEV_REF:-origin/dev}
GATE=${GATE:-1}
NPM_CACHE=${NPM_CACHE:-/tmp/npm-cache-omoba-web-dev}
REPO=${REPO:-$(cd "$(dirname "$0")/.." && pwd)}

# The dev project's environment (non-sensitive; no secrets exist for this app).
DEV_ENV="OMOBA_CONTOUR=dev
OMOBA_PORTAL_ORIGIN=https://app.dev.omoba.io
OMOBA_ACCOUNT_MODE=disabled
OMOBA_REGISTRY_URL=https://registry.dev.ekza.io
OMOBA_STUDIO_URL=https://studio.dev.ekza.io
OMOBA_SITE_URL=https://dev.omoba.io"
FORBIDDEN_ENV="OMOBA_ALLOW_INSECURE_LOCAL OMOBA_TRUST_LOOPBACK_PROXY OMOBA_ACCOUNT_API_URL"
# The CLI reads a project from VERCEL_<X> or else NOW_<X> (@vercel/build-utils
# getPlatformEnv). With both IDs set, `link` and `deploy` without --project use
# them instead of .vercel/project.json, and `link --project` links that project.
PROJECT_OVERRIDE_ENV="VERCEL_PROJECT_ID VERCEL_ORG_ID NOW_PROJECT_ID NOW_ORG_ID"
DEV_PROJECT_ID=''   # set by resolve_dev_project from the API
DEV_ORG_ID=''

APPLY=0
die() { echo "vercel-dev: REFUSED: $*" >&2; exit 2; }
say() { echo "vercel-dev: $*"; }

usage() { sed -n '2,/^set -euo/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'; exit 64; }

# shellcheck disable=SC2206
VC_CMD=($VC)
quote() { local out="" a; for a in "$@"; do case $a in *[!A-Za-z0-9_./:=,@%+-]*|'') out="$out '${a//\'/\'\\\'\'}'";; *) out="$out $a";; esac; done; echo "${out# }"; }
# A command with side effects or network: printed always, executed only with --apply.
run() { echo "+ $(quote "$@")"; if [ "$APPLY" = 1 ]; then "$@"; fi; }
vc() { run "${VC_CMD[@]}" "$@"; }
# A read whose answer drives the next step; in a dry run it is only printed.
vc_read() { echo "+ $(quote "${VC_CMD[@]}" "$@")" >&2; "${VC_CMD[@]}" "$@"; }

guard() {
  case "$DEV_PROJECT" in
    omoba-app|landing-v2-omoba|landing-v2-ekza) die "DEV_PROJECT=$DEV_PROJECT is a production project";;
    *-dev) ;;
    *) die "DEV_PROJECT=$DEV_PROJECT must end in -dev";;
  esac
  case "$DEV_PROJECT" in *[!a-z0-9-]*) die "DEV_PROJECT=$DEV_PROJECT has unexpected characters";; esac
  case "$DEV_REF" in origin/dev|dev) ;; *) die "DEV_REF=$DEV_REF: dev deploys come from the dev branch only";; esac
  local value
  for value in "$DEV_PROJECT" "$VERCEL_SCOPE" "$DEV_REF" "$REPO" "$VC"; do
    case "$value" in
      *vds-eternal*|*77.246.105.57*|*snrjxwutqxokeujuiepn*|*"$PROD_PROJECT_ID"*) die "a production identifier appears in the configuration: $value";;
    esac
  done
  # The Vercel CLI prefers these over any link: they could point a deploy at production.
  local name
  for name in $PROJECT_OVERRIDE_ENV; do
    [ -z "${!name:-}" ] || die "$name is set in the environment; unset it (the Vercel CLI would use it instead of the dev link)"
  done
  if printf '%s\n' "$DEV_ENV" | grep -Eq '//(registry\.|studio\.|app\.)?(ekza|omoba)\.io'; then die "DEV_ENV names a production host"; fi
}

setup() {
  say "setup $DEV_PROJECT in $VERCEL_SCOPE"
  if [ "$APPLY" = 1 ]; then
    vc_read project inspect "$DEV_PROJECT" --scope "$VERCEL_SCOPE" >/dev/null 2>&1 || vc project create "$DEV_PROJECT" --scope "$VERCEL_SCOPE"
  else
    echo "+ $(quote "${VC_CMD[@]}" project inspect "$DEV_PROJECT" --scope "$VERCEL_SCOPE") || \\"
    vc project create "$DEV_PROJECT" --scope "$VERCEL_SCOPE"
  fi
  # --yes: without it the CLI (63.1.2, non-interactive or agent shell) only answers
  # "confirmation_required" and changes nothing.
  vc project update "$DEV_PROJECT" --framework nextjs --node-version 24.x --build-command "npm run build" --install-command "npm ci" --yes --scope "$VERCEL_SCOPE"
  local kv target
  # Preview too: any build in this project, even a branch preview, is the dev contour.
  for target in production preview; do
    while IFS= read -r kv; do
      # The CLI (63.1.2) reads a non-TTY stdin as the value even with --value. Fed
      # from this loop's heredoc it stored the remaining lines as the first key's
      # value and the other keys were never written. Give it the same value on stdin.
      vc env add "${kv%%=*}" "$target" --value "${kv#*=}" --no-sensitive --force --yes --project "$DEV_PROJECT" --scope "$VERCEL_SCOPE" < <(printf '%s' "${kv#*=}")
    done <<EOF
$DEV_ENV
EOF
  done
  # Attach the domain only if missing; never --force (that would move it from another project).
  if [ "$APPLY" = 1 ]; then
    if vc_read api "/v9/projects/$DEV_PROJECT/domains" -X GET --scope "$VERCEL_SCOPE" |
      node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.exit(JSON.parse(s).domains.some(d=>d.name===process.argv[1])?0:1))' "$DEV_DOMAIN"; then
      say "$DEV_DOMAIN already on $DEV_PROJECT"
    else
      vc domains add "$DEV_DOMAIN" "$DEV_PROJECT" --scope "$VERCEL_SCOPE"
    fi
  else
    echo "# only if $DEV_DOMAIN is not yet on $DEV_PROJECT (GET /v9/projects/$DEV_PROJECT/domains):"
    vc domains add "$DEV_DOMAIN" "$DEV_PROJECT" --scope "$VERCEL_SCOPE"
  fi
  say "DNS (owner, Name.com zone omoba.io): host app.dev, type CNAME, answer cname.vercel-dns.com, TTL 300"
}

# Sets DEV_PROJECT_ID/DEV_ORG_ID to what the API answers for $DEV_PROJECT in the
# scope. The link and the deployment are both checked against this id.
resolve_dev_project() {
  local json ids
  json=$(vc_read api "/v9/projects/$DEV_PROJECT" -X GET --scope "$VERCEL_SCOPE") ||
    die "cannot read $DEV_PROJECT from the Vercel API; nothing was deployed"
  ids=$(printf '%s' "$json" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const [prod, name] = process.argv.slice(1);
      let p; try { p = JSON.parse(s); } catch { console.error("the API answer is not JSON"); process.exit(1); }
      if (typeof p.id !== "string" || !/^prj_[A-Za-z0-9]+$/.test(p.id)) { console.error("the API answer has no project id"); process.exit(1); }
      if (p.id === prod) { console.error(name + " resolves to the PRODUCTION project id " + prod); process.exit(1); }
      if (p.name !== name) { console.error("the API names project " + p.id + " " + JSON.stringify(p.name) + ", not " + name); process.exit(1); }
      console.log(p.id + " " + (typeof p.accountId === "string" ? p.accountId : ""));
    })' "$PROD_PROJECT_ID" "$DEV_PROJECT") || die "$DEV_PROJECT did not resolve to a dev project; nothing was deployed"
  DEV_PROJECT_ID=${ids%% *}
  DEV_ORG_ID=${ids#* }
  say "$DEV_PROJECT is $DEV_PROJECT_ID${DEV_ORG_ID:+ in $DEV_ORG_ID}"
}

assert_dev_link() {
  local dir=$1
  node -e '
    const [dir, prod, name, id, org] = process.argv.slice(1);
    let p; try { p = JSON.parse(require("fs").readFileSync(dir + "/.vercel/project.json", "utf8")); }
    catch { console.error("no .vercel/project.json in the export: the link did not record " + name); process.exit(1); }
    if (p.projectId === prod) { console.error("linked to the PRODUCTION project omoba-app"); process.exit(1); }
    if (p.projectId !== id) { console.error("linked to " + p.projectId + ", not " + name + " (" + id + ")"); process.exit(1); }
    if (p.projectName !== undefined && p.projectName !== name) { console.error("linked to " + p.projectName + ", not " + name); process.exit(1); }
    if (org && p.orgId !== org) { console.error("linked in " + p.orgId + ", not " + org); process.exit(1); }
  ' "$dir" "$PROD_PROJECT_ID" "$DEV_PROJECT" "$DEV_PROJECT_ID" "$DEV_ORG_ID" || die "the export is not linked to $DEV_PROJECT; nothing was deployed"
}

# $1 is the stdout of `vercel deploy`: a URL, or JSON ({id,url} or {deployment:{id,url}})
# when the CLI runs non-interactively. The deployment must belong to the dev project.
assert_deployment() {
  local out=$1 ref json
  ref=$(printf '%s' "$out" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      let ref;
      try { const j = JSON.parse(s); const d = j.deployment ?? j; ref = d.id ?? d.url; } catch {}
      if (!ref) ref = (s.match(/https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app\b/g) ?? []).at(-1);
      ref = String(ref ?? "").replace(/^https:\/\//, "");
      if (!/^(dpl_[A-Za-z0-9]+|[a-z0-9-]+(\.[a-z0-9-]+)+)$/.test(ref)) process.exit(1);
      console.log(ref);
    })') || die "cannot tell which deployment the CLI made; confirm by hand that it belongs to $DEV_PROJECT ($DEV_PROJECT_ID), not omoba-app"
  json=$(vc_read api "/v13/deployments/$ref" -X GET --scope "$VERCEL_SCOPE") ||
    die "cannot read deployment $ref; confirm by hand that it belongs to $DEV_PROJECT ($DEV_PROJECT_ID), not omoba-app"
  printf '%s' "$json" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const [id, name] = process.argv.slice(1);
      let d; try { d = JSON.parse(s); } catch { console.error("the API answer is not JSON"); process.exit(1); }
      if (d.projectId !== id) { console.error("deployment " + (d.id ?? "?") + " belongs to project " + d.projectId + ", not " + name + " (" + id + ")"); process.exit(1); }
      console.log("vercel-dev: deployment " + d.id + " belongs to " + name + " (" + id + ")");
    })' "$DEV_PROJECT_ID" "$DEV_PROJECT" ||
    die "deployment $ref is NOT on $DEV_PROJECT. If its project is omoba-app ($PROD_PROJECT_ID), app.omoba.io may now serve dev code: roll omoba-app back to its previous production deployment now (dashboard: omoba-app > Deployments > Instant Rollback)"
}

deploy() {
  [ ! -e "$REPO/.vercel" ] || die "$REPO/.vercel exists: a Vercel link in the checkout; remove it (deploys link only a temp export)"
  say "deploy $DEV_REF of $REPO to $DEV_PROJECT"
  if [ "$APPLY" = 1 ]; then
    resolve_dev_project
  else
    echo "+ $(quote "${VC_CMD[@]}" api "/v9/projects/$DEV_PROJECT" -X GET --scope "$VERCEL_SCOPE")   # its id: never the production id; the link and the deployment must match it"
  fi
  run git -C "$REPO" fetch -q origin dev
  local sha work
  if [ "$APPLY" = 1 ]; then
    sha=$(git -C "$REPO" rev-parse --verify "$DEV_REF^{commit}")
    work=$(mktemp -d "${TMPDIR:-/tmp}/omoba-web-dev.XXXXXX")
  else
    sha='<sha of '"$DEV_REF"'>'
    work='<fresh mktemp -d>'
  fi
  case "$work" in "$REPO"|"$REPO"/*) die "the export dir is inside the checkout";; esac
  echo "+ git -C $(quote "$REPO") archive $sha | tar -x -C $work"
  if [ "$APPLY" = 1 ]; then git -C "$REPO" archive "$sha" | tar -x -C "$work"; fi
  if [ "$GATE" = 1 ]; then
    # Same gate as a release: tests, types and a build with the dev project's env.
    echo "+ (cd $work && npm ci && npm test && npm run typecheck && <DEV_ENV> npm run build && rm -rf .next node_modules)"
    if [ "$APPLY" = 1 ]; then
      (
        cd "$work"
        export npm_config_cache="$NPM_CACHE"
        npm ci --no-audit --no-fund
        npm test
        npm run typecheck
        while IFS= read -r kv; do export "${kv?}"; done <<EOF
$DEV_ENV
EOF
        npm run build
        rm -rf .next node_modules
      )
    fi
  fi
  vc link --yes --project "$DEV_PROJECT" --scope "$VERCEL_SCOPE" --cwd "$work"
  # --project as well as the link: an explicit project wins over VERCEL_*/NOW_*
  # project IDs in the CLI (they are refused and unset here anyway).
  local deploy_args=(deploy --prod --yes --project "$DEV_PROJECT" --cwd "$work" --scope "$VERCEL_SCOPE" -m contour=dev -m gitRef=dev -m "gitSha=$sha")
  if [ "$APPLY" = 1 ]; then
    assert_dev_link "$work"
    echo "+ $(quote "${VC_CMD[@]}" "${deploy_args[@]}")"
    local out status=0
    out=$("${VC_CMD[@]}" "${deploy_args[@]}") || status=$?
    [ -z "$out" ] || printf '%s\n' "$out"
    [ "$status" = 0 ] || die "vercel deploy failed (exit $status)"
    assert_deployment "$out"
  else
    echo "# <export>/.vercel/project.json must name that id"
    vc "${deploy_args[@]}"
    echo "+ $(quote "${VC_CMD[@]}" api "/v13/deployments/<deployment id>" -X GET --scope "$VERCEL_SCOPE")   # projectId must be the id of $DEV_PROJECT"
  fi
  [ ! -e "$REPO/.vercel" ] || die "$REPO/.vercel appeared during the deploy; investigate before the next run"
  say "export kept at $work (remove it after checking the deploy)"
}

check() {
  say "check $DEV_PROJECT / https://$DEV_DOMAIN (read-only)"
  if [ "$APPLY" != 1 ]; then
    echo "+ $(quote "${VC_CMD[@]}" api "/v6/domains/$DEV_DOMAIN/config?projectIdOrName=$DEV_PROJECT" -X GET --scope "$VERCEL_SCOPE")   # misconfigured=false"
    echo "+ $(quote "${VC_CMD[@]}" api "/v9/projects/$DEV_PROJECT/env" -X GET --scope "$VERCEL_SCOPE")   # exactly the DEV_ENV keys"
    echo "+ curl https://$DEV_DOMAIN/ /market /robots.txt   # 307 /workshop; X-Robots-Tag noindex, nofollow; Disallow: /; DEV badge; only studio.dev.ekza.io"
    return 0
  fi
  vc_read api "/v6/domains/$DEV_DOMAIN/config?projectIdOrName=$DEV_PROJECT" -X GET --scope "$VERCEL_SCOPE" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log("domain misconfigured:",c.misconfigured);process.exit(c.misconfigured?1:0)})'
  vc_read api "/v9/projects/$DEV_PROJECT/env" -X GET --scope "$VERCEL_SCOPE" |
    node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const keys=[...new Set(JSON.parse(s).envs.map(e=>e.key))].sort();
        const want=process.argv[1].split("\n").map(l=>l.split("=")[0]).sort();
        const bad=keys.filter(k=>process.argv[2].split(" ").includes(k));
        console.log("env keys:",keys.join(" "));
        if (bad.length || want.some(k=>!keys.includes(k))) { console.error("env drift: forbidden",bad,"missing",want.filter(k=>!keys.includes(k))); process.exit(1); }
      })' "$DEV_ENV" "$FORBIDDEN_ENV"
  local base="https://$DEV_DOMAIN" html
  curl -sS -o /dev/null -w 'GET / -> %{http_code} %{redirect_url}\n' "$base/"
  curl -sSI "$base/market" | grep -i '^x-robots-tag: noindex, nofollow' || die "X-Robots-Tag missing on /market"
  curl -sS "$base/robots.txt" | grep -qx 'Disallow: /' || die "robots.txt does not disallow /"
  html=$(curl -sS "$base/market")
  printf '%s' "$html" | grep -q 'data-contour-badge="dev"' || die "DEV badge missing"
  if printf '%s' "$html" | grep -Eo 'https://studio[.a-z]*\.ekza\.io' | sort -u | grep -vx 'https://studio.dev.ekza.io'; then
    die "the dev market links a non-dev Studio"
  fi
  say "dev contour OK; now confirm omoba-app is unchanged (same production deployment, domains and env)"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift;;
    --dry-run) APPLY=0; shift;;
    -h|--help) usage;;
    plan|setup|deploy|check) CMD=$1; shift;;
    *) usage;;
  esac
done
[ -n "${CMD:-}" ] || usage
guard
# The guard leaves at most empty values; drop them so no CLI call ever sees one.
unset VERCEL_PROJECT_ID VERCEL_ORG_ID NOW_PROJECT_ID NOW_ORG_ID
if [ "$CMD" = plan ]; then APPLY=0; fi
[ "$APPLY" = 1 ] || say "dry run: nothing is executed (add --apply)"
case "$CMD" in
  plan) setup; deploy; check;;
  setup) setup;;
  deploy) deploy;;
  check) check;;
esac
