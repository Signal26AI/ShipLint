/**
 * Rule: External Payment for Digital Goods (§3.1.1)
 *
 * Detects Stripe/PayPal/Braintree SDK imports or usage that may violate
 * Apple's In-App Purchase requirement for digital goods.
 * Medium confidence — physical goods payments are allowed.
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeCustomFinding } from '../base.js';
import { findSourceFiles } from '../privacy/required-reason-api.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Payment SDK patterns — imports and usage
 */
const PAYMENT_SDK_PATTERNS: Array<{
  name: string;
  importPatterns: RegExp[];
  usagePatterns: RegExp[];
}> = [
  {
    name: 'Stripe',
    importPatterns: [
      /\bimport\s+Stripe\b/,
      /\bimport\s+StripePaymentSheet\b/,
      /\bimport\s+StripePayments\b/,
      /^\s*#import\s+<Stripe\//m,
      /\bimport\s+StripeTerminal\b/, // Physical POS — should NOT flag
    ],
    usagePatterns: [
      /\bSTPPaymentCardTextField\b/,
      /\bSTPPaymentContext\b/,
      /\bPaymentSheet\b/,
      /\bSTPAPIClient\b/,
      /\bStripeAPI\b/,
    ],
  },
  {
    name: 'PayPal',
    importPatterns: [
      /\bimport\s+PayPal\w*/,
      /\bimport\s+Braintree\w*/,
      /^\s*#import\s+<PayPal\//m,
      /^\s*#import\s+<Braintree\//m,
    ],
    usagePatterns: [
      /\bPayPalCheckout\b/,
      /\bBTPayPalDriver\b/,
      /\bBTPayPalRequest\b/,
    ],
  },
  {
    name: 'Braintree',
    importPatterns: [
      /\bimport\s+BraintreeCore\b/,
      /\bimport\s+BraintreeCard\b/,
      /\bimport\s+BraintreeDropIn\b/,
      /^\s*#import\s+<BraintreeCore\//m,
    ],
    usagePatterns: [
      /\bBTAPIClient\b/,
      /\bBTCardClient\b/,
      /\bBTDropInController\b/,
    ],
  },
  {
    name: 'Square',
    importPatterns: [
      /\bimport\s+SquareInAppPaymentsSDK\b/,
      /\bimport\s+SquareBuyerVerificationSDK\b/,
    ],
    usagePatterns: [
      /\bSQIPCardEntryViewController\b/,
    ],
  },
];

/**
 * Physical goods indicators — reduce confidence if found in same project
 */
const PHYSICAL_GOODS_INDICATORS = [
  /\bshipping\s*address/i,
  /\bdelivery\s*address/i,
  /\bStripeTerminal\b/,
  /\bphysical\s*goods/i,
  /\bshopping\s*cart/i,
  /\bCLLocationManager\b/, // Location for delivery
];

interface PaymentDetection {
  sdk: string;
  file: string;
  isImport: boolean;
}

export const ExternalPaymentRule: Rule = {
  id: 'code-002-external-payment',
  name: 'External Payment for Digital Goods',
  description: 'Detects external payment SDK usage that may violate IAP requirements for digital goods',
  category: RuleCategory.Config,
  severity: Severity.Critical,
  confidence: Confidence.Medium,
  guidelineReference: '3.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Also check dependencies
    const depNames = context.dependencies.map(d => d.name.toLowerCase());
    const hasStripeDep = depNames.some(n => n.includes('stripe') && !n.includes('stripeterminal'));
    const hasPayPalDep = depNames.some(n => n.includes('paypal') || n.includes('braintree'));
    const hasBraintreeDep = depNames.some(n => n.includes('braintree'));
    const hasSquareDep = depNames.some(n => n.includes('squareinapp'));

    const sourceFiles = findSourceFiles(context.projectPath);
    const detections: PaymentDetection[] = [];
    let hasPhysicalIndicators = false;

    for (const file of sourceFiles) {
      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      // Check for physical goods indicators
      for (const pattern of PHYSICAL_GOODS_INDICATORS) {
        if (pattern.test(content)) {
          hasPhysicalIndicators = true;
          break;
        }
      }

      for (const sdk of PAYMENT_SDK_PATTERNS) {
        // Skip StripeTerminal — that's for physical POS
        if (sdk.name === 'Stripe' && /\bimport\s+StripeTerminal\b/.test(content) &&
            !sdk.importPatterns.slice(0, -1).some(p => p.test(content))) {
          continue;
        }

        for (const pattern of sdk.importPatterns) {
          if (pattern.test(content)) {
            // Skip StripeTerminal-only imports
            if (sdk.name === 'Stripe' && /StripeTerminal/.test(content) &&
                !/\bimport\s+Stripe\b/.test(content) &&
                !/\bimport\s+StripePayments\b/.test(content) &&
                !/\bimport\s+StripePaymentSheet\b/.test(content)) {
              continue;
            }
            detections.push({ sdk: sdk.name, file, isImport: true });
            break;
          }
        }

        for (const pattern of sdk.usagePatterns) {
          if (pattern.test(content)) {
            detections.push({ sdk: sdk.name, file, isImport: false });
            break;
          }
        }
      }
    }

    // Also count dependency-level detections
    if (hasStripeDep && !detections.some(d => d.sdk === 'Stripe')) {
      detections.push({ sdk: 'Stripe', file: 'Package.resolved/Podfile.lock', isImport: true });
    }
    if ((hasPayPalDep || hasBraintreeDep) && !detections.some(d => d.sdk === 'PayPal' || d.sdk === 'Braintree')) {
      detections.push({ sdk: 'PayPal/Braintree', file: 'Package.resolved/Podfile.lock', isImport: true });
    }
    if (hasSquareDep && !detections.some(d => d.sdk === 'Square')) {
      detections.push({ sdk: 'Square', file: 'Package.resolved/Podfile.lock', isImport: true });
    }

    if (detections.length === 0) return [];

    const sdkNames = [...new Set(detections.map(d => d.sdk))];
    const files = [...new Set(detections.map(d => path.relative(context.projectPath, d.file)))];

    // Also check if StoreKit is present (has IAP alongside)
    const hasStoreKit = context.hasFramework('StoreKit');

    const confidence = hasPhysicalIndicators ? Confidence.Low : Confidence.Medium;
    const severity = hasPhysicalIndicators ? Severity.Medium : Severity.Critical;

    let description = `External payment SDK(s) detected: ${sdkNames.join(', ')}. `;
    if (hasPhysicalIndicators) {
      description += `Physical goods indicators were also found, so this may be legitimate. `;
    }
    description += `Apple requires In-App Purchase for all digital goods and services. ` +
      `Using external payment processing for digital content will cause rejection.`;

    if (hasStoreKit) {
      description += ` Note: StoreKit is also linked, which suggests IAP may be implemented alongside.`;
    }

    return [makeCustomFinding(this, severity, confidence, {
      title: `External Payment SDK Detected: ${sdkNames.join(', ')}`,
      description,
      location: files[0],
      fixGuidance: 'If selling digital goods/services/subscriptions, you must use Apple In-App Purchase (StoreKit). External payment SDKs are only allowed for physical goods and services performed outside the app.',
      documentationURL: 'https://developer.apple.com/app-store/review/guidelines/#in-app-purchase',
    })];
  },
};
