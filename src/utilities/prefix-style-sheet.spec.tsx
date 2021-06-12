import { prefixStyleSheet } from "./prefix-style-sheet";

test("can prefix styles with a specific selector", () => {
  const styles = `
li {
  color: red;
}`;

  expect(prefixStyleSheet(".container")(styles)).toMatchInlineSnapshot(`
"
.container li {
  color: red;
}"
`);
});
