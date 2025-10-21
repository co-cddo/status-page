import { govukEleventyPlugin } from '@x-govuk/govuk-eleventy-plugin';
import type { UserConfig, EleventyConfig } from '@11ty/eleventy';

export default function (eleventyConfig: UserConfig): EleventyConfig {
  // Register the GOV.UK plugin
  eleventyConfig.addPlugin(govukEleventyPlugin, {
    header: {
      organisationLogo: 'royal-arms',
      organisationName: 'Cabinet Office',
      productName: 'GOV.UK Service Status Monitor',
    },
    footer: {
      meta: {
        items: [
          {
            href: '/accessibility',
            text: 'Accessibility',
          },
          {
            href: '/privacy',
            text: 'Privacy policy',
          },
        ],
      },
    },
    templates: {
      error404: {
        title: 'Page not found - GOV.UK Service Status Monitor',
      },
      sitemap: true,
    },
  });

  // Pass through static assets
  eleventyConfig.addPassthroughCopy('assets');

  // Add custom filters
  eleventyConfig.addFilter('formatDate', (dateString: unknown) => {
    if (!dateString || typeof dateString !== 'string') return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  return {
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    dir: {
      input: 'src',
      output: '_site',
      includes: '../_includes',
      data: '../_data',
    },
    // Dev server runs on port 8080 by default
    // Override with PORT environment variable if needed
  };
}
