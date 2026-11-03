const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline = JSON.parse(fs.readFileSync('scripts/fixtures/booking-details-ui-behavior.json', 'utf8'));
// Direct receipt/contract printing intentionally replaces these print handlers
// and adds dialog state. Keep the frozen checks for every other action.
const currentSource = fs.readFileSync('src/components/bookings/BookingDetails.tsx', 'utf8');
assert.ok(currentSource.includes('onClick={() => setReceiptPrintId(paymentId)}'));
const baselineSource = currentSource
  .replace('  const [contractPrintOpen, setContractPrintOpen] = useState(false);', '')
  .replace(/\s*\{contractPrintOpen && <ContractPrintDialog[^\n]+\n/, '\n')
  .replaceAll('onClick={() => setContractPrintOpen(true)}', "onClick={() => openPrintPreview('طباعة العقد', `/print/contract/${booking.id}?embed=1`)}")
  .replace('  const [receiptPrintId, setReceiptPrintId] = useState<string | null>(null);', '')
  .replace(/\s*\{receiptPrintId && <ReceiptPrintDialog[^\n]+\n/, '\n')
  .replace('onClick={() => setReceiptPrintId(paymentId)}', "onClick={() => openPrintPreview('طباعة سند القبض', `/print/receipt/${paymentId}?embed=1`)}");
const source = ts.createSourceFile('BookingDetails.tsx', baselineSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter({ removeComments: true });
const print = node => printer.printNode(ts.EmitHint.Unspecified, node, source);
const main = source.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'BookingDetails');
test('design changes preserve every calculation, request, effect and action function', () => {
  const logic = main.body.statements.filter(s => !ts.isReturnStatement(s)).map(print);
  assert.equal(hash(logic), baseline.logic);
});
test('all existing event handlers, disabled states, links and their visibility conditions remain unchanged', () => {
  const controls = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && /^(on[A-Z]|disabled$|href$)/.test(node.name.getText(source))) {
      const conditions = [];
      let parent = node.parent;
      while (parent && parent !== main) {
        if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) conditions.push(print(parent.left));
        if (ts.isConditionalExpression(parent)) conditions.push(print(parent.condition));
        parent = parent.parent;
      }
      controls.push({ attribute: print(node), conditions });
    }
    ts.forEachChild(node, visit);
  }
  visit(main);
  assert.equal(controls.length, baseline.controlCount);
  assert.equal(hash(controls), baseline.controls);
});
