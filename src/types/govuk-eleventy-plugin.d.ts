declare module '@x-govuk/govuk-eleventy-plugin' {
  interface NavigationItem {
    href: string;
    text: string;
  }

  interface FooterLink {
    href: string;
    text: string;
  }

  interface SearchConfig {
    indexPath?: string;
    sitemapPath?: string;
  }

  interface HeaderConfig {
    organisationLogo?: string;
    organisationName?: string;
    productName?: string;
    homepageUrl?: string;
    navigationItems?: NavigationItem[];
    search?: SearchConfig;
  }

  interface FooterConfig {
    meta?: {
      items?: FooterLink[];
      html?: string;
    };
    contentLicence?: {
      html?: string;
    };
    copyright?: {
      text?: string;
    };
  }

  interface TemplateConfig {
    permalink?: string;
    title?: string;
    content?: string;
    layout?: string;
  }

  interface TemplatesConfig {
    error404?: boolean | TemplateConfig;
    sitemap?: boolean | TemplateConfig;
    searchIndex?: boolean | TemplateConfig;
    feed?: boolean | TemplateConfig;
    tags?: boolean | TemplateConfig;
  }

  interface GovukEleventyPluginOptions {
    header?: HeaderConfig;
    footer?: FooterConfig;
    stylesheets?: string[];
    headIcons?: string;
    opengraphImageUrl?: string;
    themeColor?: string;
    templates?: TemplatesConfig;
  }

  export function govukEleventyPlugin(
    eleventyConfig: unknown,
    options?: GovukEleventyPluginOptions
  ): void;
}
