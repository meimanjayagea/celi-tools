import assert from "node:assert/strict";
import test from "node:test";
import { CONVERTER_GROUPS, conversionTargets, validateSelection } from "../packages/file-tools/index.mjs";

const enabled = Object.fromEntries([...new Set(CONVERTER_GROUPS.map(group => group.engine))].map(engine => [engine, true]));

test("every advertised source extension has at least one usable conversion target", () => {
  for (const group of CONVERTER_GROUPS) {
    for (const extension of group.inputs) {
      const file = { name: `synthetic.${extension}`, size: 1 };
      const targets = conversionTargets([file.name], enabled);
      assert.ok(targets.length > 0, `${extension} advertises no usable output`);
      assert.equal(validateSelection([file], "convert", targets[0], enabled), "", `${extension} cannot use ${targets[0]}`);
    }
  }
});

test("every advertised source and output pair is accepted by the shared validator", () => {
  for (const group of CONVERTER_GROUPS) {
    for (const extension of group.inputs) {
      const file = { name: `synthetic.${extension}`, size: 1 };
      for (const target of group.outputs.filter(output => output !== extension)) {
        assert.ok(conversionTargets([file.name], enabled).includes(target), `${extension} omits advertised target ${target}`);
        assert.equal(validateSelection([file], "convert", target, enabled), "", `${extension} -> ${target} rejected`);
      }
    }
  }
});

test("multi-file conversion only offers formats supported by every selected file", () => {
  for (const left of CONVERTER_GROUPS) {
    for (const right of CONVERTER_GROUPS) {
      const files = [
        { name: `one.${left.inputs[0]}`, size: 1 },
        { name: `two.${right.inputs[0]}`, size: 1 },
      ];
      const common = left.outputs.filter(target => target !== left.inputs[0] && right.outputs.includes(target) && target !== right.inputs[0]);
      assert.deepEqual(conversionTargets(files.map(file => file.name), enabled), common, `${left.id} + ${right.id}`);
    }
  }
});
