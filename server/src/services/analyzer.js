
import net from "node:net";
import { domainToASCII } from "node:url";

const suspiciousWords = [
  "login", "verify", "secure", "account", "password",
  "wallet", "payment", "signin", "confirm", "update"
];

export function analyzeUrl(input) {
  const url = input instanceof URL ? input : new URL(input);
  const hostname = domainToASCII(url.hostname).toLowerCase();
  const reasons = [];

  const ipHost = net.isIP(hostname.replace(/^\[|\]$/g, "")) !== 0;
  const punycode = hostname.split(".").some(part => part.startsWith("xn--"));
  const embeddedCredentials = Boolean(url.username || url.password);
  const https = url.protocol === "https:";
  const unusualPort =
    url.port !== "" &&
    !((url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80"));

  const keywordText = `${hostname}${url.pathname}`.toLowerCase();
  const foundKeywords = suspiciousWords.filter(word =>
    keywordText.includes(word)
  );
  const suspiciousKeywords = foundKeywords.length > 0;
  const manySubdomains = hostname.split(".").length >= 5;
  const numericOrEncodedHost = /%[0-9a-f]{2}/i.test(url.hostname);

  let score = 0;

  function flag(condition, points, reason) {
    if (condition) {
      score += points;
      reasons.push(reason);
    }
  }

  flag(ipHost, 25, "The host is an IP address rather than a conventional domain.");
  flag(punycode, 20, "The hostname contains an internationalized punycode label.");
  flag(embeddedCredentials, 35, "The URL contains embedded username or password information.");
  flag(!https, 10, "The URL uses HTTP instead of HTTPS.");
  flag(unusualPort, 10, "The URL uses a nonstandard port.");
  flag(manySubdomains, 10, "The hostname contains an unusually large number of labels.");
  flag(numericOrEncodedHost, 10, "The hostname contains percent-encoded characters.");

  if (suspiciousKeywords) {
    flag(true, Math.min(15, foundKeywords.length * 5),
      `The URL contains potentially misleading terms: ${foundKeywords.join(", ")}.`);
  }

  if (reasons.length === 0) {
    reasons.push("No configured URL-pattern rules were triggered.");
  }

  return {
    hostname,
    score: Math.min(100, score),
    reasons,
    checks: {
      https,
      ipHost,
      punycode,
      embeddedCredentials,
      suspiciousKeywords,
      unusualPort
    }
  };
}