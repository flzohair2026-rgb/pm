const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const {frame,renderFixture} = require('./preview-updates-print.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
test('report queries, filters, statuses, dates and summary calculations remain unchanged',()=>{
 const source=ts.createSourceFile('updates.tsx',fs.readFileSync('src/app/(app)/(main)/reports/updates/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const printer=ts.createPrinter({removeComments:true});const print=node=>printer.printNode(ts.EmitHint.Unspecified,node,source);
 const fn=source.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='UpdatesReportPage');
 const actual={logic:hash(fn.body.statements.filter(s=>!ts.isReturnStatement(s)).map(print).join('\n'))};
 function visit(node){if(ts.isJsxElement(node)){const cls=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='className');if(cls?.initializer&&ts.isStringLiteral(cls.initializer)&&['p-grid','p-summary','p-head'].includes(cls.initializer.text))actual[cls.initializer.text]=hash(print(node));}ts.forEachChild(node,visit);}
 visit(fn);assert.deepEqual(actual,JSON.parse(fs.readFileSync('scripts/fixtures/updates-print-content.json','utf8')));
});
test('all unit cards, future details and model summaries remain in print output',()=>{
 const html=renderFixture(107);
 assert.equal((html.match(/class="p-card /g)||[]).length,107);
 assert(html.includes('U-0107'));assert(html.includes('محجوزة مستقبلاً'));assert(html.includes('ملخص حسب نوع النموذج'));
 assert(html.includes('متاح'));assert(html.includes('تنظيف'));
});
test('print has an A4 landscape frame and never uses cropping to enforce one page',()=>{
 assert(frame.updatesPrintStyles.includes('@page updates-report { size: A4 landscape; margin: 8mm; }'));
 assert(frame.updatesPrintStyles.includes('height: 193mm'));
 assert(!frame.updatesPrintStyles.includes('overflow: hidden'));
 assert(!frame.updatesPrintStyles.includes('line-clamp'));
});
