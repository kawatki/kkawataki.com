import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'
const { packageUnavailableReason, validatePackageSchedule } = loader({})('@/lib/experience-packages')
const evening = { minimumHours: 8, availableFrom: '18:00', availableUntil: '23:00', durationMinutes: 120 }
test('evening packages require full activity time inside both windows', () => {
  assert.match(packageUnavailableReason(evening, 8, '09:00', '17:00'), /Change your start time/)
  assert.equal(packageUnavailableReason(evening, 8, '12:00', '20:00'), null)
  assert.equal(packageUnavailableReason(evening, 14, '09:00', '23:00'), null)
  assert.match(packageUnavailableReason(evening, 8, '11:30', '19:30'), /Requires 2 hours/)
  assert.match(packageUnavailableReason(evening, 8, '21:30', '23:00'), /Requires 2 hours/)
  assert.match(packageUnavailableReason(evening, 4, '18:00', '22:00'), /8 hours/)
  assert.match(packageUnavailableReason(evening, 8, '', ''), /schedule first/)
})
test('checkout validation rejects unavailable and unknown packages', () => {
  assert.throws(() => validatePackageSchedule(['counter-sushi'], 8, '09:00', '17:00'), /Unknown/)
  assert.throws(() => validatePackageSchedule(['counter-sushi'], 8, '12:00', '20:00'), /Unknown/)
  assert.throws(() => validatePackageSchedule(['unknown'], 8, '12:00', '20:00'), /Unknown/)
  assert.doesNotThrow(() => validatePackageSchedule([], 4, '09:00', '13:00'))
})
