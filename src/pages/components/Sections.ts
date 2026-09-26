import { Page, Locator, expect } from '@playwright/test';
import { selfHeal } from '../../utils/selfHeal';
import { marketingText as T } from '../../i18n/marketing';
import { allureStep } from '../../utils/allure';

/** Sub-page-object for the "Why Organuz" section: heading + audience tabs. */
export class WhySection {
  readonly heading: Locator;
  readonly tabPropertyOwners: Locator;
  readonly tabSolarCompanies: Locator;
  readonly tabAuthoritiesCorp: Locator;
  readonly tabInvestors: Locator;

  constructor(page: Page) {
    const t = T.why;
    this.heading = selfHeal(
      page.getByRole('heading', { name: t.heading }),
      page.getByRole('heading', { name: /למה Organuz/ }),
    ).first();
    const tab = (name: string, re: RegExp) =>
      selfHeal(page.getByRole('button', { name }), page.getByRole('button', { name: re }));
    this.tabPropertyOwners = tab(t.tabs.propertyOwners, /בעלי נכסים/);
    this.tabSolarCompanies = tab(t.tabs.solarCompanies, /חברות סולאריות/);
    this.tabAuthoritiesCorp = tab(t.tabs.authoritiesCorp, /רשויות ותאגיד/);
    this.tabInvestors = tab(t.tabs.investors, /משקיעים/);
  }
}

/** Sub-page-object for the "Meet Or" section: heading + "Talk to Or" link. */
export class OrSection {
  readonly heading: Locator;
  readonly talkToOrLink: Locator;

  constructor(page: Page) {
    const t = T.or;
    this.heading = selfHeal(
      page.getByRole('heading', { name: t.heading }),
      page.getByRole('heading', { name: /סוכן אחד/ }),
    );
    this.talkToOrLink = selfHeal(
      page.getByRole('link', { name: t.talkToOr }),
      page.getByRole('link', { name: /דברו עם/ }),
    );
  }
}

/** Sub-page-object for the agents section: heading + the six named agent cards. */
export class AgentsSection {
  readonly heading: Locator;
  /** Agent cards keyed by (English) brand name — the closed set from the marketing i18n. */
  readonly agents: Record<string, Locator>;

  constructor(page: Page) {
    this.heading = selfHeal(
      page.getByRole('heading', { name: T.agents.heading }),
      page.getByRole('heading', { name: /סוכן לכל/ }),
    );
    this.agents = Object.fromEntries(
      T.agents.names.map((name) => [
        name,
        selfHeal(page.getByRole('heading', { name }), page.getByText(name).first()),
      ]),
    );
  }

  async expectAllAgentsVisible(): Promise<void> {
    for (const card of Object.values(this.agents)) {
      await expect(card).toBeVisible();
    }
  }
}

/** Sub-page-object for the active-projects showcase: heading + carousel controls. */
export class ProjectsSection {
  readonly heading: Locator;
  readonly nextButton: Locator;
  readonly prevButton: Locator;

  constructor(page: Page) {
    const t = T.projects;
    this.heading = selfHeal(
      page.getByRole('heading', { name: t.heading }),
      page.getByRole('heading', { name: /פרויקטים פעיל/ }),
    );
    this.nextButton = selfHeal(page.getByRole('button', { name: t.next }), page.getByRole('button', { name: /הבאים/ }));
    this.prevButton = selfHeal(page.getByRole('button', { name: t.prev }), page.getByRole('button', { name: /קודמים/ }));
  }
}

/** Sub-page-object for the blog teaser on the homepage: heading, filters, view-all link. */
export class BlogSection {
  readonly heading: Locator;
  readonly filterAll: Locator;
  readonly filterEnergy: Locator;
  readonly filterStorage: Locator;
  readonly filterSolar: Locator;
  readonly filterElectricity: Locator;
  readonly viewAllLink: Locator;

  constructor(page: Page) {
    const t = T.blog;
    this.heading = selfHeal(
      page.getByRole('heading', { name: t.heading }),
      page.getByRole('heading', { name: /משאבים להשג/ }),
    );
    this.filterAll = selfHeal(page.getByRole('button', { name: t.filters.all, exact: true }), page.getByRole('button', { name: /^הכל$/ }));
    this.filterEnergy = selfHeal(page.getByRole('button', { name: t.filters.energy, exact: true }), page.getByRole('button', { name: /^אנרגיה$/ }));
    this.filterStorage = selfHeal(page.getByRole('button', { name: t.filters.storage }), page.getByRole('button', { name: /אחסון/ }));
    this.filterSolar = selfHeal(page.getByRole('button', { name: t.filters.solar }), page.getByRole('button', { name: /אנרגיה סולארית/ }));
    this.filterElectricity = selfHeal(page.getByRole('button', { name: t.filters.electricity }), page.getByRole('button', { name: /חשמל/ }));
    this.viewAllLink = selfHeal(page.getByRole('link', { name: t.viewAll }), page.getByRole('link', { name: /צפה בכל/ }));
  }
}

/** Sub-page-object for the FAQ section: heading + accordion question/answer. */
export class FaqSection {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = selfHeal(
      page.getByRole('heading', { name: T.faq.heading }),
      page.getByRole('heading', { name: /שאלות נפוצות/ }),
    );
  }

  /** The expandable FAQ question header, addressed by its (Hebrew) text. */
  question(questionText: string): Locator {
    return this.page.getByRole('button', { name: questionText });
  }

  async clickQuestion(questionText: string): Promise<void> {
    await allureStep(`Open FAQ question "${questionText}"`, () =>
      this.question(questionText).or(this.page.getByText(questionText).first()).first().click());
  }

  answerRegion(questionText: string): Locator {
    return this.page.getByRole('region', { name: questionText });
  }
}
