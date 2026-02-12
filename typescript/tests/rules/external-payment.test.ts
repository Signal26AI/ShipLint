/**
 * Tests for ExternalPaymentRule
 */
import { ExternalPaymentRule } from '../../src/rules/code/external-payment';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, DependencySource } from '../../src/types';
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

describe('ExternalPaymentRule', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) cleanupDir(tempDir);
  });

  it('should detect Stripe import in source', async () => {
    tempDir = makeTempProject({
      'App/Payment.swift': `
import Stripe

class PaymentVC: UIViewController {
    func pay() {
        let card = STPPaymentCardTextField()
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await ExternalPaymentRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('Stripe');
    expect(findings[0].severity).toBe(Severity.Critical);
  });

  it('should detect Stripe from dependencies', async () => {
    tempDir = makeTempProject({
      'App/ViewController.swift': `
import UIKit

class ViewController: UIViewController {}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), [
      { name: 'Stripe', version: '23.0.0', source: DependencySource.CocoaPods },
    ]);
    const findings = await ExternalPaymentRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('Stripe');
  });

  it('should reduce severity when physical goods indicators present', async () => {
    tempDir = makeTempProject({
      'App/Payment.swift': `
import Stripe

class PaymentVC: UIViewController {
    func pay() {
        let card = STPPaymentCardTextField()
    }
}
`,
      'App/Checkout.swift': `
import UIKit

class CheckoutVC: UIViewController {
    let shippingAddress = "Enter shipping address"
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await ExternalPaymentRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe(Severity.Medium);
  });

  it('should NOT flag StripeTerminal only', async () => {
    tempDir = makeTempProject({
      'App/POS.swift': `
import StripeTerminal

class POSController {
    func setupTerminal() {
        Terminal.shared.discoverReaders()
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await ExternalPaymentRule.evaluate(context);

    // StripeTerminal is for physical POS, should not flag
    const stripeFindings = findings.filter(f => f.title.includes('Stripe'));
    expect(stripeFindings).toHaveLength(0);
  });

  it('should return empty for clean project', async () => {
    tempDir = makeTempProject({
      'App/ViewController.swift': `
import UIKit
import StoreKit

class ViewController: UIViewController {
    func purchaseItem() {
        // Using IAP properly
    }
}
`,
    });

    const context = createContextObject(tempDir, {}, {}, new Set(), []);
    const findings = await ExternalPaymentRule.evaluate(context);

    expect(findings).toHaveLength(0);
  });
});
