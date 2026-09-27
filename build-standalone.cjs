const fs = require('fs');
const path = require('path');

const root = __dirname;
const entry = 'src/app.js';
const modules = new Map();

function resolveImport(from, request) {
    let id = path.posix.normalize(path.posix.join(path.posix.dirname(from), request));
    if (!path.posix.extname(id)) id += '.js';
    return id;
}

function importBindings(source) {
    return source.trim().replace(/\bas\b/g, ':');
}

function collect(id) {
    if (modules.has(id)) return;

    const filename = path.join(root, ...id.split('/'));
    let code = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');
    const dependencies = [];

    code = code.replace(
        /^\s*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm,
        function (_match, bindings, request) {
            const dependency = resolveImport(id, request);
            dependencies.push(dependency);
            return 'const { ' + importBindings(bindings) + ' } = __require(' + JSON.stringify(dependency) + ');';
        }
    );

    const exported = new Set();
    let match;

    const functionExports = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm;
    while ((match = functionExports.exec(code))) exported.add(match[1]);

    const classExports = /^\s*export\s+class\s+([A-Za-z_$][\w$]*)/gm;
    while ((match = classExports.exec(code))) exported.add(match[1]);

    const valueExports = /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    while ((match = valueExports.exec(code))) exported.add(match[1]);

    const destructuredExports = /^\s*export\s+(?:const|let|var)\s*\{([^}]+)\}\s*=/gm;
    while ((match = destructuredExports.exec(code))) {
        for (const part of match[1].split(',')) {
            const name = part.trim().split(':')[0].trim();
            if (name) exported.add(name);
        }
    }

    code = code.replace(
        /^\s*export\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/gm,
        ''
    );

    if (/^\s*(?:import|export)\s/m.test(code)) {
        throw new Error('Unsupported module syntax in ' + id);
    }

    modules.set(id, { code, exported: Array.from(exported) });
    dependencies.forEach(collect);
}

collect(entry);

let output = '(function () {\n';
output += "'use strict';\n";
output += 'const __modules = Object.create(null);\n';

for (const [id, module] of modules) {
    output += '__modules[' + JSON.stringify(id) + '] = function (exports, __require) {\n';
    output += module.code + '\n';
    if (module.exported.length) {
        output += 'Object.assign(exports, { ' + module.exported.join(', ') + ' });\n';
    }
    output += '};\n';
}

output += 'const __cache = Object.create(null);\n';
output += 'function __require(id) {\n';
output += '  if (__cache[id]) return __cache[id];\n';
output += '  if (!__modules[id]) throw new Error("Module not found: " + id);\n';
output += '  const exports = {};\n';
output += '  __cache[id] = exports;\n';
output += '  __modules[id](exports, __require);\n';
output += '  return exports;\n';
output += '}\n';
output += '__require(' + JSON.stringify(entry) + ');\n';
output += '})();\n';

fs.writeFileSync(path.join(root, 'app.bundle.js'), output, 'utf8');
console.log('已生成 app.bundle.js（' + modules.size + ' 个模块）');
