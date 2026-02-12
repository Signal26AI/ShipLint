/**
 * Tests for PrivateAPIUsageRule
 */
import { PrivateAPIUsageRule } from '../../src/rules/code/private-api-usage';
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

describe('PrivateAPIUsageRule', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) cleanupDir(tempDir);
  });

  it('should detect UIWebView usage', async () => {
    tempDir = makeTempProject({
      'App/ViewController.swift': `
import UIKit

class MyVC: UIViewController {
    var webView: UIWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        webView = UIWebView(frame: view.bounds)
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.includes('UIWebView'))).toBe(true);
    expect(findings[0].severity).toBe(Severity.Critical);
  });

  it('should detect private KVC property access', async () => {
    tempDir = makeTempProject({
      'App/TextField.swift': `
import UIKit

class CustomField: UITextField {
    func setup() {
        let label = value(forKey: "_placeholderLabel") as? UILabel
        label?.textColor = .red
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.includes('Private UIKit Property'))).toBe(true);
  });

  it('should detect NSSelectorFromString with private selectors', async () => {
    tempDir = makeTempProject({
      'App/Hack.swift': `
import UIKit

func doPrivateStuff() {
    let sel = NSSelectorFromString("_privateMethod")
    someObj.perform(sel)
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.title.includes('Private Selector'))).toBe(true);
  });

  it('should NOT flag WKWebView usage', async () => {
    tempDir = makeTempProject({
      'App/WebVC.swift': `
import WebKit

class WebVC: UIViewController {
    var webView: WKWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        webView = WKWebView(frame: view.bounds)
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings.filter(f => f.title.includes('UIWebView'))).toHaveLength(0);
  });

  it('should NOT flag valueForKey with non-private keys', async () => {
    tempDir = makeTempProject({
      'App/Model.swift': `
import Foundation

class MyModel: NSObject {
    @objc var name: String = ""
    
    func getValue() -> String {
        return value(forKey: "name") as? String ?? ""
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings.filter(f => f.title.includes('Private UIKit'))).toHaveLength(0);
  });

  it('should NOT flag comments mentioning UIWebView', async () => {
    tempDir = makeTempProject({
      'App/Migration.swift': `
import WebKit

// We migrated from UIWebView to WKWebView
class WebVC: UIViewController {
    var webView: WKWebView!
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings.filter(f => f.title.includes('UIWebView'))).toHaveLength(0);
  });

  it('should return empty for clean project', async () => {
    tempDir = makeTempProject({
      'App/ViewController.swift': `
import UIKit

class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await PrivateAPIUsageRule.evaluate(context);

    expect(findings).toHaveLength(0);
  });
});
