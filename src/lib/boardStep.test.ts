import assert from 'node:assert/strict'
import { test } from 'node:test'
import { anchorUnder, katexSource, readStep, replyStep, shouldTypeset } from './boardStep.ts'

test('reads a json step', () => {
  assert.equal(readStep('{"step":"F=ma"}'), 'F=ma')
})

test('reads a step after a thinking trace', () => {
  assert.equal(
    readStep('<think>I should not solve it.</think>\n{"step":"\\\\frac{1}{2}at^2"}'),
    '\\frac{1}{2}at^2',
  )
})

test('reads a fenced json step', () => {
  assert.equal(readStep('```json\n{"step":"x=2"}\n```'), 'x=2')
})

test('reads a bare math line when the reply is not json', () => {
  assert.equal(readStep('The next line is\nv = v_0 + at'), 'v = v_0 + at')
})

test('uses the json step in the reasoning field when the answer is empty', () => {
  assert.equal(replyStep('', '{"step":"x=2"}'), 'x=2')
})

test('rejects an empty reply', () => {
  assert.equal(readStep(''), null)
  assert.equal(readStep('<think>still thinking</think>'), null)
})

test('strips wrapping dollars from a step', () => {
  assert.equal(katexSource('$$x = 2$$'), 'x = 2')
  assert.equal(katexSource('$F=ma$'), 'F=ma')
})

test('plain sentences stay as text', () => {
  assert.equal(shouldTypeset('Subtract 3 from both sides'), false)
  assert.equal(shouldTypeset('Apply the second law, F = ma'), false)
  assert.equal(shouldTypeset('F = ma'), true)
  assert.equal(shouldTypeset('\\frac{1}{2}at^2'), true)
})

test('a panned page drops the step under the visible part of the problem', () => {
  const page = { left: 0, top: 0, width: 1200, height: 900 }
  const view = { left: 420, top: 80, width: 360, height: 500 }
  const point = anchorUnder(page, view)
  assert.equal(point.x, 600)
  assert.equal(point.y, 580 + 28)
})

test('a problem that fits on screen is centered under itself', () => {
  const problem = { left: 180, top: 40, width: 400, height: 260 }
  const view = { left: 0, top: 0, width: 1200, height: 800 }
  const point = anchorUnder(problem, view)
  assert.equal(point.x, 380)
  assert.equal(point.y, 300 + 28)
})
