const { test, expect, describe, beforeAll, afterAll } = require('@playwright/test')
const { supabaseAdmin } = require('../config')
const { TEST_MATCH_ID_3, saveAllOriginals, restoreAll, lockMatch, clearPrediction } = require('../setup')
const { getUserIds, signInUserClient } = require('../helpers')

describe('Section 5 — Scoring Accuracy (API)', () => {
  let userId, userClient

  beforeAll(async () => {
    await saveAllOriginals()
    const ids = await getUserIds()
    userId = ids.userId
    userClient = await signInUserClient()
  })

  afterAll(async () => {
    await restoreAll()
    await supabaseAdmin.from('predictions').delete().eq('match_id', TEST_MATCH_ID_3)
  })

  async function resetMatch() {
    await supabaseAdmin.from('matches').update({ result: null, score_a: null, score_b: null }).eq('id', TEST_MATCH_ID_3)
    await clearPrediction(userId, TEST_MATCH_ID_3)
  }

  async function runScoring(predictedResult, predictedA, predictedB, actualResult, actualA, actualB) {
    await resetMatch()
    await lockMatch(TEST_MATCH_ID_3, -180)

    const { error } = await userClient.from('predictions').upsert({
      user_id: userId,
      match_id: TEST_MATCH_ID_3,
      predicted_result: predictedResult,
      predicted_score_a: predictedA,
      predicted_score_b: predictedB,
    }, { onConflict: 'user_id,match_id' })
    expect(error).toBeNull()

    await supabaseAdmin.from('matches').update({
      result: actualResult,
      score_a: actualA,
      score_b: actualB,
    }).eq('id', TEST_MATCH_ID_3)

    await supabaseAdmin.rpc('score_match_predictions', { p_match_id: TEST_MATCH_ID_3 })

    const { data: pred } = await supabaseAdmin.from('predictions')
      .select('is_result_correct, is_score_correct, points_earned')
      .eq('match_id', TEST_MATCH_ID_3)
      .eq('user_id', userId)
      .single()

    return pred
  }

  test('5.1 — Correct result + correct score = 5pts', async () => {
    const pred = await runScoring('teamA', 2, 0, 'teamA', 2, 0)
    expect(pred.is_result_correct).toBe(true)
    expect(pred.is_score_correct).toBe(true)
    expect(pred.points_earned).toBe(5)
  })

  test('5.2 — Correct result + wrong score = 3pts', async () => {
    const pred = await runScoring('teamA', 1, 0, 'teamA', 2, 0)
    expect(pred.is_result_correct).toBe(true)
    expect(pred.is_score_correct).toBe(false)
    expect(pred.points_earned).toBe(3)
  })

  test('5.3 — Wrong result = 0pts', async () => {
    const pred = await runScoring('draw', 1, 1, 'teamA', 2, 0)
    expect(pred.is_result_correct).toBe(false)
    expect(pred.is_score_correct).toBe(false)
    expect(pred.points_earned).toBe(0)
  })
})
