export const contractPrintStyles = `
.contract-paper,.contract-paper *{box-sizing:border-box}
.contract-paper{direction:rtl;width:194mm;min-height:270mm;padding:6mm;margin:0 auto;background:#fff;color:#263d32;font-size:11px;line-height:1.55;overflow-wrap:anywhere}
.contract-heading{padding:10px 12px;border:1px solid #cedbd3;border-top:4px solid #204d3b;background:#f4f7f5;margin-bottom:9px}
.contract-heading h1{color:#173d2e;font-size:21px;font-weight:700;margin:0 0 4px}
.contract-heading>div{gap:12px}.contract-heading>div>div:first-child{flex:1;min-width:0}.contract-heading>div>div:last-child{max-width:46%;line-height:1.9}
.contract-heading .rounded-full{border:0;border-radius:0;width:44px;height:44px;flex-shrink:0}.contract-heading img{width:40px;height:40px;object-fit:contain}
.contract-paper>section{border-color:#d2ded6;margin-bottom:7px;border-radius:7px}
.contract-paper>section:first-of-type{gap:14px;padding:8px 10px;background:#fafcfb;break-inside:avoid}
.contract-paper h2,.contract-paper h3{color:#204d3b}
.contract-paper>section:first-of-type h2{font-size:12px;margin-bottom:6px}
.contract-paper>section:first-of-type>div:first-child{font-size:10px;line-height:1.7}
.contract-paper>section:nth-of-type(2){padding:7px 11px;break-inside:avoid}
.contract-paper>section:nth-of-type(2) h2{margin-bottom:4px}
.contract-paper>section:nth-of-type(2) .mt-2{margin-top:4px}
.contract-paper>section:nth-of-type(3){gap:8px}
.contract-paper>section:nth-of-type(3)>div{border-color:#d2ded6}
.contract-paper>section:nth-of-type(3)>div:first-child{padding:10px 11px;background:#f4f8f5;border-inline-start:3px solid #507760;break-inside:avoid}
.contract-paper>section:nth-of-type(3)>div:last-child{gap:10px}
.contract-paper>section:nth-of-type(3)>div:last-child>div{padding:9px 10px;border-color:#d2ded6;break-inside:avoid}
.contract-conditions{padding:10px 12px!important;margin-top:0!important}
.contract-conditions h3{font-size:12px;margin-bottom:7px;padding-bottom:6px;border-bottom:1px solid #dce5df}
.contract-conditions ul{font-size:10.5px!important;line-height:1.55!important}
.contract-conditions li{margin-top:2px;break-inside:avoid}
.contract-paper .contract-signature{margin-top:12px;break-inside:avoid}
.contract-paper .contract-signature-card{padding:0;gap:12px;min-height:80px}
.contract-paper .contract-signature-details{padding:8px;min-width:0}
.contract-paper .contract-signature-marks{flex-shrink:0;margin:1px}
.contract-paper .contract-signature-marks>div{gap:2px}
.contract-paper .contract-signature-marks img,.contract-paper .contract-signature-marks [role='img']{width:76px;height:76px;border:0;border-radius:0;display:block}
.contract-paper .contract-signature-marks svg{display:block;width:100%;height:100%}
.contract-paper .font-mono{font-family:inherit;font-variant-numeric:tabular-nums}
.contract-paper p,.contract-paper span{overflow-wrap:anywhere}
@media print{
 @page{size:A4 portrait;margin:8mm}
 html,body{margin:0!important;padding:0!important;background:#fff!important}
 .contract-paper{width:194mm!important;min-height:0!important;margin:0!important;padding:6mm!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .contract-paper .print\\:hidden{display:none!important}
}
`;
