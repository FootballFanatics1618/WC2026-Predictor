const { supabaseAdmin } = require('./config')
const { getUserIds } = require('./helpers')

const TEST_MATCH_ID_1 = 1
const TEST_MATCH_ID_2 = 2
const TEST_MATCH_ID_3 = 3

let originals = {}

async function saveOriginal(matchId) {
  const { data } = await supabaseAdmin.from('matches').select('*').eq('id', matchId).single()
  originals[matchId] = data
}

async function restoreMatch(matchId) {
  const orig = originals[matchId]
  if (!orig) return
  await supabaseAdmin.from('matches').update({
    kickoff_utc: orig.kickoff_utc,
    result: orig.result,
    score_a: orig.score_a,
    score_b: orig.score_b,
    sync_source: orig.sync_source,
    auto_synced_at: orig.auto_synced_at,
  }).eq('id', matchId)
}

async function lockMatch(matchId, minutesFromNow) {
  const { error } = await supabaseAdmin.from('matches').update({
    kickoff_utc: new Date(Date.now() + minutesFromNow * 60000).toISOString(),
  }).eq('id', matchId)
  if (error) throw new Error(`Failed to lock match ${matchId}: ${error.message}`)
}

async function unlockMatch(matchId, hoursFromNow = 2) {
  const { error } = await supabaseAdmin.from('matches').update({
    kickoff_utc: new Date(Date.now() + hoursFromNow * 3600000).toISOString(),
  }).eq('id', matchId)
  if (error) throw new Error(`Failed to unlock match ${matchId}: ${error.message}`)
}

async function clearPrediction(userId, matchId) {
  await supabaseAdmin.from('predictions').delete().eq('user_id', userId).eq('match_id', matchId)
}

async function clearPredictionsForMatch(matchId) {
  await supabaseAdmin.from('predictions').delete().eq('match_id', matchId)
}

async function getPrediction(userId, matchId) {
  const { data } = await supabaseAdmin.from('predictions').select('*').eq('user_id', userId).eq('match_id', matchId).single()
  return data
}

async function saveAllOriginals() {
  await saveOriginal(TEST_MATCH_ID_1)
  await saveOriginal(TEST_MATCH_ID_2)
  await saveOriginal(TEST_MATCH_ID_3)
}

async function restoreAll() {
  for (const id of [TEST_MATCH_ID_1, TEST_MATCH_ID_2, TEST_MATCH_ID_3]) {
    await restoreMatch(id)
  }
}

module.exports = {
  TEST_MATCH_ID_1,
  TEST_MATCH_ID_2,
  TEST_MATCH_ID_3,
  saveAllOriginals,
  restoreAll,
  restoreMatch,
  lockMatch,
  unlockMatch,
  clearPrediction,
  clearPredictionsForMatch,
  getPrediction,
}
