import type { Page } from '@playwright/test';
import type { ProductRuntimeIds } from '../product-page.types';

/** Parses project/quotation identifiers from the current product URL. */
export class ProductRuntimeIdsReader {
  constructor(private readonly page: Page) {}

  capture(): ProductRuntimeIds {
    const url = new URL(this.page.url());
    return {
      projectId: this.find(url, ['projectId', 'project', 'pid']),
      quotationId: this.find(url, ['quotationId', 'quotation', 'qid']),
      entrepreneurQuotationId: this.find(url, ['entrepreneurQuotationId']),
      token: this.find(url, ['token']),
    };
  }

  captureRoof(): ProductRuntimeIds {
    const match = this.page.url().match(/\/([^/]+)\/calculator\/roof\/([^/]+)\//i);
    return { projectId: match?.[1], quotationId: match?.[2] };
  }

  private find(url: URL, keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const value = url.searchParams.get(key);
      if (value) return value;
    }
    return url.pathname.match(/\/(?:projects?|quotations?|quotes?)\/([^/?#]+)/i)?.[1];
  }
}
