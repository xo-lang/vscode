// The program the end to end tests debug: a breakpoint at line 3 sees s = 42.
module.exports.MAIN = `fn add(a: Int, b: Int) -> Int {
  let s = a + b
  s
}

fn main() {
  let total = add(40, 2)
  os.stdio.println("total \${total}")
}
`;
