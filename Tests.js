/**
 * Manual / editor tests for Tasks module (run in Apps Script: select runTaskAppUnitTests).
 * @returns {string[]}
 */
function runTaskAppUnitTests() {
  var out = []

  try {
    var row = [
      'uuid-1',
      'A',
      'P',
      'H',
      'Title',
      'Note',
      'active',
      '2026-05-10',
      '2026-05-12',
      JSON.stringify([{ id: 'c1', text: 'x', isDone: false }]),
      '2026-05-11T10:00:00.000Z',
    ]
    var tr = rowToTask_(row)
    if (tr.id !== 'uuid-1') throw new Error('id parse')
    if (tr.checkItems.length !== 1) throw new Error('checkItems parse')
    if (tr.dueDate !== '2026-05-12') throw new Error('dueDate')
    out.push('rowToTask_: ok')
  } catch (e) {
    out.push('rowToTask_: FAIL ' + e)
  }

  try {
    var t2 = normalizeIncomingTask_(
      {
        title: ' Hello ',
        status: 'completed',
        checkItems: [],
      },
      'new-id'
    )
    if (t2.title !== 'Hello') throw new Error('trim')
    if (t2.status !== 'completed') throw new Error('status')
    out.push('normalizeIncomingTask_: ok')
  } catch (e2) {
    out.push('normalizeIncomingTask_: FAIL ' + e2)
  }

  try {
    if (!isSameInstant_('2026-05-11T10:00:00.000Z', '2026-05-11T10:00:00.000Z'))
      throw new Error('same instant')
    if (isSameInstant_('2026-05-11T10:00:00.000Z', '2026-05-11T10:00:01.000Z'))
      throw new Error('diff instant')
    out.push('isSameInstant_: ok')
  } catch (e3) {
    out.push('isSameInstant_: FAIL ' + e3)
  }

  Logger.log(out.join('\n'))
  return out
}
