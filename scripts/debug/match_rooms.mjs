// Match creation order to final sorted rooms
const creationOrder = [
  {pos: '(47,14)', size: '3x2', desc: 'xabs=47, yabs=14, dx=3, dy=2'},
  {pos: '(12,12)', size: '4x4', desc: 'xabs=12, yabs=12, dx=4, dy=4'},
  {pos: '(46,11)', size: '5x2', desc: 'xabs=46, yabs=11, dx=5, dy=2'},
  {pos: '(67,4)', size: '4x2', desc: 'xabs=67, yabs=4, dx=4, dy=2'},
  {pos: '(59,15)', size: '7x3', desc: 'xabs=59, yabs=15, dx=7, dy=3'},
  {pos: '(9,2)', size: '8x2', desc: 'xabs=9, yabs=2, dx=8, dy=2'},
];

const finalOrder = [
  'Room 0: (9,2)-(17,4) size=9x3',
  'Room 1: (12,12)-(16,16) size=5x5', 
  'Room 2: (26,2)-(33,6) size=8x5',
  'Room 3: (46,11)-(51,13) size=6x3',
  'Room 4: (47,3)-(50,4) size=4x2',
  'Room 5: (59,15)-(66,18) size=8x4',
  'Room 6: (67,4)-(71,6) size=5x3',
  'Room 7: (32,14)-(33,15) size=2x2', // vault
];

console.log('Creation order vs Final sorted order:');
creationOrder.forEach((c, i) => {
  console.log(`Created #${i}: ${c.pos} ${c.size} → Final: ${finalOrder[i]}`);
});
