import { getSiteSettings } from "@/lib/cms";

export async function GAnalytics() {
  let gaId: string | null = null;
  try {
    const settings = await getSiteSettings();
    gaId = settings?.googleAnalyticsId ?? null;
  } catch {
    return null;
  }

  if (!gaId) return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
        }}
      />
    </>
  );
}
