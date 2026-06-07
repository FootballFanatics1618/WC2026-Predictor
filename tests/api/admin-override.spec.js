const { test, expect, describe, beforeAll, afterAll } = require('@playwright/test')
const { supabaseAdmin } = require('../config')
const { TEST_MATCH_ID_2, saveAllOriginals, restoreAll, lockMatch } = require('../setup')
const { getUserIds, signInUserClient } = require('../helpers')

describe('Section 2 — Admin Manual Override (API)', () => {
  let userId, userClient

  beforeAll(async () => {
    await saveAllOriginals()
    const ids = await getUserIds()
    userId = ids.userId
    userClient = await signInUserClient()
  })

  afterAll(async () => {
    await restoreAll()
    const { supabaseAdmin: admin } = require('../config')
    await admin.from('predictions').delete().eq('match_id', TEST_MATCH_ID_2)
  })

  test('2.1 — Admin can enter result and predictions get scored', async () => {
    const { supabaseAdmin: admin } = require('../config')

    await lockMatch(TEST_MATCH_ID_2, -180)

    const { error: predError } = await userClient.from('predictions').upsert({
      user_id: userId,
      match_id: TEST_MATCH_ID_2,
      predicted_result: 'teamA',
      predicted_score_a: 2,
      predicted_score_b: 0,
    }, { onConflict: 'user_id,match_id' })
    expect(predError).toBeNull()

    const { error: resultError } = await admin.from('matches').update({
      result: 'teamA',
      score_a: 2,
      score_b: 0,
    }).eq('id', TEST_MATCH_ID_2)
    expect(resultError).toBeNull()

    const { data: match } = await admin.from('matches').select('result, score_a, score_b').eq('id', TEST_MATCH_ID_2).single()
    expect(match.result).toBe('teamA')
    expect(match.score_a).toBe(2)
    expect(match.score_b).toBe(0)

    await admin.rpc('score_match_predictions', { p_match_id: TEST_MATCH_ID_2 })

    const { data: pred } = await admin.from('predictions')
      .select('is_result_correct, is_score_correct, points_earned')
      .eq('match_id', TEST_MATCH_ID_2)
      .eq('user_id', userId)
      .single()

    expect(pred.is_result_correct).toBe(true)
    expect(pred.is_score_correct).toBe(true)
    expect(pred.points_earned).toBe(5)
  })

  test('2.2 — Contradicting result and score are rejected', async () => {
    const { supabaseAdmin: admin } = require('../config')

    const { data: match } = await admin.from('matches').select('result').eq('id', TEST_MATCH_ID_2).single()
    expect(match.result).toBe('teamA')
  })
})
