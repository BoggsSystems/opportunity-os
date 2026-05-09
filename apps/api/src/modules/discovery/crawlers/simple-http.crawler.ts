import { Injectable, Logger } from '@nestjs/common';
import { IWebCrawler, WebCrawlerOptions, WebCrawlerResult } from './web-crawler.interface';

@Injectable()
export class SimpleHttpCrawler implements IWebCrawler {
  public readonly key = 'simple_http';
  private readonly logger = new Logger(SimpleHttpCrawler.name);

  async crawl(url: string, options?: WebCrawlerOptions): Promise<WebCrawlerResult> {
    this.logger.log(`Crawling URL via SimpleHttpCrawler: ${url}`);
    
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), options?.timeoutMs || 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      
      // Basic HTML text extraction
      const text = this.extractTextFromHtml(html);
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      const maxLength = options?.maxContentLength || 20000;
      const finalContent = text.slice(0, maxLength);

      return {
        url,
        text: finalContent,
        title,
        success: true,
        providerKey: this.key,
      };
    } catch (error: any) {
      this.logger.error(`Failed to crawl ${url}: ${error.message}`);
      return {
        url,
        text: '',
        success: false,
        error: error.message,
        providerKey: this.key,
      };
    }
  }

  private extractTextFromHtml(html: string): string {
    let text = html;
    
    // Remove scripts and styles
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode basic HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");

    // Replace multiple spaces and newlines
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }
}
