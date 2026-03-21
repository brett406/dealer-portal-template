/**
 * Upload product images (PNGs only) to the Railway volume via the app's upload API.
 *
 * Usage: npx tsx scripts/upload-images-to-railway.ts
 */

import fs from "fs";
import path from "path";

const APP_URL = "https://bauman-custom-products-production.up.railway.app";
const EMAIL = "sales@bcpinc.ca";
const PASSWORD = "web123456789";

const IMAGE_DIR = path.resolve(__dirname, "..", "..", "product_images");

async function getSessionCookie(): Promise<string> {
  const cookieJar = new Map<string, string>();

  function collectCookies(res: Response) {
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const [nameValue] = c.split(";");
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx > 0) {
        const name = nameValue.substring(0, eqIdx).trim();
        cookieJar.set(name, nameValue.trim());
      }
    }
  }

  function getCookieHeader(): string {
    return [...cookieJar.values()].join("; ");
  }

  // 1. Get CSRF token
  const csrfRes = await fetch(`${APP_URL}/api/auth/csrf`);
  collectCookies(csrfRes);
  const csrfData = (await csrfRes.json()) as { csrfToken: string };

  // 2. Sign in with credentials
  const signInRes = await fetch(`${APP_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: getCookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      email: EMAIL,
      password: PASSWORD,
    }).toString(),
    redirect: "manual",
  });
  collectCookies(signInRes);

  // 3. Follow the redirect to complete the session
  const location = signInRes.headers.get("location");
  if (location) {
    const redirectUrl = location.startsWith("http") ? location : `${APP_URL}${location}`;
    const followRes = await fetch(redirectUrl, {
      headers: { Cookie: getCookieHeader() },
      redirect: "manual",
    });
    collectCookies(followRes);
  }

  const cookies = getCookieHeader();
  const hasSession =
    cookies.includes("authjs.session-token") ||
    cookies.includes("__Secure-authjs.session-token");

  if (!hasSession) {
    console.error("Failed to get session token. Cookies:", [...cookieJar.keys()]);
    process.exit(1);
  }

  return cookies;
}

async function uploadFile(
  filePath: string,
  cookies: string,
): Promise<{ url: string; filename: string } | null> {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBuffer], { type: "image/png" }),
    fileName,
  );

  const res = await fetch(`${APP_URL}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookies },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ ${fileName}: ${res.status} ${err}`);
    return null;
  }

  return (await res.json()) as { url: string; filename: string };
}

async function main() {
  // Find all PNG files
  const files = fs
    .readdirSync(IMAGE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();

  console.log(`\nFound ${files.length} PNG files in ${IMAGE_DIR}\n`);

  // Authenticate
  console.log("Authenticating...");
  const cookies = await getSessionCookie();
  console.log("✓ Authenticated\n");

  // Upload each file and build mapping
  console.log("Uploading images...");
  let success = 0;
  let failed = 0;
  const mapping: Record<string, string> = {};

  for (const file of files) {
    const filePath = path.join(IMAGE_DIR, file);
    const result = await uploadFile(filePath, cookies);

    if (result) {
      mapping[file] = result.url;
      success++;
      if (success % 10 === 0) {
        console.log(`  … ${success}/${files.length} uploaded`);
      }
    } else {
      failed++;
    }
  }

  // Save mapping to file for the import script to use
  const mappingPath = path.join(__dirname, "..", "data", "image-url-mapping.json");
  fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

  console.log(`\n✅ Done! ${success} uploaded, ${failed} failed.`);
  console.log(`   Mapping saved to: ${mappingPath}\n`);
}

main().catch(console.error);
