/**
 * Tests for DynamicCodeExecutionRule
 */
import { DynamicCodeExecutionRule } from '../../src/rules/code/dynamic-code-execution';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTempProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-test-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return dir;
}

function cleanupDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('DynamicCodeExecutionRule', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) cleanupDir(tempDir);
  });

  it('should detect JSContext.evaluateScript', async () => {
    tempDir = makeTempProject({
      'App/JSRunner.swift': `
import JavaScriptCore

class JSRunner {
    func run() {
        let ctx = JSContext()
        ctx.evaluateScript("alert('hello')")
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await DynamicCodeExecutionRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.includes('JavaScript'))).toBe(true);
  });

  it('should detect dlopen', async () => {
    tempDir = makeTempProject({
      'App/Loader.swift': `
import Foundation

func loadLib() {
    let handle = dlopen("/usr/lib/libc.dylib", RTLD_LAZY)
    let sym = dlsym(handle, "printf")
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await DynamicCodeExecutionRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.includes('dlopen') || f.title.includes('Dynamic Library'))).toBe(true);
  });

  it('should detect suspicious NSClassFromString', async () => {
    tempDir = makeTempProject({
      'App/Hack.swift': `
import Foundation

func loadClass() {
    let cls = NSClassFromString("MyDynamicPlugin")
    let instance = (cls as? NSObject.Type)?.init()
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await DynamicCodeExecutionRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.includes('NSClassFromString'))).toBe(true);
  });

  it('should NOT flag NSClassFromString with standard UIKit classes', async () => {
    tempDir = makeTempProject({
      'App/Router.swift': `
import UIKit

func resolveVC(_ name: String) -> UIViewController? {
    let cls = NSClassFromString("UIViewController") as? UIViewController.Type
    return cls?.init()
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await DynamicCodeExecutionRule.evaluate(context);

    expect(findings.filter(f => f.title.includes('NSClassFromString'))).toHaveLength(0);
  });

  it('should NOT flag NSClassFromString with NS-prefixed classes', async () => {
    tempDir = makeTempProject({
      'App/Check.swift': `
import Foundation

func check() {
    let cls = NSClassFromString("NSURLSession")
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await DynamicCodeExecutionRule.evaluate(context);

    expect(findings.filter(f => f.title.includes('NSClassFromString'))).toHaveLength(0);
  });

  it('should return empty for clean project', async () => {
    tempDir = makeTempProject({
      'App/ViewController.swift': `
import UIKit

class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await DynamicCodeExecutionRule.evaluate(context);

    expect(findings).toHaveLength(0);
  });
});
