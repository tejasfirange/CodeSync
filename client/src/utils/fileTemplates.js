const templates = {
  javascript: `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('CodeSync'));
`,
  python: `def greet(name):
    return f"Hello, {name}!"

print(greet("CodeSync"))
`,
  c: `#include <stdio.h>

int main() {
    printf("Hello, CodeSync!\\n");
    return 0;
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, CodeSync!" << endl;
    return 0;
}
`,
  markdown: '# New File\n',
  plaintext: ''
};

export const detectLanguageFromPath = (path = '') => {
  const extension = String(path).split('.').pop()?.toLowerCase();
  if (extension === 'js') return 'javascript';
  if (extension === 'py') return 'python';
  if (extension === 'c') return 'c';
  if (['cpp', 'cc', 'cxx'].includes(extension)) return 'cpp';
  if (extension === 'md') return 'markdown';
  if (extension === 'txt') return 'plaintext';
  return 'javascript';
};

export const getFileTemplate = (path = '', language) => templates[language || detectLanguageFromPath(path)] ?? templates.plaintext;
