// The program the end to end tests debug (the shape of xo's own debug
// tests, so its variables are not folded away): a breakpoint at line 4,
// in add's loop, first sees s = 0; it prints total 166.
module.exports.MAIN = `fn add(a: Int, b: Int) -> Int {
  var s = 0
  for i in 0..b {
    s += a + i
  }
  s
}

fn main(os: Os) {
  let n = os.env.args().len() + 4
  let total = add(n * 10, n)
  os.stdio.println("total \${total}")
}
`;
// HOVER is a position (0 based) on add in main's call.
module.exports.HOVER = { line: 10, character: 15 };
module.exports.BREAK_LINE = 4;
module.exports.OUTPUT = "total 166";
