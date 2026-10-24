// One-time text-grid authoring helper. All final source grids are committed.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
const root = resolve(import.meta.dirname, '../../../art-src/ui')
function grid(name, rows, slice = 0, frames = 1) {
  const width = rows[0].length / frames, height = rows.length
  if (rows.some(row => row.length !== width * frames)) throw new Error(`Unequal rows: ${name}`)
  const path = resolve(root, `${name}.txt`); mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `size ${width}x${height}\n${frames > 1 ? `frames ${frames}\n` : ''}${slice ? `slice ${slice}\n` : ''}${Array.from({ length: frames }, (_, frame) => `--- ${frame}\n${rows.map(row => row.slice(frame * width, (frame + 1) * width)).join('\n')}\n`).join('')}`)
}
const board = ['.kkkkkkkkkk.','knnnnnnnnnbk','knQQQQQQQQbk','knQppppppPbk','knQppppppPbk','knQppppppPbk','knQppppppPbk','knQppppppPbk','knQppppppPbk','knPPPPPPPPbk','kbbbbbbbbbbk','.kkkkkkkkkk.']
grid('frames/board', board, 4)
grid('frames/wood', ['.kkkkkkkkkkkkkk.','kbbbbbbbbbbbbbbk','kbzWwwwwwwwwSbbk','kbWWwwwwwwwwWWbk','kbwwbbbbbbbbwwbk','kbwwbwwwwwwbwwbk','kbwwbwwwwwwbwwbk','kbwwWwwwwwwWwwbk','kbWWWWWWWWWWWWbk','kbwwbwwwwwwbwwbk','kbwwbwwwwwwbwwbk','kbwwWWWWWWWWwwbk','kbWWwwwwwwwwWWbk','kbSWWWWWWWWWzWbk','kbWWWWWWWWWWWWbk','.kkkkkkkkkkkkkk.'], 5)
grid('frames/inset', ['PPPPPPPP','PqqqqqqP','PqqqqqqP','PqqqqqqP','PqqqqqqP','PqqqqqqP','PqqqqqqQ','PPPPPPQQ'], 3)
grid('frames/plaque', ['.kkkkkkkkkk.','kQQQQQQQQQQk','kQppppppppPk','kQWppppppWPk','kQppppppppPk','kQppppppppPk','kQWppppppWPk','kQppppppppPk','kPPPPPPPPPPk','.kkkkkkkkkk.'], 4)
const button = ['.kkkkkkkkkk.','kQQQQQQQQQQk','kQnnnnnnnnbk','kQnnnnnnnnbk','kQnnnnnnnnbk','kQnnnnnnnnbk','kQnnnnnnnnbk','kQnnnnnnnnbk','kQnnnnnnnnbk','kbbbbbbbbbbk','kWWWWWWWWWWk','.kkkkkkkkkk.']
grid('frames/button', button, 4)
grid('frames/button-hover', button.map(row => row.replaceAll('n', 'q')), 4)
grid('frames/button-primary', button.map(row => row.replaceAll('n', 'O').replaceAll('b', 'n')), 4)
grid('frames/button-pressed', button.map((row, y) => y === 10 ? 'kbbbbbbbbbbk' : row.replaceAll('Q', 'n')), 4)
grid('frames/button-disabled', button.map(row => row.replaceAll('n', 'P').replaceAll('Q', 'q').replaceAll('b', 'P')), 4)
grid('frames/ghost', ['.PPPPPP.','PppppppP','PppppppP','PppppppP','PppppppP','PppppppP','PppppppP','.PPPPPP.'], 3)
const tag = ['.kkkk.','kJJJJk','kJJJJk','kJJJJk','kJJJJk','.kkkk.']
grid('frames/tag', tag, 2)
for (const [name, key] of [['gold','O'],['red','Z'],['green','M']]) grid(`frames/tag-${name}`, tag.map(row => row.replaceAll('J', key)), 2)
const field = ['kkkkkkkk','kPQQQQQk','kQQQQQQk','kQQQQQQk','kQQQQQQk','kQQQQQQk','kQQQQQQk','kkkkkkkk']
grid('frames/field', field, 3); grid('frames/field-focus', field.map(row => row.replaceAll('k', 'O')), 3)
grid('frames/tab', button, 4); grid('frames/tab-active', board, 4)
grid('controls/slider-thumb', ['.kkk.','knQnk','knnnk','knWnk','knnnk','kbbbk','.kkk.'])
grid('controls/slider-track', ['kkkkkk','kWWWWk','kPPPPk','kkkkkk'], 2)
grid('controls/scroll-thumb', ['kkkk','knQk','knnk','knnk','knnk','knnk','kbbk','kkkk'], 2)
grid('controls/toggle', ['.kkkkkkkkkkkk..kkkkkkkkkkkk.','kWWWWWWWWWWWWkkMMMMMMMMMMMMk','kknQnkWWWWWWWkkMMMMMMMMknQnk','kknnnkWWWWWWWkkMMMMMMMMknnnk','kkbbbkWWWWWWWkkMMMMMMMMkbbbk','kWWWWWWWWWWWWkkMMMMMMMMMMMMk','.kkkkkkkkkkkk..kkkkkkkkkkkk.'], 0, 2)
const icons = {
coin: ['...kkkk...','..kiOOOk..','.kiOOOOnk.','.kOOkkOnk.','.kOOkOOnk.','.kOOkkOnk.','.kOOOOOnk.','..knnnnk..','...kkkk...','..........'],
calendar: ['..k....k..','.kWkkkkWk.','.krrrrrrk.','.kkkkkkkk.','.kQQQQQQk.','.kQkkQkQk.','.kQQQQQQk.','.kQkkQkQk.','.kPPPPPPk.','.kkkkkkkk.'],
leaf: ['.......kk.','.....kkYtk','...kkYYttk','..kYYYttTk','.kYYYtTkk.','.kYYtTk...','.kYtTk....','..kTk.....','.kTk......','..k.......'],
ledger: ['.kkkkkkkk.','.kbQQQQWk.','.kbQkkQWk.','.kbQQQQWk.','.kbQkkQWk.','.kbQQQQWk.','.kbQkkQWk.','.kbQQQQWk.','.kWWWWWWk.','.kkkkkkkk.'],
purse: ['...kkkk...','...knnk...','....kk....','...kQQk...','..knnnnk..','.knnOnnnk.','.knOOOnnk.','.knnOnnnk.','..kbbbbk..','...kkkk...'],
clock: ['...kkkk...','..kQQQQk..','.kQQkQQQk.','kQQQkQQQQk','kQQQkkkQQk','kQQQQQQQQk','kQQQQQQQQk','.kQQQQQQk.','..kQQQQk..','...kkkk...'],
pause: ['..........','.kkk..kkk.','.kQk..kQk.','.kQk..kQk.','.kQk..kQk.','.kQk..kQk.','.kQk..kQk.','.kPk..kPk.','.kkk..kkk.','..........'],
play: ['..k.......','..kk......','..kQk.....','..kQQk....','..kQQQk...','..kQQQQk..','..kQQPk...','..kQPk....','..kPk.....','..kk......'],
'arrow-right': ['.....k....','.....kk...','.....kQk..','.kkkkkQQk.','.kQQQQQQQk','.kPPPPQQk.','.kkkkkQk..','.....kk...','.....k....','..........'],
'arrow-up-right': ['..kkkkkkk.','..kQQQQQk.','...kkkkQk.','.....kQQk.','....kQkQk.','...kQkkkk.','..kQk.....','.kQk......','..k.......','..........'],
close: ['..........','.kk....kk.','.kQk..kQk.','..kQkkQk..','...kQQk...','...kQQk...','..kQkkQk..','.kPk..kPk.','.kk....kk.','..........'],
question: ['...kkkk...','..kQQQQk..','.kQkkkkQk.','..kk..kQk.','.....kQk..','....kQk...','....kk....','..........','....kk....','....kk....'],
gear: ['...kkkk...','.kkkssk kk.'.replace(' ',''),'.kssssssk.','kksskksskk','ksskQQkssk','ksskQQkssk','kksskksskk','.kssssssk.','.kkksskkk.','...kkkk...'],
book: ['..........','.kkkkkkkk.','kQQQkQQQQk','kQkkkQkkQk','kQQQkQQQQk','kQkkkQkkQk','kQQQkQQQQk','kPPPkPPPPk','.kkkkkkkk.','..........'],
scroll: ['.kkkkkkk..','kQQQQQQQk.','kQkkkkkkk.','.kQQkkQk..','.kQQQQQk..','.kQkkQQk..','.kQQQQQk..','.kkkkkkQk.','..kPPPPPk.','...kkkkk..'],
bell: ['....kk....','...kOOk...','..kOnnOk..','..kOnnOk..','..kOnnOk..','..kOnnOk..','.kOOOOOOk.','.kkkkkkkk.','....kk....','..........'],
check: ['..........','........k.','.......kYk','......kYk.','.k...kYk..','kYk.kYk...','.kYkYk....','..kYk.....','...k......','..........'],
warning: ['....kk....','...kOOk...','...kOOk...','..kOkkOk..','..kOkkOk..','.kOOkkOOk.','.kOOOOOOk.','kOOOkkOOOk','kOOOOOOOOk','.kkkkkkkk.'],
'sound-on': ['..........','...k...k..','..kQk...k.','.kkQk.k..k','.kQQk..k.k','.kQQk..k.k','.kkQk.k..k','..kPk...k.','...k...k..','..........'],
'sound-off': ['..........','...k......','..kQk.k.k.','.kkQk..k..','.kQQk.k.k.','.kQQk.....','.kkQk.....','..kPk.....','...k......','..........'],
save: ['.kkkkkkkk.','.kWQQQQWk.','.kWQkkQWk.','.kWQQQQWk.','.kWWWWWWk.','.kWkkkkWk.','.kWkQQkWk.','.kWkQQkWk.','.kWWWWWWk.','.kkkkkkkk.'],
home: ['....kk....','...krrk...','..krorrk..','.krorrrrk.','krrrrrrrrk','.kkkkkkkk.','.kQkkQQQk.','.kQWkQ9Qk.','.kQWkQQQk.','.kkkkkkkk.'],
cross: ['...kkkk...','...krrk...','...krrk...','kkkkrrkkkk','krrrrrrrrk','krrrrrrrrk','kkkkrrkkkk','...krrk...','...krrk...','...kkkk...'],
briefcase: ['...kkkk...','...kWWk...','.kkkkkkkk.','.knnnnnnk.','.knnnnnnk.','.kWWWQWWk.','.knnnQnnk.','.knnnnnnk.','.kbbbbbbk.','.kkkkkkkk.'],
bank: ['....kk....','...kOOk...','..kOOOOk..','.kkkkkkkk.','..kQkQkQk.','..kQkQkQk.','..kQkQkQk.','..kPkPkPk.','.kzzzzzzk.','.kkkkkkkk.'],
basket: ['...kkkk...','..kW..Wk..','..kW..Wk..','.kkkkkkkk.','knnnnnnnnk','.kWnWnWnk.','.knWnWnWk.','..kWnWnk..','..kbbbbk..','...kkkk...'],
quill: ['......kk..','.....kQQk.','....kQQPk.','...kQQPk..','..kQQPk...','..kQPk....','...kk.....','..kk......','.kk.......','kk........'],
star: ['....kk....','....kOk...','...kOOk...','.kkkOOkkk.','kOOOOOOOOk','.kOOOOOOk.','..kOOOOk..','..kOkkOk..','.kOk..kOk.','..k....k..'],
}
for (const [name, rows] of Object.entries(icons)) {
  grid(`icons/${name}`, rows)
  // A separately authored menu canvas keeps the 10px glyph on whole art pixels.
  grid(`icons/${name}-16`, ['................','................','................', ...rows.map(row => `...${row}...`), '................','................','................'])
}
const pointer = ['k...........','kk..........','kQk.........','kQQk........','kQQQk.......','kQQQQk......','kQQQQQk.....','kQQQkkkk....','kQQkQk......','kQk.kQk.....','kk..kQk.....','.....k......']
const hand = ['....kk......','...kQQk.....','...kQQk.....','...kQQkkk...','...kQQkQQkk.','...kQQQQQQQk','.kkkQQQQQQQk','kQQQQQQQQQQk','.kQQQQQQQQPk','..kQQQQQQPk.','...kPPPPPk..','....kkkkk...']
for (const [name, rows] of [['pointer',pointer],['hand',hand]]) grid(`cursor/${name}`, rows.flatMap(row => { const doubled = [...row].map(key => key + key).join(''); return [doubled, doubled] }))
console.log('Authored UI grids.')
