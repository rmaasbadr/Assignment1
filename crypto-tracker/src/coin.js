const form = document.getElementById("searchForm");
const input = document.getElementById("coinInput");
const fetchButton = document.getElementById("fetchBtn");
const clearButton = document.getElementById("clearBtn");
const message = document.getElementById("messageArea");
const results = document.getElementById("resultsContainer");
const initialMessage = message.textContent;
const aliases = new Map([
  ["btc", "bitcoin"], ["eth", "ethereum"], ["sol", "solana"],
  ["doge", "dogecoin"], ["ada", "cardano"], ["xrp", "ripple"],
  ["usdt", "tether"], ["bnb", "binancecoin"]
]);
let activeRequest;

function showMessage(text, state = "") {
  message.textContent = text;
  message.dataset.state = state;
}

function formatUsd(value) {
  if (!Number.isFinite(value)) return "Unavailable";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value === 0 || Math.abs(value) >= 1 ? 2 : 12
  }).format(value);
}

function showResult(coin) {
  const data = coin.market_data;
  const price = data?.current_price?.usd;
  if (!Number.isFinite(price)) throw new Error("Price data is unavailable.");

  const change = data.price_change_percentage_24h_in_currency?.usd
    ?? data.price_change_percentage_24h;
  const yesterday = Number.isFinite(change) && change > -100
    ? price / (1 + change / 100)
    : null;

  const card = document.createElement("div");
  card.className = "result";
  const heading = document.createElement("h3");
  heading.textContent = "Result: " + coin.name;
  card.append(heading);

  const metrics = [
    ["Current Price", price],
    ["Yesterday's Price", yesterday],
    ["Market Cap", data.market_cap?.usd],
    ["24h Volume", data.total_volume?.usd],
    ["24h High", data.high_24h?.usd]
  ];

  metrics.forEach(([label, value], index) => {
    const row = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = (index + 1) + ". " + label + ": ";
    row.append(title, formatUsd(value));
    card.append(row);
  });
  results.replaceChildren(card);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (activeRequest) return;

  const name = input.value.trim().toLowerCase();
  results.replaceChildren();
  if (!name) {
    showMessage("Please enter a coin name first!", "warning");
    input.focus();
    return;
  }

  const coinId = aliases.get(name) ?? name.replace(/\s+/g, "-");
  const url = new URL("https://api.coingecko.com/api/v3/coins/" + encodeURIComponent(coinId));
  url.search = new URLSearchParams({
    localization: "false",
    tickers: "false",
    market_data: "true",
    community_data: "false",
    developer_data: "false",
    sparkline: "false"
  });

  const request = new AbortController();
  activeRequest = request;
  const timeout = setTimeout(() => request.abort(), 12000);
  fetchButton.disabled = true;
  showMessage("Searching...");

  try {
    const response = await fetch(url, { signal: request.signal });
    const coin = response.ok ? await response.json() : null;
    if (activeRequest !== request) return;

    if (response.status === 404) {
      showMessage("Error: Coin not found!", "error");
    } else if (response.status === 429) {
      showMessage("CoinGecko is busy. Please try again shortly.", "error");
    } else if (!response.ok) {
      showMessage("CoinGecko could not return prices. Please try again.", "error");
    } else {
      showResult(coin);
      showMessage("Success!", "success");
    }
  } catch {
    if (activeRequest === request) {
      showMessage("Unable to load prices. Please try again.", "error");
    }
  } finally {
    clearTimeout(timeout);
    if (activeRequest === request) {
      activeRequest = null;
      fetchButton.disabled = false;
    }
  }
});

clearButton.addEventListener("click", () => {
  activeRequest?.abort();
  activeRequest = null;
  fetchButton.disabled = false;
  form.reset();
  results.replaceChildren();
  showMessage(initialMessage);
  input.focus();
});