const fs = require("fs");
const p = "D:/rassam-greenfield/src/styles/app.css";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  /\.rassam-app\.is-viewonly \.rassam-toolbar \{[^}]*\}/,
  "/* view-only keeps toolbar; Editor blocks drawing */",
);
s = s.replace(
  /\.rassam-app\.is-viewonly \.rassam-stage-tools \{[^}]*\}/,
  ".rassam-app.is-viewonly .rassam-stage-tools {\n  opacity: 0.55;\n}",
);
if (!s.includes(".rassam-hex-picker")) {
  s += `
.rassam-hex-picker { display:flex; align-items:center; gap:6px; font-size:12px; }
.rassam-hex-picker input[type="color"] { width:36px; height:32px; border:none; background:transparent; padding:0; }
.rassam-hex-picker input[type="text"] { width:88px; min-height:32px; border-radius:8px; border:1px solid var(--border); padding:4px 8px; background:var(--surface-raised); color:var(--text); }
.rassam-comments-layer { position:absolute; inset:0; pointer-events:none; z-index:6; }
.rassam-comment-pin { position:absolute; pointer-events:auto; width:22px; height:22px; border-radius:50%; background:#2563EB; color:#fff; font-size:12px; display:grid; place-items:center; transform:translate(-50%,-50%); cursor:pointer; border:none; }
.rassam-history-panel { position:fixed; inset-block-end:48px; inset-inline-start:40%; z-index:46; width:min(300px,90vw); background:var(--surface-raised); border:1px solid var(--border); border-radius:12px; padding:10px; box-shadow:var(--shadow); font-size:13px; }
.rassam-history-panel ul { list-style:none; margin:0; padding:0; display:grid; gap:4px; max-height:200px; overflow:auto; }
.rassam-export-pop { display:flex; gap:6px; flex-wrap:wrap; }
`;
}
fs.writeFileSync(p, s);
console.log("css patched", s.includes("view-only keeps toolbar"));
