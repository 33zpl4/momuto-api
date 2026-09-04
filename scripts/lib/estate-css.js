'use strict';
// Shared CSS for the generated estate pages (FAQ, shipping policy). Written per
// docs/cms-page-gotchas.md: title-hide rule, body paint, .mo-editor-reset
// centering companions, qualified-!important lists.
module.exports = `
.title, .page-title { display: none !important; }
:root { --bg:#0a0a0a; --panel:#111; --border:rgba(255,255,255,0.07); --white:#f5f5f5; --muted:#a1a1aa; --dim:#71717a; --red:#c8352e; --red-h:#e04038; --fd:'Bebas Neue',sans-serif; --fb:'Outfit',sans-serif; }
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
body{font-family:var(--fb);font-weight:300;background:var(--bg);color:var(--white);line-height:1.65;overflow-x:hidden}
h1,h2,h3{font-family:var(--fd);font-weight:400;text-transform:uppercase;letter-spacing:.03em;line-height:1}
.acc{color:var(--red)}
.faqpage{margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.wrap{max-width:1060px;margin:0 auto;padding:0 1.5rem}
.hero{padding:5rem 1.5rem 3.5rem;text-align:center;background:radial-gradient(circle at 50% 0%,#1a1a1a 0%,var(--bg) 70%);border-bottom:1px solid var(--border)}
.badge{background:rgba(200,53,46,.1);border:1px solid rgba(200,53,46,.18);color:var(--red);font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.14em;padding:6px 14px;display:inline-block;margin-bottom:1.4rem}
.h1{font-size:clamp(2.6rem,6vw,4.2rem);max-width:880px;margin:0 auto 1.2rem}
.sub{color:var(--muted);font-size:1rem;max-width:660px;margin:0 auto;text-align:center}
.mo-editor-reset .sub{margin-inline:auto}
.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;max-width:1060px;margin:2.4rem auto 0;padding:0 1.5rem;text-align:left}
.mo-editor-reset .quick{margin-inline:auto}
.q{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:18px 20px}
.q .k{font-family:var(--fd);font-size:1.7rem;color:var(--white);line-height:1;letter-spacing:.02em}
.q .l{font-size:.78rem;color:var(--muted);margin-top:8px;line-height:1.5}
nav.faqnav{position:sticky;top:0;z-index:5;background:rgba(10,10,10,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
nav.faqnav ul{list-style:none !important;margin:0 auto !important;padding:0 1rem !important;max-width:1060px;display:flex !important;gap:.2rem;overflow-x:auto;scrollbar-width:none}
nav.faqnav ul::-webkit-scrollbar{display:none}
nav.faqnav li{list-style:none !important;display:block !important;flex-shrink:0}
nav.faqnav li::marker{content:none}
nav.faqnav a{display:block;padding:14px 12px;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap}
nav.faqnav a:hover{color:var(--white);border-color:var(--red)}
.sec{padding:3.5rem 0;scroll-margin-top:60px}
.sec h2{font-size:clamp(1.8rem,4vw,2.4rem);margin-bottom:.4rem}
.sec .lead{color:var(--muted);max-width:720px;margin:0 0 1.8rem;font-size:.95rem}
.sec.alt{background:var(--panel);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.faq details{border-top:1px solid rgba(255,255,255,.1)}
.faq details:last-child{border-bottom:1px solid rgba(255,255,255,.1)}
.faq summary{list-style:none;cursor:pointer;padding:18px 4px;font-size:1rem;font-weight:600;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';font-size:24px;color:var(--red);font-weight:300;line-height:1;flex-shrink:0}
.faq details[open] summary::after{content:'\\2013'}
.faq .a{margin:0 4px 18px;font-size:.9rem;color:var(--muted);line-height:1.7;max-width:820px}
.faq .a b{color:#e5e5e5;font-weight:600}
.faq .a a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
.tablewrap{overflow-x:auto;border:1px solid var(--border);background:var(--panel)}
table.ladder{width:100%;border-collapse:collapse;min-width:560px;font-size:.92rem}
table.ladder th{font-family:var(--fd);font-weight:400;font-size:1rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);text-align:left;padding:14px 16px;border-bottom:1px solid var(--border)}
table.ladder td{padding:13px 16px;border-bottom:1px solid var(--border);color:var(--white)}
table.ladder tr:last-child td{border-bottom:none}
table.ladder td:first-child{color:var(--muted)}
table.ladder tr.pop td{background:rgba(200,53,46,.08);color:#fff;font-weight:600}
table.ladder .pill{display:inline-block;margin-left:8px;background:var(--red);color:#fff;font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;vertical-align:middle}
ul.notes{list-style:none !important;margin:1.4rem 0 0 !important;padding:0 !important;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px 24px}
ul.notes > li{display:flex !important;list-style:none !important;gap:.6rem;align-items:flex-start;font-size:.86rem;color:var(--muted);line-height:1.55}
ul.notes > li::marker{content:none}
ul.notes > li .ck{color:var(--red);font-weight:700;flex-shrink:0}
ul.notes b{color:#e5e5e5;font-weight:600}
.btn{display:inline-block;background:var(--red);color:#fff;padding:16px 40px;font-weight:700;font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid var(--red);transition:all .2s}
.btn:hover{background:var(--red-h);transform:translateY(-2px)}
.btn2{display:inline-block;background:transparent;color:var(--white);border:1px solid rgba(255,255,255,.18);padding:14px 34px;font-weight:600;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;transition:all .2s;margin-left:.6rem}
.btn2:hover{border-color:var(--red);color:var(--red)}
.cta-end{padding:4.5rem 1.5rem;text-align:center;background:var(--panel);border-top:1px solid var(--border)}
.cta-end h2{font-size:clamp(2rem,4vw,2.8rem);margin-bottom:1rem}
.cta-end p{color:var(--muted);max-width:560px;margin:0 auto 2rem;font-size:.95rem}
.mo-editor-reset .cta-end p{margin-inline:auto}
.more{padding:2.5rem 1.5rem;text-align:center;font-size:.85rem;color:var(--dim)}
.more a{color:var(--muted)}
@media(max-width:520px){.btn2{margin-left:0;margin-top:.8rem}}
`;
