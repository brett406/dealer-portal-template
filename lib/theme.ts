import fs from "fs";
import path from "path";
import YAML from "yaml";

export interface ThemeConfig {
  brand: {
    name: string;
    logo: string;
    favicon: string;
  };
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    fontFamily: string;
    headingFontFamily: string;
    baseFontSize: string;
  };
  layout: {
    maxWidth: string;
    borderRadius: string;
    navStyle: string;
  };
}

let cachedTheme: ThemeConfig | null = null;

export function getTheme(): ThemeConfig {
  if (cachedTheme) return cachedTheme;

  const configPath = path.join(process.cwd(), "theme.config.yaml");
  const file = fs.readFileSync(configPath, "utf8");
  const parsed = YAML.parse(file) as ThemeConfig;

  cachedTheme = parsed;
  return parsed;
}

/**
 * Generate a CSS custom properties string from the theme config.
 * Used in the root layout to inject theme values as inline styles.
 */
export function getThemeCSSVariables(): string {
  const t = getTheme();

  return [
    `--color-primary: ${t.colors.primary}`,
    `--color-primary-dark: ${t.colors.primaryDark}`,
    `--color-secondary: ${t.colors.secondary}`,
    `--color-bg: ${t.colors.background}`,
    `--color-surface: ${t.colors.surface}`,
    `--color-text: ${t.colors.text}`,
    `--color-text-muted: ${t.colors.textMuted}`,
    `--color-border: ${t.colors.border}`,
    `--color-success: ${t.colors.success}`,
    `--color-warning: ${t.colors.warning}`,
    `--color-error: ${t.colors.error}`,
    `--font-family: ${t.typography.fontFamily}`,
    `--heading-font-family: ${t.typography.headingFontFamily}`,
    `--base-font-size: ${t.typography.baseFontSize}`,
    `--max-width: ${t.layout.maxWidth}`,
    `--border-radius: ${t.layout.borderRadius}`,
  ].join("; ");
}
