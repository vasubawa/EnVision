import assert from 'node:assert/strict'
import { test } from 'node:test'
import { equivalent, reviewAlgebra, applyBoardChecks } from './mathCheck.ts'

test('expanded linear steps match', () => {
  assert.equal(equivalent('2*(x+3)=14', '2*x+6=14'), true)
})

test('distribution mistakes do not match', () => {
  assert.equal(equivalent('2*(x+3)=14', '2*x+3=14'), false)
})

test('solved linear steps match', () => {
  assert.equal(equivalent('x+1=3', 'x=2'), true)
})

test('arithmetic claims', () => {
  assert.equal(equivalent('2*3', '6'), true)
  assert.equal(equivalent('2*3', '7'), false)
})

test('a second variable is rejected', () => {
  assert.throws(() => equivalent('x+y', '3'), /variable/i)
})

test('board review catches a bad algebra step and a bad product', () => {
  const review = reviewAlgebra('2(x + 3) = 14\n2x + 3 = 14\n2*3=7')
  assert.equal(review?.rejects, true)
  assert.match(review?.detail ?? '', /rejects/i)
})

test('board review accepts an equivalent step', () => {
  const review = reviewAlgebra('2(x+3)=14\n2x+6=14')
  assert.equal(review?.rejects, false)
})

test('one unsolved equation is not called wrong', () => {
  assert.equal(reviewAlgebra('Solve 2(x+3)=14'), null)
})

test('unreadable chemistry is left alone', () => {
  assert.equal(reviewAlgebra('Balance H2O + O2'), null)
})

test('an organic scheme is not judged as algebra', () => {
  assert.equal(reviewAlgebra('CH3CH2OH + HBr -> CH3CH2Br + H2O\n2 = 3'), null)
})

test('a wrong numerical substitution is rejected', () => {
  const review = reviewAlgebra('20/4 = 6')
  assert.equal(review?.rejects, true)
})

test('a correct numerical substitution is accepted', () => {
  const review = reviewAlgebra('10*s = 400\ns = 40')
  assert.equal(review?.rejects, false)
})

test('a rejected step is a mistake even when it has not been judged', () => {
  const result = applyBoardChecks(
    { isCorrect: null, judgement: 'progress', suggestion: 'Try again.' },
    '20/4 = 6',
  )
  assert.equal(result.isCorrect, false)
  assert.equal(result.judgement, 'mistake')
  assert.match(result.suggestion, /rejects/i)
})
