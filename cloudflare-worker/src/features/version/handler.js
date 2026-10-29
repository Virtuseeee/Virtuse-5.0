// GET|HEAD /version -> { commit }: which build is live. deploy_worker.sh
// compares it with the commit it just deployed.

import { BUILD_COMMIT } from '../../generated/build-info.js';

export function handleVersion() {
  return new Response(JSON.stringify({ commit: BUILD_COMMIT }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}
