
const ENDPOINT =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

export async function checkReputation(url) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey) {
    return {
      status: "unavailable",
      matches: [],
      message: "Reputation API key is not configured."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          client: {
            clientId: "phishshield-college-project",
            clientVersion: "1.0.0"
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION"
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }]
          }
        })
      }
    );

    if (!response.ok) {
      return {
        status: "unavailable",
        matches: [],
        message: `Reputation provider returned HTTP ${response.status}.`
      };
    }

    const data = await response.json();
    const matches = (data.matches || []).map(match => ({
      threatType: match.threatType,
      platformType: match.platformType
    }));

    return {
      status: matches.length ? "match" : "no_match",
      matches,
      message: matches.length
        ? "The provider reported a threat match."
        : "No match was returned by the provider."
    };
  } catch {
    return {
      status: "unavailable",
      matches: [],
      message: "The reputation check failed or timed out."
    };
  } finally {
    clearTimeout(timeout);
  }
}