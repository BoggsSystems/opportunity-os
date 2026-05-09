export interface WebCrawlerOptions {
  timeoutMs?: number;
  waitForSelector?: string;
  maxContentLength?: number;
}

export interface WebCrawlerResult {
  url: string;
  text: string;
  title?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  error?: string;
  providerKey: string;
}

export interface IWebCrawler {
  readonly key: string;
  crawl(url: string, options?: WebCrawlerOptions): Promise<WebCrawlerResult>;
}
