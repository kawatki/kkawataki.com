import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'
const { parseBookingRequest } = loader({})('@/lib/booking')
const base = {date:'2027-01-15',startTime:'09:00',endTime:'13:00',peopleCount:1,faceRecordingConsent:true,name:'Guest',email:'guest@example.com',title:'Explore Tokyo',location:'Shibuya',socialPlatform:'instagram',socialHandle:'guest',depositTermsAccepted:true,transportationTermsAccepted:true}
test('custom ideas are optional and normalized separately from notes', () => {
  assert.equal(parseBookingRequest(base).customIdeas, undefined)
  const result = parseBookingRequest({...base, notes:'Keep these notes',customIdea:{title:' Camera shops ',description:' Find vintage cameras '}})
  assert.deepEqual(result.customIdeas,[{title:'Camera shops',description:'Find vintage cameras'}])
  assert.equal(result.notes,'Keep these notes')
})
test('custom idea validation rejects incomplete or oversized fields', () => {
  for (const customIdea of [null, {}, {title:'Hi',description:'Details'}, {title:'Camera shops',description:'x'.repeat(451)}, {title:'x'.repeat(101),description:'Details'}]) {
    assert.throws(() => parseBookingRequest({...base,customIdea}), /custom idea|Custom idea/)
  }
})

test('accepts three custom ideas and rejects a fourth', () => {
  const idea = {title:'Camera shops', description:'Find vintage cameras'}
  assert.equal(parseBookingRequest({...base, endTime:"23:00", customIdeas:[idea,idea,idea]}).customIdeas.length, 3)
  assert.throws(() => parseBookingRequest({...base, customIdeas:[idea,idea,idea,idea]}), /up to 3/)
})

test('rich descriptions retain safe formatting and remove unsafe links and HTML', () => {
  const result = parseBookingRequest({...base, customIdeas:[{title:'Camera shops',description:'Visit here',descriptionHtml:'<p><strong>Visit</strong> <a href="https://example.com">here</a><script>alert(1)</script><img src=x onerror=alert(1)></p>'}]})
  assert.match(result.customIdeas[0].descriptionHtml, /<strong>Visit<\/strong>/)
  assert.match(result.customIdeas[0].descriptionHtml, /href="https:\/\/example.com"/)
  assert.doesNotMatch(result.customIdeas[0].descriptionHtml, /script|img|onerror/)
  const unsafe = parseBookingRequest({...base, customIdeas:[{title:'Camera shops',description:'Visit here',descriptionHtml:'<p><a href="javascript:alert(1)">Visit here</a></p>'}]})
  assert.doesNotMatch(unsafe.customIdeas[0].descriptionHtml, /javascript:/)
  assert.throws(() => parseBookingRequest({...base, customIdeas:[{title:'Camera shops',description:'Valid text',descriptionHtml:'<p></p>'}]}), /3–450/)
})

test('saved description links open safely in a new tab', () => {
  const { cleanDescription } = loader({})('@/lib/rich-description')
  const html = cleanDescription('<a href="https://example.com" target="_self" onclick="alert(1)">Here</a>', true)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.doesNotMatch(html, /onclick|_self/)
})

test('task notes retain list items and complete link destinations without HTML', () => {
  const { descriptionForTask } = loader({})('@/lib/rich-description')
  const result = descriptionForTask('<p><strong>Meet here</strong></p><ul><li><a href="https://example.com/?a=1&amp;b=2">Shinjuku</a></li></ul>')
  assert.match(result, /• Shinjuku \(https:\/\/example.com\/\?a=1&b=2\)/)
  assert.doesNotMatch(result, /<[^>]+>/)
})

test('custom idea limits follow booking duration', () => {
  const idea = {title:'Explore Tokyo',description:'Visit some shops'}
  for (const [endTime, limit] of [['13:00',1],['17:00',2],['23:00',3]]) {
    assert.equal(parseBookingRequest({...base,endTime,customIdeas:Array(limit).fill(idea)}).customIdeas.length,limit)
    assert.throws(() => parseBookingRequest({...base,endTime,customIdeas:Array(limit+1).fill(idea)}), /up to/)
  }
})
