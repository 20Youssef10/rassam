const fs = require("fs");
const path = "D:/rassam-greenfield/src/styles/app.css";
let s = fs.readFileSync(path, "utf8");
if (!s.includes("icon-dark.svg")) {
  s += `\n.rassam-app.theme-dark .rassam-brand-mark {\n  content: url('/icon-dark.svg');\n}\n`;
  fs.writeFileSync(path, s);
  console.log("dark css added");
} else {
  console.log("dark css present");
}
