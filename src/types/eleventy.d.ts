declare module '@11ty/eleventy' {
  export interface UserConfig {
    addPlugin(plugin: unknown, options?: unknown): void;
    addPassthroughCopy(path: string | Record<string, string>): void;
    addExtension(
      extensions: string | string[],
      options: {
        key?: string;
        compile?: (inputContent: string, inputPath: string) => unknown;
        useLayouts?: boolean;
      }
    ): void;
    addFilter(name: string, callback: (...args: unknown[]) => unknown): void;
    setInputDirectory(dir: string): void;
    setOutputDirectory(dir: string): void;
    setIncludesDirectory(dir: string): void;
    setDataDirectory(dir: string): void;
    setLayoutsDirectory(dir: string): void;
    dir: {
      input: string;
      output: string;
      includes: string;
      data: string;
      layouts?: string;
    };
  }

  export interface EleventyConfig {
    dataTemplateEngine?: string;
    htmlTemplateEngine?: string;
    markdownTemplateEngine?: string;
    dir?: {
      input?: string;
      output?: string;
      includes?: string;
      data?: string;
      layouts?: string;
    };
  }
}
