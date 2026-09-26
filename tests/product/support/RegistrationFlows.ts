import { Page } from '@playwright/test';
import {
  ProductAppPage,
  type NewCustomerAccount,
} from './ProductAppPage';
import { ProductFlows } from './ProductFlows';

/** Dev uses a fixed OTP for phone sign-in; reuse the customer persona's configured code. */
const DEV_FIXED_OTP = process.env.CUSTOMER_OTP_CODE ?? '7777';

/**
 * High-level helper for creating new product-app accounts, kept beside ProductFlows so
 * registration specs stay short. Two intake paths exist in the dev app:
 *
 *  - **Property owner (customer)** — a self-serve in-app form (name + phone + email +
 *    terms) followed by the same phone-OTP step as login. `registerCustomer` drives it
 *    end to end and leaves the context authenticated as a new "בעל נכס".
 *  - **Solar company / entrepreneur (company + consultant)** — NOT self-serve: their
 *    "הירשמו כאן" opens the marketing-site contact/lead form (organuz.ai/#contact).
 *    `openSolarCompanyRegistration` returns that page for the caller to assert on.
 *
 * Dev accepts the fixed OTP 7777 for any phone; a unique valid-format phone per run
 * (see `newCustomerAccount`) avoids "already registered" collisions.
 */
export class RegistrationFlows {
  private readonly flows: ProductFlows;
  readonly app: ProductAppPage;

  constructor(
    private readonly page: Page,
    flows: ProductFlows,
  ) {
    this.flows = flows;
    this.app = this.flows.app;
  }

  /**
   * Build a unique, valid-format Israeli property-owner identity for a fresh signup.
   * The `052` prefix is a real mobile prefix and the timestamp tail keeps runs from
   * colliding on an already-registered number. Pass a fixed `seed` for a stable identity.
   */
  static newCustomerAccount(seed: number = Date.now()): NewCustomerAccount {
    const tail = String(seed).slice(-7).padStart(7, '0');
    const phone = `052${tail}`;
    return {
      firstName: 'בדיקה',
      lastName: `אוטומציה ${tail.slice(-4)}`,
      phone,
      email: `qa.reg.${phone}@example.com`,
    };
  }

  /** Open the calculator (unlocking the dev gate) and open the property-owner registration form. */
  async openCustomerRegistrationForm(): Promise<void> {
    await this.flows.openCalculator();
    await this.app.openCustomerRegistration();
  }

  /**
   * Full property-owner signup: open the form, fill it, accept the required terms, submit,
   * complete the OTP, and leave the context authenticated. Like ProductFlows.loginAs, a
   * rate-limited OTP or an unreachable backend is environmental — skip rather than fail.
   */
  async registerCustomer(account: NewCustomerAccount, otpCode: string = DEV_FIXED_OTP): Promise<void> {
    await this.openCustomerRegistrationForm();
    await this.app.fillCustomerRegistrationFields(account);
    await this.app.acceptRegistrationTerms();
    await this.app.submitCustomerRegistration(otpCode);
  }

  /**
   * Open the solar-company / entrepreneur registration and return the contact-form page
   * it opens (organuz.ai/#contact). Used to document that company/consultant onboarding
   * is a lead-capture flow, not an in-app signup.
   */
  async openSolarCompanyRegistration(): Promise<Page> {
    await this.flows.openCalculator();
    return this.app.openSolarCompanyRegistration();
  }
}
