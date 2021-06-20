import { processUserStyleSheet } from "./process-user-style-sheet";

test("can prefix styles with a specific selector", async () => {
  const styles = `
li {
  color: red;
}

* {
  color: blue;
}`;

  expect(await processUserStyleSheet({ selectorScope: ".container" })(styles))
    .toMatchInlineSnapshot(`
    Array [
      ".container li {
      color: red;
    }",
      ".container * {
      color: blue;
    }",
    ]
  `);
});
