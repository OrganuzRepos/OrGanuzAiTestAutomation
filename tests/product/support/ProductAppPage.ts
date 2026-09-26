import type { Locator, Page } from '@playwright/test';
import type {
  ProductPersona,
  PropertyCharacterizationData,
} from '../../../src/types/productMatrix.types';
import { ProductAccountPage } from './pages/ProductAccountPage';
import { ProductAuthPage } from './pages/ProductAuthPage';
import { ProductRegistrationPage } from './pages/ProductRegistrationPage';
import { ProductResultsPage } from './pages/ProductResultsPage';
import { ProductRuntimeIdsReader } from './pages/ProductRuntimeIdsReader';
import { ProductShellPage } from './pages/ProductShellPage';
import { ProductWizardPage } from './pages/ProductWizardPage';
import type {
  NewCustomerAccount,
  ProductCredentials,
  ProductRuntimeIds,
} from './product-page.types';

// Preserve the existing import surface while responsibilities live in focused sub-pages.
export type {
  NewCustomerAccount,
  ProductCredentials,
  ProductRuntimeIds,
} from './product-page.types';
export { OtpUnavailableError, AppUnavailableError, APP_UNAVAILABLE_REASON } from './errors';

export interface ProductAppPageDeps {
  shell: ProductShellPage;
  auth: ProductAuthPage;
  registration: ProductRegistrationPage;
  account: ProductAccountPage;
  wizard: ProductWizardPage;
  results: ProductResultsPage;
  runtimeIds: ProductRuntimeIdsReader;
}

/**
 * Compatibility facade for the product application.
 *
 * Existing flows can keep calling the historical ProductAppPage API, while each domain is
 * implemented by a focused page object: shell, auth, registration, account, and wizard.
 * New code may use the public sub-pages directly when it needs a narrower dependency.
 */
export class ProductAppPage {
  readonly shell: ProductShellPage;
  readonly auth: ProductAuthPage;
  readonly registration: ProductRegistrationPage;
  readonly account: ProductAccountPage;
  readonly wizard: ProductWizardPage;
  readonly results: ProductResultsPage;
  readonly runtimeIds: ProductRuntimeIdsReader;

  readonly registrationSubmitButton: Locator;
  readonly registrationTermsCheckbox: Locator;
  readonly registrationOptionalConsentCheckbox: Locator;
  readonly userMenuButton: Locator;
  readonly loginEntryPoint: Locator;

  constructor(deps: ProductAppPageDeps) {
    this.shell = deps.shell;
    this.runtimeIds = deps.runtimeIds;
    this.wizard = deps.wizard;
    this.results = deps.results;
    this.auth = deps.auth;
    this.registration = deps.registration;
    this.account = deps.account;

    this.registrationSubmitButton = this.registration.submitButton;
    this.registrationTermsCheckbox = this.registration.termsCheckbox;
    this.registrationOptionalConsentCheckbox = this.registration.optionalConsentCheckbox;
    this.userMenuButton = this.account.userMenuButton;
    this.loginEntryPoint = this.auth.loginEntryPoint;
  }

  async login(credentials: ProductCredentials): Promise<ProductRuntimeIds> {
    return this.auth.login(credentials);
  }

  async openCustomerRegistration(): Promise<void> {
    await this.registration.openCustomerRegistration();
  }

  async fillCustomerRegistrationFields(account: NewCustomerAccount): Promise<void> {
    await this.registration.fillCustomerFields(account);
  }

  async acceptRegistrationTerms(): Promise<void> {
    await this.registration.acceptTerms();
  }

  async submitCustomerRegistration(otpCode: string): Promise<void> {
    await this.registration.submitCustomerRegistration(otpCode);
  }

  async openSolarCompanyRegistration(): Promise<Page> {
    return this.registration.openSolarCompanyRegistration();
  }

  async createProject(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    return this.wizard.createProject(data);
  }

  async advanceAutoDetectedRoof(): Promise<ProductRuntimeIds> {
    return this.wizard.advanceAutoDetectedRoof();
  }

  captureRoofRuntimeIds(): ProductRuntimeIds {
    return this.wizard.captureRoofRuntimeIds();
  }

  async characterizeRoof(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    return this.wizard.characterizeRoof(data);
  }

  async expectInsufficientPanelsModal(): Promise<void> {
    await this.wizard.expectInsufficientPanelsModal();
  }

  async answerFunding(data: PropertyCharacterizationData): Promise<ProductRuntimeIds> {
    return this.results.answerFunding(data);
  }

  async expectPostFundingDestination(persona: ProductPersona): Promise<void> {
    await this.results.expectPostFundingDestination(persona);
  }

  async openQuotationsFromResults(): Promise<void> {
    await this.results.openQuotationsFromResults();
  }

  async downloadOwnQuotation(): Promise<void> {
    await this.results.downloadOwnQuotation();
  }

  async expectAccessBlocked(path: string): Promise<void> {
    await this.results.expectAccessBlocked(path);
  }

  captureRuntimeIds(): ProductRuntimeIds {
    return this.runtimeIds.capture();
  }

  async openUserMenu(): Promise<void> {
    await this.account.openUserMenu();
  }

  async openPersonalArea(): Promise<void> {
    await this.account.openPersonalArea();
  }

  async openSidebarEntry(name: string | RegExp): Promise<void> {
    await this.account.openSidebarEntry(name);
  }

  async logout(): Promise<void> {
    await this.account.logout();
  }

  async expectLoggedOut(): Promise<void> {
    await this.account.expectLoggedOut();
  }

  async isAppShellLoaded(): Promise<boolean> {
    return this.shell.isLoaded();
  }

  async currentLanguage(): Promise<string> {
    return this.shell.currentLanguage();
  }

  async switchToEnglish(): Promise<void> {
    await this.shell.switchToEnglish();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }
}
