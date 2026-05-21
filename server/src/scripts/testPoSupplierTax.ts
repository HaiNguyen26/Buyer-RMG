import {
  applySupplierTaxCodeOnPoApproval,
  effectiveSupplierTaxCode,
  trimSupplierTaxCode,
} from '../utils/poSupplierTax';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(trimSupplierTaxCode('  0123  ') === '0123', 'trim');
assert(effectiveSupplierTaxCode('M1', 'M2') === 'M1', 'master wins');
assert(effectiveSupplierTaxCode('', 'M2') === 'M2', 'po fallback');
assert(effectiveSupplierTaxCode(null, '  ') === null, 'empty');

let updated = false;
const fakeTx = {
  supplier: {
    update: async () => {
      updated = true;
    },
  },
} as any;

async function run() {
  await applySupplierTaxCodeOnPoApproval(fakeTx, 's1', null, 'NEW-TAX');
  assert(updated, 'should update when master empty');

  updated = false;
  await applySupplierTaxCodeOnPoApproval(fakeTx, 's1', 'EXISTING', 'NEW-TAX');
  assert(!updated, 'should not overwrite master');

  console.log('testPoSupplierTax: OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
