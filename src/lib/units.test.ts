import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reviewUnits } from './units.ts'

test('different speeds must be converted before adding', () => {
  const review = reviewUnits('v = 20 km/h + 4 m/s')
  assert.match(review?.detail ?? '', /same unit/i)
})

test('the same unit can be added', () => {
  assert.equal(reviewUnits('v = 20 km/h + 5 km/h'), null)
})

test('length is not a speed', () => {
  const review = reviewUnits('20 km/h = 20 m')
  assert.match(review?.detail ?? '', /different kinds/i)
})

test('a correct speed conversion is quiet', () => {
  assert.equal(reviewUnits('20 km/h = 5.56 m/s'), null)
})

test('newton and joule stay distinct', () => {
  const review = reviewUnits('10 N = 10 J')
  assert.match(review?.detail ?? '', /different kinds/i)
})

test('a term with two quantities is not compared as one measurement', () => {
  assert.equal(reviewUnits('10 m 5 s + 2 m'), null)
})
