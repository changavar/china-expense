import {
  getAllExpenses,
  putExpense,
  removeExpense,
  getSetting,
  setSetting,
  replaceAllData,
  openDatabase,
  addBackup,
  getAllBackups,
  pruneBackups,
  clearBackups,
  clearAllData,
} from "./js/db.js";
import {
  DEFAULT_EXCHANGE_RATE,
  MAX_AMOUNT_CENTS,
  parseAmountToCents,
  convertPrimaryToSecondaryCents,
  convertSecondaryToPrimaryCents,
  normalizeRate,
  parseRate,
  formatCents,
  formatPrimary,
  formatSecondary,
  setCurrencyDisplay,
  formatRateLine,
  formatRate,
  centsToInputValue,
  isValidDateString,
  todayISO,
  formatDisplayDate,
  formatLongDate,
  compareExpensesNewestFirst,
} from "./js/money.js";
import { createReportPdf } from "./js/pdf.js";

const BUILTIN_CATEGORIES = [
  { name: "Food", icon: "food", className: "cat-food" },
  { name: "Hotel", icon: "hotel", className: "cat-hotel" },
  { name: "Taxi", icon: "taxi", className: "cat-taxi" },
  { name: "Flight", icon: "flight", className: "cat-flight" },
];
const CATEGORY_ICON_OPTIONS = [
  "tag",
  "shopping",
  "coffee",
  "ticket",
  "gift",
  "medical",
  "star",
  "briefcase",
  "train",
  "fuel",
  "parking",
  "laundry",
  "wifi",
  "movie",
  "book",
  "passport",
  "camera",
  "fitness",
];
const CATEGORY_TONES = 8;
const MAX_CUSTOM_CATEGORIES = 40;
const MAX_CATEGORY_NAME = 24;
const MAX_AUTO_BACKUPS = 12;

const DEFAULT_TRIP_PROFILE = {
  name: "China Trip",
  primary: { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  secondary: { code: "AED", name: "UAE Dirham", symbol: "AED" },
};
const MAX_TRIP_NAME = 28;
const MAX_CURRENCY_NAME = 28;
const MAX_CURRENCY_SYMBOL = 4;
const ENTRY_SLOTS = ["primary", "secondary"];
const VIEW_TITLES = {
  home: "Expenses",
  add: "Add expense",
  history: "History",
  settings: "Settings",
  reports: "Reports",
};
const VIEWS = new Set(Object.keys(VIEW_TITLES));
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  expenses: [],
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  customCategories: [],
  trip: structuredClone(DEFAULT_TRIP_PROFILE),
  autoBackups: [],
  entryCurrency: "primary",
  newCategoryIcon: "tag",
  activeView: "home",
  editingId: null,
  editingRate: null,
  reportsReturnView: "home",
  modalHandler: null,
  lastFocusedBeforeModal: null,
  toastTimer: null,
  ready: false,
};

const elements = {
  main: document.querySelector("#main"),
  views: [...document.querySelectorAll(".view")],
  navButtons: [...document.querySelectorAll("[data-nav]")],
  screenTitle: document.querySelector("#screen-title"),
  brandTrip: document.querySelector("#brand-trip"),
  appMetaName: document.querySelector("#app-meta-name"),
  headerRate: document.querySelector("#header-rate"),
  rateChip: document.querySelector("#rate-chip"),
  rateChipSecondary: document.querySelector("#rate-chip-secondary"),
  rateChipPrimary: document.querySelector("#rate-chip-primary"),

  totalCny: document.querySelector("#total-cny"),
  totalAed: document.querySelector("#total-aed"),
  summaryPrimaryCode: document.querySelector("#summary-primary-code"),
  summaryPrimarySymbol: document.querySelector("#summary-primary-symbol"),
  summaryPrimaryName: document.querySelector("#summary-primary-name"),
  summarySecondaryCode: document.querySelector("#summary-secondary-code"),
  summarySecondarySymbol: document.querySelector("#summary-secondary-symbol"),
  summarySecondaryName: document.querySelector("#summary-secondary-name"),
  categoryGrid: document.querySelector("#category-grid"),
  recentList: document.querySelector("#recent-list"),

  expenseForm: document.querySelector("#expense-form"),
  expenseAmount: document.querySelector("#expense-amount"),
  expenseDate: document.querySelector("#expense-date"),
  expenseDescription: document.querySelector("#expense-description"),
  amountLabel: document.querySelector("#amount-label"),
  amountHelp: document.querySelector("#amount-help"),
  amountPrefix: document.querySelector("#amount-prefix"),
  amountInputWrap: document.querySelector("#amount-input-wrap"),
  currencyToggle: document.querySelector("#currency-toggle"),
  currencyButtons: [...document.querySelectorAll("#currency-toggle [data-currency]")],
  currencyPrimaryBtn: document.querySelector("#currency-primary-btn"),
  currencySecondaryBtn: document.querySelector("#currency-secondary-btn"),
  categoryPicker: document.querySelector("#category-picker"),
  convertedPreview: document.querySelector("#converted-preview"),
  previewCurrency: document.querySelector("#preview-currency"),
  conversionRate: document.querySelector("#conversion-rate"),
  lockedRateNote: document.querySelector("#locked-rate-note"),
  formError: document.querySelector("#form-error"),
  saveExpenseBtn: document.querySelector("#save-expense-btn"),
  cancelEditBtn: document.querySelector("#cancel-edit-btn"),
  addScreenHeading: document.querySelector("#add-screen-heading"),

  historyCount: document.querySelector("#history-count"),
  historyTotalCny: document.querySelector("#history-total-cny"),
  historyTotalAed: document.querySelector("#history-total-aed"),
  historyPrimarySymbol: document.querySelector("#history-primary-symbol"),
  historySecondaryCode: document.querySelector("#history-secondary-code"),
  historySubtitle: document.querySelector("#history-subtitle"),
  historyList: document.querySelector("#history-list"),

  rateForm: document.querySelector("#rate-form"),
  rateInput: document.querySelector("#rate-input"),
  rateHelp: document.querySelector("#rate-help"),
  rateSecondaryCode: document.querySelector("#rate-secondary-code"),
  ratePrimaryCode: document.querySelector("#rate-primary-code"),
  rateError: document.querySelector("#rate-error"),
  backupExpenseCount: document.querySelector("#backup-expense-count"),
  backupExpenseNoun: document.querySelector("#backup-expense-noun"),
  backupRate: document.querySelector("#backup-rate"),
  backupRatePrimary: document.querySelector("#backup-rate-primary"),
  exportJsonBtn: document.querySelector("#export-json-btn"),
  importJsonBtn: document.querySelector("#import-json-btn"),
  importFile: document.querySelector("#import-file"),

  tripForm: document.querySelector("#trip-form"),
  tripName: document.querySelector("#trip-name"),
  primaryCode: document.querySelector("#primary-code"),
  primaryName: document.querySelector("#primary-name"),
  primarySymbol: document.querySelector("#primary-symbol"),
  secondaryCode: document.querySelector("#secondary-code"),
  secondaryName: document.querySelector("#secondary-name"),
  secondarySymbol: document.querySelector("#secondary-symbol"),
  currencyLockNote: document.querySelector("#currency-lock-note"),
  tripError: document.querySelector("#trip-error"),
  saveTripBtn: document.querySelector("#save-trip-btn"),

  autoBackupList: document.querySelector("#auto-backup-list"),
  autoBackupNote: document.querySelector("#auto-backup-note"),
  exportLatestBackupBtn: document.querySelector("#export-latest-backup-btn"),
  deleteBackupsBtn: document.querySelector("#delete-backups-btn"),
  resetDataBtn: document.querySelector("#reset-data-btn"),

  customCategoryList: document.querySelector("#custom-category-list"),
  categoryForm: document.querySelector("#category-form"),
  categoryName: document.querySelector("#category-name"),
  categoryError: document.querySelector("#category-error"),
  iconPicker: document.querySelector("#icon-picker"),

  reportFrom: document.querySelector("#report-from"),
  reportTo: document.querySelector("#report-to"),
  rangeSummary: document.querySelector("#range-summary"),
  rangeError: document.querySelector("#range-error"),
  rangeClearBtn: document.querySelector("#range-clear-btn"),
  reportTotalCny: document.querySelector("#report-total-cny"),
  reportTotalAed: document.querySelector("#report-total-aed"),
  reportPrimaryCode: document.querySelector("#report-primary-code"),
  reportPrimarySymbol: document.querySelector("#report-primary-symbol"),
  reportSecondaryCode: document.querySelector("#report-secondary-code"),
  reportSecondarySymbol: document.querySelector("#report-secondary-symbol"),
  reportSecondaryName: document.querySelector("#report-secondary-name"),
  reportCountLabel: document.querySelector("#report-count-label"),
  reportCategories: document.querySelector("#report-categories"),
  reportDaily: document.querySelector("#report-daily"),
  exportCsvBtn: document.querySelector("#export-csv-btn"),
  exportPdfBtn: document.querySelector("#export-pdf-btn"),
  exportHint: document.querySelector("#export-hint"),
  reportsBackBtn: document.querySelector("#reports-back-btn"),

  modal: document.querySelector("#modal"),
  modalIcon: document.querySelector("#modal-icon"),
  modalTitle: document.querySelector("#modal-title"),
  modalMessage: document.querySelector("#modal-message"),
  modalCancel: document.querySelector("#modal-cancel"),
  modalConfirm: document.querySelector("#modal-confirm"),
  modalActions: document.querySelector(".modal-actions"),

  toast: document.querySelector("#toast"),
};

function createEl(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createIcon(symbol, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${symbol}`);
  svg.append(use);
  return svg;
}

function allCategories() {
  return [
    ...BUILTIN_CATEGORIES,
    ...state.customCategories.map((category) => ({
      name: category.name,
      icon: category.icon,
      className: `cat-tone-${category.tone}`,
      custom: true,
    })),
  ];
}

function getCategoryMeta(category) {
  return (
    allCategories().find((item) => item.name === category) || {
      name: category,
      icon: "tag",
      className: "cat-tone-0",
    }
  );
}

function createCategoryIcon(category) {
  const meta = getCategoryMeta(category);
  const span = createEl("span", `category-icon ${meta.className}`);
  span.append(createIcon(meta.icon));
  return span;
}

function normalizeCategoryName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > MAX_CATEGORY_NAME) return null;
  return name;
}

function isBuiltinCategory(name) {
  return BUILTIN_CATEGORIES.some(
    (category) => category.name.toLowerCase() === name.toLowerCase()
  );
}

function isValidCategoryIcon(icon) {
  return CATEGORY_ICON_OPTIONS.includes(icon);
}

function isValidCategoryTone(tone) {
  return Number.isInteger(tone) && tone >= 0 && tone < CATEGORY_TONES;
}

/**
 * Validate and normalize a custom-category list (from storage or a backup).
 * Throws a readable error for invalid backup data.
 */
function validateCustomCategories(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error("The backup contains an invalid category list.");
  }
  if (value.length > MAX_CUSTOM_CATEGORIES) {
    throw new Error("The backup contains too many custom categories.");
  }

  const seen = new Set(BUILTIN_CATEGORIES.map((category) => category.name.toLowerCase()));
  return value.map((raw, index) => {
    const label = `Category ${index + 1}`;
    if (!raw || typeof raw !== "object") {
      throw new Error(`${label} is invalid.`);
    }
    const name = normalizeCategoryName(raw.name);
    if (!name) {
      throw new Error(`${label} has an invalid name.`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`${label} has a duplicate or built-in name.`);
    }
    seen.add(key);
    if (!isValidCategoryIcon(raw.icon)) {
      throw new Error(`${label} has an invalid icon.`);
    }
    return {
      name,
      icon: raw.icon,
      tone: isValidCategoryTone(raw.tone) ? raw.tone : index % CATEGORY_TONES,
    };
  });
}

function readStoredCategories(value) {
  try {
    return validateCustomCategories(value);
  } catch (error) {
    console.error("Stored categories could not be read", error);
    return [];
  }
}

function readStoredTrip(value) {
  try {
    return validateTripProfile(value);
  } catch (error) {
    console.error("Stored trip settings could not be read", error);
    return structuredClone(DEFAULT_TRIP_PROFILE);
  }
}

function nextCategoryTone() {
  const usage = new Array(CATEGORY_TONES).fill(0);
  BUILTIN_CATEGORIES.forEach((_, index) => {
    usage[index % CATEGORY_TONES] += 1;
  });
  for (const category of state.customCategories) {
    if (isValidCategoryTone(category.tone)) usage[category.tone] += 1;
  }

  let best = 0;
  for (let tone = 1; tone < CATEGORY_TONES; tone += 1) {
    if (usage[tone] < usage[best]) best = tone;
  }
  return best;
}

function getSelectedCategory() {
  return (
    elements.categoryPicker.querySelector('input[name="category"]:checked')
      ?.value || "Food"
  );
}

function renderCategoryPicker(selected = "Food") {
  const names = allCategories().map((category) => category.name);
  const active = names.includes(selected) ? selected : "Food";

  elements.categoryPicker.replaceChildren();
  for (const category of allCategories()) {
    const label = createEl("label", `category-option ${category.className}`);
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "category";
    input.value = category.name;
    input.checked = category.name === active;

    const inner = createEl("span", "category-option-inner");
    const icon = createEl("span", `category-icon ${category.className}`);
    icon.append(createIcon(category.icon));
    inner.append(icon, createEl("span", "", category.name));
    label.append(input, inner);
    elements.categoryPicker.append(label);
  }
}

function createEmptyState({ icon = "wallet", title, text, actionLabel, actionHandler }) {
  const wrap = createEl("div", "empty-state");
  const iconWrap = createEl("div", "empty-icon");
  iconWrap.append(createIcon(icon));
  wrap.append(iconWrap, createEl("h3", "", title), createEl("p", "", text));

  if (actionLabel && actionHandler) {
    const button = createEl("button", "button button-secondary", actionLabel);
    button.type = "button";
    button.addEventListener("click", actionHandler);
    wrap.append(button);
  }
  return wrap;
}

/**
 * Expenses store their destination-currency amount in `primaryCents` and their
 * home-currency amount in `secondaryCents`. Backups and databases created
 * before v1.2 used `cnyCents` / `aedCents`; read both so old data keeps working.
 */
function primaryOf(expense) {
  return Number.isSafeInteger(expense?.primaryCents)
    ? expense.primaryCents
    : Number.isSafeInteger(expense?.cnyCents)
      ? expense.cnyCents
      : 0;
}

function secondaryOf(expense) {
  return Number.isSafeInteger(expense?.secondaryCents)
    ? expense.secondaryCents
    : Number.isSafeInteger(expense?.aedCents)
      ? expense.aedCents
      : 0;
}

function entrySlotOf(expense) {
  if (expense?.entryCurrency === "secondary" || expense?.entryCurrency === "AED") {
    return "secondary";
  }
  return "primary";
}

function sumExpenses(expenses) {
  return expenses.reduce(
    (totals, expense) => {
      totals.primaryCents += primaryOf(expense);
      totals.secondaryCents += secondaryOf(expense);
      return totals;
    },
    { primaryCents: 0, secondaryCents: 0 }
  );
}

function categoryTotals(expenses) {
  return allCategories().map((meta) => {
    const items = expenses.filter((expense) => expense.category === meta.name);
    const totals = sumExpenses(items);
    return {
      category: meta.name,
      count: items.length,
      primaryCents: totals.primaryCents,
      secondaryCents: totals.secondaryCents,
    };
  });
}

function sortedNewestFirst(expenses = state.expenses) {
  return [...expenses].sort(compareExpensesNewestFirst);
}

function sortedOldestFirst(expenses = state.expenses) {
  return [...expenses].sort((a, b) => -compareExpensesNewestFirst(a, b));
}

function setText(element, text) {
  if (element) element.textContent = text;
}

function showToast(message, variant = "success") {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast${variant === "error" ? " error" : ""}`;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2800);
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.hidden = !message;
}

function showRateError(message) {
  elements.rateError.textContent = message;
  elements.rateError.hidden = !message;
}

function refreshHeaderRate() {
  setText(elements.headerRate, formatRate(state.exchangeRate));
}

function updateRateDisplays() {
  refreshHeaderRate();
  setText(elements.backupRate, formatRate(state.exchangeRate));
  if (document.activeElement !== elements.rateInput) {
    elements.rateInput.value = formatRate(state.exchangeRate);
  }
  if (!state.editingId) {
    setText(elements.conversionRate, formatRateLine(state.exchangeRate));
  }
}

/**
 * Push the active trip name and currency labels into every static label.
 * Called at startup, after a trip edit and after restoring a backup.
 */
function applyTripProfile() {
  setCurrencyDisplay(state.trip);
  const tripName = state.trip.name || "My Trip";
  const primary = state.trip.primary;
  const secondary = state.trip.secondary;

  setText(elements.brandTrip, tripName.toUpperCase());
  setText(elements.appMetaName, `${tripName} Expenses`);
  document.title = `${tripName} Expenses`;

  setText(elements.summaryPrimaryCode, primary.code);
  setText(elements.summaryPrimarySymbol, primary.symbol);
  setText(elements.summaryPrimaryName, primary.name);
  setText(elements.summarySecondaryCode, secondary.code);
  setText(elements.summarySecondarySymbol, secondary.symbol);
  setText(elements.summarySecondaryName, secondary.name);

  setText(elements.rateChipSecondary, secondary.code);
  setText(elements.rateChipPrimary, primary.code);
  setText(elements.rateSecondaryCode, secondary.code);
  setText(elements.ratePrimaryCode, primary.code);
  setText(elements.backupRatePrimary, primary.code);
  setText(elements.historyPrimarySymbol, primary.symbol);
  setText(elements.historySecondaryCode, secondary.code);
  setText(elements.reportPrimaryCode, primary.code);
  setText(elements.reportPrimarySymbol, primary.symbol);
  setText(elements.reportSecondaryCode, secondary.code);
  setText(elements.reportSecondarySymbol, secondary.symbol);
  setText(elements.reportSecondaryName, secondary.name);
  setText(elements.currencyPrimaryBtn, primary.code);
  setText(elements.currencySecondaryBtn, secondary.code);
  elements.currencySecondaryBtn.classList.toggle(
    "currency-toggle-wide",
    secondary.symbol.length > 2
  );
  elements.rateHelp.textContent = `How many ${primary.code} one ${secondary.code} is worth. Existing expenses keep the rate they were saved with.`;
  updateEntryCurrencyUI();
}

function currentEntryRate() {
  return state.editingId ? state.editingRate : state.exchangeRate;
}

function entryCurrencyMeta(slot = state.entryCurrency) {
  const currency = state.trip[slot] || state.trip.primary;
  return {
    slot,
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    label: `Amount in ${currency.name}`,
    prefix: currency.symbol,
    help: `Enter the amount you paid in ${currency.code}.`,
  };
}

function updateEntryCurrencyUI() {
  const config = entryCurrencyMeta();
  setText(elements.amountLabel, config.label);
  setText(elements.amountHelp, config.help);
  setText(elements.amountPrefix, config.prefix);
  elements.amountPrefix.classList.toggle(
    "amount-prefix-text",
    config.symbol.length > 1
  );
  for (const button of elements.currencyButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.currency === state.entryCurrency)
    );
  }
  updateConversionPreview();
}

function updateConversionPreview() {
  const rate = currentEntryRate();
  const cents = parseAmountToCents(elements.expenseAmount.value);
  let converted = null;
  if (cents !== null) {
    converted =
      state.entryCurrency === "primary"
        ? convertPrimaryToSecondaryCents(cents, rate)
        : convertSecondaryToPrimaryCents(cents, rate);
  }

  setText(
    elements.previewCurrency,
    entryCurrencyMeta(state.entryCurrency === "primary" ? "secondary" : "primary")
      .code
  );
  setText(
    elements.convertedPreview,
    converted === null ? "0.00" : formatCents(converted)
  );
  setText(elements.conversionRate, formatRateLine(rate || state.exchangeRate));

  if (state.editingId && state.editingRate) {
    elements.lockedRateNote.hidden = false;
    elements.lockedRateNote.textContent = `Saved rate locked: ${formatRateLine(
      state.editingRate
    )}. This expense keeps its original rate.`;
  } else {
    elements.lockedRateNote.hidden = true;
    elements.lockedRateNote.textContent = "";
  }
}

function switchEntryCurrency(next) {
  if (!ENTRY_SLOTS.includes(next) || next === state.entryCurrency) return;
  const rate = currentEntryRate();
  const cents = parseAmountToCents(elements.expenseAmount.value);

  state.entryCurrency = next;
  if (cents !== null) {
    const converted =
      next === "primary"
        ? convertSecondaryToPrimaryCents(cents, rate)
        : convertPrimaryToSecondaryCents(cents, rate);
    elements.expenseAmount.value =
      converted === null ? "" : centsToInputValue(converted);
  }
  updateEntryCurrencyUI();
  elements.expenseAmount.focus({ preventScroll: true });
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

function createCategoryCard(category) {
  const meta = getCategoryMeta(category.category);
  const card = createEl("article", `category-card ${meta.className}`);
  card.dataset.categoryCard = category.category;

  const top = createEl("div", "category-card-top");
  const icon = createEl("span", `category-icon ${meta.className}`);
  icon.append(createIcon(meta.icon));
  const count = createEl("span", "category-share", String(category.count));
  count.dataset.categoryCount = category.category;
  top.append(icon, count);

  const secondary = createEl("span", "", formatSecondary(category.secondaryCents));
  secondary.dataset.categoryAed = category.category;
  const secondaryLine = createEl("p", "category-total");
  secondaryLine.append(secondary);

  const primary = createEl("span", "", formatPrimary(category.primaryCents));
  primary.dataset.categoryCny = category.category;
  const primaryLine = createEl("p", "category-total-cny");
  primaryLine.append(primary);

  const body = createEl("div");
  body.append(createEl("h3", "", category.category), secondaryLine, primaryLine);
  card.append(top, body);
  return card;
}

function renderHome() {
  const totals = sumExpenses(state.expenses);
  const categories = categoryTotals(state.expenses);

  setText(elements.totalCny, formatCents(totals.primaryCents));
  setText(elements.totalAed, formatCents(totals.secondaryCents));

  elements.categoryGrid.replaceChildren(...categories.map(createCategoryCard));
  elements.recentList.replaceChildren();
  const recent = sortedNewestFirst().slice(0, 3);

  if (!recent.length) {
    elements.recentList.append(
      createEmptyState({
        icon: "wallet",
        title: "No expenses yet",
        text: "Add your first expense to start tracking the trip.",
        actionLabel: "Add expense",
        actionHandler: () => {
          startNewExpense();
          navigate("add");
        },
      })
    );
    return;
  }

  for (const expense of recent) {
    const row = createEl("button", "recent-row");
    row.type = "button";
    row.dataset.edit = expense.id;
    row.setAttribute(
      "aria-label",
      `Edit ${expense.description || expense.category} expense`
    );

    const copy = createEl("div", "recent-copy");
    copy.append(
      createEl(
        "p",
        "recent-title",
        expense.description || expense.category
      ),
      createEl(
        "p",
        "recent-meta",
        `${expense.category} · ${formatDisplayDate(expense.date)}`
      )
    );

    const amounts = createEl("div", "recent-amount");
    amounts.append(
      createEl("strong", "", formatSecondary(secondaryOf(expense))),
      createEl("span", "", formatPrimary(primaryOf(expense)))
    );

    row.append(createCategoryIcon(expense.category), copy, amounts);
    elements.recentList.append(row);
  }
}

function formatGroupDate(dateString) {
  const today = todayISO();
  if (dateString === today) return "Today";
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(
    yesterday.getMonth() + 1
  ).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateString === yesterdayISO) return "Yesterday";
  return formatDisplayDate(dateString, { weekday: true });
}

function createExpenseHistoryItem(expense) {
  const item = createEl("article", "expense-item");
  item.dataset.expenseId = expense.id;

  const main = createEl("div", "expense-main");
  const copy = createEl("div", "expense-copy");
  const titleRow = createEl("div", "expense-title-row");

  const description = expense.description || expense.category;
  titleRow.append(createEl("h3", "", description));

  const tag = createEl(
    "span",
    `category-tag ${getCategoryMeta(expense.category).className}`,
    expense.category
  );
  titleRow.append(tag);

  const meta = createEl(
    "p",
    "expense-meta",
    `${formatDisplayDate(expense.date)} · ${formatRateLine(expense.exchangeRate)}`
  );

  const amounts = createEl("div", "expense-amounts");
  amounts.append(
    createEl("span", "amount-aed", formatSecondary(secondaryOf(expense))),
    createEl("span", "amount-cny", formatPrimary(primaryOf(expense)))
  );

  copy.append(titleRow, meta, amounts);
  main.append(createCategoryIcon(expense.category), copy);

  const actions = createEl("div", "expense-actions");
  const edit = createEl("button", "expense-action");
  edit.type = "button";
  edit.dataset.edit = expense.id;
  edit.setAttribute("aria-label", `Edit ${description}`);
  edit.append(createIcon("edit"), document.createTextNode("Edit"));

  const del = createEl("button", "expense-action danger");
  del.type = "button";
  del.dataset.delete = expense.id;
  del.setAttribute("aria-label", `Delete ${description}`);
  del.append(createIcon("trash"), document.createTextNode("Delete"));

  actions.append(edit, del);
  item.append(main, actions);
  return item;
}

function renderHistory() {
  const totals = sumExpenses(state.expenses);
  setText(elements.historyCount, String(state.expenses.length));
  setText(elements.historyTotalCny, formatCents(totals.primaryCents));
  setText(elements.historyTotalAed, formatCents(totals.secondaryCents));
  setText(
    elements.historySubtitle,
    state.expenses.length
      ? `${state.expenses.length} expense${
          state.expenses.length === 1 ? "" : "s"
        }, newest first.`
      : "Your expenses will appear here."
  );

  elements.historyList.replaceChildren();
  const newest = sortedNewestFirst();

  if (!newest.length) {
    elements.historyList.append(
      createEmptyState({
        icon: "history",
        title: "Nothing recorded yet",
        text: "Your trip expenses are stored privately on this iPhone.",
        actionLabel: "Add your first expense",
        actionHandler: () => {
          startNewExpense();
          navigate("add");
        },
      })
    );
    return;
  }

  const groups = new Map();
  for (const expense of newest) {
    if (!groups.has(expense.date)) groups.set(expense.date, []);
    groups.get(expense.date).push(expense);
  }

  for (const [date, expenses] of groups) {
    const group = createEl("section", "date-group");
    const header = createEl("div", "date-group-header");
    const totalsForDay = sumExpenses(expenses);
    header.append(
      createEl("h2", "", formatGroupDate(date)),
      createEl("span", "", formatSecondary(totalsForDay.secondaryCents))
    );

    const list = createEl("div", "expense-list");
    for (const expense of expenses) {
      list.append(createExpenseHistoryItem(expense));
    }

    group.append(header, list);
    elements.historyList.append(group);
  }
}

function renderCustomCategories() {
  elements.customCategoryList.replaceChildren();

  if (!state.customCategories.length) {
    elements.customCategoryList.append(
      createEl("p", "custom-category-empty", "No custom categories yet.")
    );
    return;
  }

  for (const category of state.customCategories) {
    const meta = getCategoryMeta(category.name);
    const count = state.expenses.filter(
      (expense) => expense.category === category.name
    ).length;

    const row = createEl("div", "custom-category-row");
    const icon = createEl("span", `category-icon ${meta.className}`);
    icon.append(createIcon(category.icon));
    const name = createEl("span", "custom-category-name", category.name);
    const countLabel = createEl(
      "span",
      "custom-category-count",
      `${count} item${count === 1 ? "" : "s"}`
    );

    const remove = createEl("button", "category-remove");
    remove.type = "button";
    remove.dataset.deleteCategory = category.name;
    remove.setAttribute("aria-label", `Delete ${category.name} category`);
    remove.append(createIcon("trash"));

    row.append(icon, name, countLabel, remove);
    elements.customCategoryList.append(row);
  }
}

function renderTripSettings() {
  const locked = state.expenses.length > 0;
  elements.tripName.value = state.trip.name;
  elements.primaryCode.value = state.trip.primary.code;
  elements.primaryName.value = state.trip.primary.name;
  elements.primarySymbol.value = state.trip.primary.symbol;
  elements.secondaryCode.value = state.trip.secondary.code;
  elements.secondaryName.value = state.trip.secondary.name;
  elements.secondarySymbol.value = state.trip.secondary.symbol;

  for (const input of [
    elements.primaryCode,
    elements.primaryName,
    elements.primarySymbol,
    elements.secondaryCode,
    elements.secondaryName,
    elements.secondarySymbol,
  ]) {
    input.disabled = locked;
  }
  elements.currencyLockNote.hidden = !locked;
  elements.tripError.hidden = true;
}

function renderAutoBackups() {
  elements.autoBackupList.replaceChildren();

  if (!state.autoBackups.length) {
    elements.autoBackupList.append(
      createEl(
        "p",
        "custom-category-empty",
        "No automatic backups yet. One is saved after every change."
      )
    );
    elements.exportLatestBackupBtn.disabled = true;
    elements.deleteBackupsBtn.disabled = true;
    return;
  }

  elements.exportLatestBackupBtn.disabled = false;
  elements.deleteBackupsBtn.disabled = false;

  for (const backup of state.autoBackups) {
    const row = createEl("div", "auto-backup-row");
    const copy = createEl("div", "auto-backup-copy");
    const when = backup.createdAt ? new Date(backup.createdAt) : null;
    const label =
      when && Number.isFinite(when.getTime())
        ? new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(when)
        : "Unknown time";
    const count = backup.payload?.expenses?.length ?? backup.expenseCount ?? 0;
    copy.append(
      createEl("strong", "", label),
      createEl(
        "span",
        "",
        `${count} expense${count === 1 ? "" : "s"}${
          backup.reason ? ` · ${backup.reason}` : ""
        }`
      )
    );

    const download = createEl("button", "auto-backup-export");
    download.type = "button";
    download.dataset.exportBackup = backup.id;
    download.setAttribute("aria-label", `Export backup from ${label}`);
    download.append(createIcon("download"));

    row.append(copy, download);
    elements.autoBackupList.append(row);
  }
}

function renderSettings() {
  updateRateDisplays();
  setText(elements.backupExpenseCount, String(state.expenses.length));
  setText(
    elements.backupExpenseNoun,
    state.expenses.length === 1 ? "expense" : "expenses"
  );
  setText(elements.backupRate, formatRate(state.exchangeRate));
  renderTripSettings();
  renderCustomCategories();
  renderAutoBackups();
}

function getReportFilter() {
  return {
    from: elements.reportFrom.value || "",
    to: elements.reportTo.value || "",
  };
}

function filterExpensesByRange(expenses, from, to) {
  return expenses.filter((expense) => {
    if (from && expense.date < from) return false;
    if (to && expense.date > to) return false;
    return true;
  });
}

function getFilteredReportExpenses() {
  const { from, to } = getReportFilter();
  return filterExpensesByRange(state.expenses, from, to);
}

function getPeriodLabel(expenses) {
  const { from, to } = getReportFilter();
  if (from && to) {
    return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
  }
  if (from) return `From ${formatDisplayDate(from)}`;
  if (to) return `Through ${formatDisplayDate(to)}`;
  if (expenses.length) {
    const dates = expenses.map((expense) => expense.date).sort();
    return `All recorded expenses · ${formatDisplayDate(
      dates[0]
    )} – ${formatDisplayDate(dates[dates.length - 1])}`;
  }
  return "All recorded expenses";
}

function setRangeError(message) {
  elements.rangeError.textContent = message;
  elements.rangeError.hidden = !message;
}

function createReportCategoryRow(category, totalPrimary) {
  const meta = getCategoryMeta(category.category);
  const row = createEl("div", `breakdown-row ${meta.className}`);
  const top = createEl("div", "breakdown-top");
  const icon = createEl("span", `breakdown-icon ${meta.className}`);
  icon.append(createIcon(meta.icon));

  const name = createEl(
    "span",
    "breakdown-name",
    `${category.category} · ${category.count}`
  );

  const amount = createEl(
    "div",
    "breakdown-amount",
    formatSecondary(category.secondaryCents)
  );
  amount.append(createEl("small", "", formatPrimary(category.primaryCents)));

  top.append(icon, name, amount);

  const bar = createEl("div", "breakdown-bar");
  const fill = createEl("span");
  const percent =
    totalPrimary > 0 ? (category.primaryCents / totalPrimary) * 100 : 0;
  fill.style.width = `${Math.max(percent > 0 ? 2 : 0, percent).toFixed(2)}%`;
  bar.append(fill);

  row.append(top, bar);
  return row;
}

function renderReports() {
  const filtered = getFilteredReportExpenses();
  const { from, to } = getReportFilter();
  const invalidRange = Boolean(from && to && from > to);
  const sorted = sortedNewestFirst(filtered);
  const totals = sumExpenses(filtered);
  const categories = categoryTotals(filtered);

  setRangeError(invalidRange ? "The start date must be before the end date." : "");

  if (invalidRange) {
    setText(elements.rangeSummary, "Choose a valid date range");
  } else if (from || to) {
    const fromLabel = from ? formatDisplayDate(from) : "the beginning";
    const toLabel = to ? formatDisplayDate(to) : "today";
    setText(elements.rangeSummary, `${fromLabel} – ${toLabel}`);
  } else {
    setText(elements.rangeSummary, "All recorded expenses");
  }

  setText(elements.reportTotalCny, formatCents(totals.primaryCents));
  setText(elements.reportTotalAed, formatCents(totals.secondaryCents));
  setText(
    elements.reportCountLabel,
    `${filtered.length} expense${filtered.length === 1 ? "" : "s"}`
  );
  setText(
    elements.exportHint,
    filtered.length
      ? `${filtered.length} expense${
          filtered.length === 1 ? "" : "s"
        } in the selected range. Exports stay on this iPhone.`
      : "No expenses in this range to export."
  );

  elements.reportCategories.replaceChildren();
  for (const category of categories) {
    elements.reportCategories.append(
      createReportCategoryRow(category, totals.primaryCents)
    );
  }

  elements.reportDaily.replaceChildren();
  if (!sorted.length) {
    const empty = createEl(
      "p",
      "report-empty",
      invalidRange
        ? "Adjust the date range to see expenses."
        : "No expenses in this range."
    );
    elements.reportDaily.append(empty);
  } else {
    const days = new Map();
    for (const expense of sorted) {
      if (!days.has(expense.date)) days.set(expense.date, []);
      days.get(expense.date).push(expense);
    }

    for (const [date, expenses] of days) {
      const row = createEl("div", "daily-row");
      const copy = createEl("div");
      copy.append(
        createEl(
          "div",
          "daily-date",
          formatDisplayDate(date, { weekday: true, year: false })
        ),
        createEl(
          "div",
          "daily-count",
          `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`
        )
      );

      const dayTotals = sumExpenses(expenses);
      const amounts = createEl("div", "daily-amounts");
      amounts.append(
        createEl("strong", "", formatSecondary(dayTotals.secondaryCents)),
        createEl("span", "", formatPrimary(dayTotals.primaryCents))
      );

      row.append(copy, amounts);
      elements.reportDaily.append(row);
    }
  }

  elements.exportCsvBtn.disabled = filtered.length === 0;
  elements.exportPdfBtn.disabled = filtered.length === 0;
}

function renderAll() {
  state.expenses.sort(compareExpensesNewestFirst);
  renderHome();
  renderHistory();
  renderSettings();
  renderReports();
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

function updateNavigation(activeView) {
  let navView = activeView;
  if (activeView === "reports") {
    navView = state.reportsReturnView === "history" ? "history" : "home";
  }

  for (const button of elements.navButtons) {
    if (button.dataset.nav === navView) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }
}

function updateAddLabels() {
  const editing = Boolean(state.editingId);
  setText(elements.addScreenHeading, editing ? "Edit expense" : "Add an expense");
  setText(elements.saveExpenseBtn, editing ? "Update Expense" : "Save Expense");
  elements.cancelEditBtn.hidden = !editing;
  elements.lockedRateNote.hidden = !editing;
  elements.screenTitle.textContent = editing ? "Edit expense" : VIEW_TITLES.add;
}

function navigate(view, { scroll = true } = {}) {
  if (!VIEWS.has(view)) return;
  state.activeView = view;

  for (const section of elements.views) {
    section.hidden = section.dataset.view !== view;
  }

  if (view !== "add") {
    elements.screenTitle.textContent = VIEW_TITLES[view];
  } else {
    elements.screenTitle.textContent = state.editingId
      ? "Edit expense"
      : VIEW_TITLES.add;
  }

  if (view === "home") renderHome();
  if (view === "history") renderHistory();
  if (view === "settings") renderSettings();
  if (view === "reports") renderReports();
  if (view === "add") {
    updateAddLabels();
    updateConversionPreview();
  }

  updateNavigation(view);
  if (scroll) window.scrollTo({ top: 0, behavior: "auto" });
}

function openReports() {
  state.reportsReturnView = state.activeView === "history" ? "history" : "home";
  navigate("reports");
}

/* -------------------------------------------------------------------------- */
/* Expense form                                                               */
/* -------------------------------------------------------------------------- */

function startNewExpense() {
  state.editingId = null;
  state.editingRate = null;
  elements.expenseForm.reset();
  renderCategoryPicker("Food");
  elements.expenseDate.value = todayISO();
  elements.expenseAmount.value = "";
  elements.expenseDescription.value = "";
  showFormError("");
  updateAddLabels();
  updateEntryCurrencyUI();
}

function startEditExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) {
    showToast("That expense could not be found.", "error");
    return;
  }

  state.editingId = expense.id;
  state.editingRate = expense.exchangeRate;
  state.entryCurrency = entrySlotOf(expense);
  renderCategoryPicker(expense.category);
  elements.expenseAmount.value = centsToInputValue(
    state.entryCurrency === "secondary"
      ? secondaryOf(expense)
      : primaryOf(expense)
  );
  elements.expenseDate.value = expense.date;
  elements.expenseDescription.value = expense.description || "";
  showFormError("");
  updateAddLabels();
  updateEntryCurrencyUI();
  navigate("add");
}

function cancelEditing() {
  startNewExpense();
  navigate("history");
}

function makeExpenseId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  showFormError("");

  const category = getSelectedCategory();
  const date = elements.expenseDate.value;
  const description = elements.expenseDescription.value.trim();
  const sourceCents = parseAmountToCents(elements.expenseAmount.value);
  const editing = state.editingId
    ? state.expenses.find((expense) => expense.id === state.editingId)
    : null;
  const rate = editing ? editing.exchangeRate : state.exchangeRate;

  if (!allCategories().some((item) => item.name === category)) {
    showFormError("Choose a category.");
    return;
  }
  if (sourceCents === null) {
    showFormError(
      `Enter a positive ${entryCurrencyMeta().code} amount with up to 2 decimal places.`
    );
    elements.expenseAmount.focus();
    return;
  }
  if (!isValidDateString(date)) {
    showFormError("Choose a valid expense date.");
    elements.expenseDate.focus();
    return;
  }
  if (description.length > 160) {
    showFormError("Keep the description under 160 characters.");
    return;
  }

  let primaryCents;
  let secondaryCents;
  if (state.entryCurrency === "secondary") {
    secondaryCents = sourceCents;
    primaryCents = convertSecondaryToPrimaryCents(secondaryCents, rate);
  } else {
    primaryCents = sourceCents;
    secondaryCents = convertPrimaryToSecondaryCents(primaryCents, rate);
  }

  if (primaryCents === null || primaryCents <= 0 || secondaryCents === null) {
    showFormError("That amount is too small for the saved exchange rate.");
    return;
  }
  if (
    primaryCents > MAX_AMOUNT_CENTS ||
    secondaryCents > MAX_AMOUNT_CENTS
  ) {
    showFormError("That amount is too large.");
    return;
  }

  const now = new Date().toISOString();
  const expense = {
    id: editing ? editing.id : makeExpenseId(),
    category,
    primaryCents,
    secondaryCents,
    exchangeRate: rate,
    entryCurrency: state.entryCurrency,
    date,
    description,
    createdAt: editing ? editing.createdAt : now,
    updatedAt: now,
  };

  elements.saveExpenseBtn.disabled = true;
  elements.saveExpenseBtn.textContent = editing ? "Updating…" : "Saving…";

  try {
    await putExpense(expense);

    if (editing) {
      state.expenses = state.expenses.map((item) =>
        item.id === expense.id ? expense : item
      );
    } else {
      state.expenses.push(expense);
    }
    state.expenses.sort(compareExpensesNewestFirst);

    const wasEditing = Boolean(editing);
    state.editingId = null;
    state.editingRate = null;
    startNewExpense();
    renderAll();
    await captureAutoBackup(wasEditing ? "after edit" : "after expense");
    showToast(wasEditing ? "Expense updated" : "Expense saved");

    if (wasEditing) {
      navigate("history");
    } else {
      navigate("home");
    }
  } catch (error) {
    console.error(error);
    showFormError("Could not save the expense on this device. Please try again.");
  } finally {
    elements.saveExpenseBtn.disabled = false;
    elements.saveExpenseBtn.textContent = state.editingId
      ? "Update Expense"
      : "Save Expense";
  }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

function confirmDeleteExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;

  openModal({
    icon: "trash",
    danger: true,
    title: "Delete this expense?",
    message: `"${expense.description || expense.category}" for ${formatPrimary(
      primaryOf(expense)
    )} will be permanently removed from this iPhone. Totals will update immediately.`,
    confirmLabel: "Delete",
    async onConfirm() {
      await removeExpense(id);
      state.expenses = state.expenses.filter((item) => item.id !== id);
      if (state.editingId === id) startNewExpense();
      renderAll();
      await captureAutoBackup("after delete");
      showToast("Expense deleted");
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Settings and backup                                                        */
/* -------------------------------------------------------------------------- */

async function handleRateSubmit(event) {
  event.preventDefault();
  showRateError("");

  const rate = normalizeRate(elements.rateInput.value);
  if (!rate) {
    showRateError("Enter a positive number with up to 6 decimal places.");
    elements.rateInput.focus();
    return;
  }

  try {
    await setSetting("exchangeRate", rate);
    state.exchangeRate = rate;
    updateRateDisplays();
    updateConversionPreview();
    renderAll();
    await captureAutoBackup("after rate change");
    showToast(
      `Rate saved · 1 ${state.trip.secondary.code} = ${formatRate(rate)} ${state.trip.primary.code}`
    );
  } catch (error) {
    console.error(error);
    showRateError("Could not save the exchange rate on this device.");
  }
}

function showTripError(message) {
  elements.tripError.textContent = message;
  elements.tripError.hidden = !message;
}

function readCurrencyInputs(prefix) {
  return {
    code: elements[`${prefix}Code`].value.trim().toUpperCase(),
    name: elements[`${prefix}Name`].value.trim().replace(/\s+/g, " "),
    symbol: elements[`${prefix}Symbol`].value.trim(),
  };
}

async function handleTripSubmit(event) {
  event.preventDefault();
  showTripError("");

  const name =
    elements.tripName.value.trim().replace(/\s+/g, " ").slice(0, MAX_TRIP_NAME) ||
    "My Trip";
  const primary = readCurrencyInputs("primary");
  const secondary = readCurrencyInputs("secondary");

  if (state.expenses.length) {
    // Currency fields are disabled while expenses exist, so keep the old ones.
    primary.code = state.trip.primary.code;
    primary.name = state.trip.primary.name;
    primary.symbol = state.trip.primary.symbol;
    secondary.code = state.trip.secondary.code;
    secondary.name = state.trip.secondary.name;
    secondary.symbol = state.trip.secondary.symbol;
  }

  if (!/^[A-Z0-9]{2,5}$/.test(primary.code) || !/^[A-Z0-9]{2,5}$/.test(secondary.code)) {
    showTripError("Currency codes must be 2–5 letters or digits.");
    return;
  }
  if (
    !primary.name ||
    primary.name.length > MAX_CURRENCY_NAME ||
    !secondary.name ||
    secondary.name.length > MAX_CURRENCY_NAME
  ) {
    showTripError(`Currency names must be 1–${MAX_CURRENCY_NAME} characters.`);
    return;
  }
  if (
    !primary.symbol ||
    primary.symbol.length > MAX_CURRENCY_SYMBOL ||
    !secondary.symbol ||
    secondary.symbol.length > MAX_CURRENCY_SYMBOL
  ) {
    showTripError(`Currency symbols must be 1–${MAX_CURRENCY_SYMBOL} characters.`);
    return;
  }
  if (primary.code === secondary.code) {
    showTripError("Choose two different currency codes.");
    return;
  }

  const next = { name, primary, secondary };
  try {
    await setSetting("tripProfile", next);
    state.trip = next;
    applyTripProfile();
    renderAll();
    await captureAutoBackup("after trip change");
    showToast("Trip settings saved");
  } catch (error) {
    console.error(error);
    showTripError("Could not save the trip settings on this device.");
  }
}

function confirmResetData() {
  openModal({
    icon: "alert",
    danger: true,
    title: "Reset all data?",
    message:
      "This removes every expense, custom category, the trip name, both currencies and the exchange rate from this iPhone. A recovery snapshot is saved in Automatic backups first. This cannot be undone.",
    confirmLabel: "Reset everything",
    async onConfirm() {
      await captureAutoBackup("before reset");
      await clearAllData();
      state.expenses = [];
      state.exchangeRate = DEFAULT_EXCHANGE_RATE;
      state.customCategories = [];
      state.trip = structuredClone(DEFAULT_TRIP_PROFILE);
      state.entryCurrency = "primary";
      state.editingId = null;
      state.editingRate = null;
      applyTripProfile();
      startNewExpense();
      renderCategoryPicker("Food");
      renderAll();
      navigate("home");
      showToast("All data reset");
    },
  });
}

function exportLatestBackup() {
  const [latest] = state.autoBackups;
  if (!latest) {
    showToast("No automatic backup to export yet.", "error");
    return;
  }
  exportSnapshot(latest);
}

function confirmDeleteBackups() {
  if (!state.autoBackups.length) return;
  openModal({
    icon: "trash",
    danger: true,
    title: "Delete automatic backups?",
    message: `All ${state.autoBackups.length} on-device snapshots will be removed. Your current expenses stay untouched.`,
    confirmLabel: "Delete backups",
    async onConfirm() {
      await clearBackups();
      state.autoBackups = [];
      renderAutoBackups();
      showToast("Automatic backups deleted");
    },
  });
}

function showCategoryError(message) {
  elements.categoryError.textContent = message;
  elements.categoryError.hidden = !message;
}

function renderIconPicker() {
  elements.iconPicker.replaceChildren();
  for (const icon of CATEGORY_ICON_OPTIONS) {
    const button = createEl("button", "icon-picker-btn");
    button.type = "button";
    button.dataset.icon = icon;
    button.setAttribute("aria-label", `${icon} icon`);
    button.setAttribute("aria-pressed", String(icon === state.newCategoryIcon));
    button.append(createIcon(icon));
    button.addEventListener("click", () => {
      state.newCategoryIcon = icon;
      renderIconPicker();
    });
    elements.iconPicker.append(button);
  }
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  showCategoryError("");

  const name = normalizeCategoryName(elements.categoryName.value);
  if (!name) {
    showCategoryError(
      `Enter a category name of 1–${MAX_CATEGORY_NAME} characters.`
    );
    elements.categoryName.focus();
    return;
  }
  if (
    isBuiltinCategory(name) ||
    state.customCategories.some(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    showCategoryError("That category already exists.");
    elements.categoryName.focus();
    return;
  }
  if (state.customCategories.length >= MAX_CUSTOM_CATEGORIES) {
    showCategoryError(
      `You can add up to ${MAX_CUSTOM_CATEGORIES} custom categories.`
    );
    return;
  }

  const next = [
    ...state.customCategories,
    { name, icon: state.newCategoryIcon, tone: nextCategoryTone() },
  ];

  try {
    await setSetting("customCategories", next);
    state.customCategories = next;
    elements.categoryName.value = "";
    renderAll();
    renderCategoryPicker(getSelectedCategory());
    await captureAutoBackup("after category added");
    showToast(`Category "${name}" added`);
  } catch (error) {
    console.error(error);
    showCategoryError("Could not save the category on this device.");
  }
}

function confirmDeleteCategory(name) {
  const category = state.customCategories.find((item) => item.name === name);
  if (!category) return;

  const count = state.expenses.filter(
    (expense) => expense.category === name
  ).length;

  if (count > 0) {
    openAlert(
      "Category in use",
      `"${name}" is used by ${count} expense${
        count === 1 ? "" : "s"
      }. Move or delete ${count === 1 ? "it" : "them"} before removing the category.`,
      true
    );
    return;
  }

  openModal({
    icon: "trash",
    danger: true,
    title: "Delete this category?",
    message: `"${name}" will be removed from the category picker. No expenses will be deleted.`,
    confirmLabel: "Delete",
    async onConfirm() {
      const next = state.customCategories.filter(
        (item) => item.name !== name
      );
      await setSetting("customCategories", next);
      state.customCategories = next;
      renderAll();
      renderCategoryPicker(getSelectedCategory());
      await captureAutoBackup("after category deleted");
      showToast("Category deleted");
    },
  });
}

function backupPayload() {
  return {
    app: "China Trip Expenses",
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    settings: {
      exchangeRate: state.exchangeRate,
      customCategories: state.customCategories.map((category) => ({
        name: category.name,
        icon: category.icon,
        tone: category.tone,
      })),
      tripProfile: structuredClone(state.trip),
    },
    expenses: sortedNewestFirst().map((expense) => ({
      id: expense.id,
      category: expense.category,
      description: expense.description || "",
      date: expense.date,
      primaryCents: primaryOf(expense),
      secondaryCents: secondaryOf(expense),
      exchangeRate: expense.exchangeRate,
      entryCurrency: entrySlotOf(expense),
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    })),
  };
}

function makeBackupId() {
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Save an on-device snapshot after every change. iPhone cannot silently write
 * to a user-chosen folder, so snapshots live in IndexedDB until exported.
 */
async function captureAutoBackup(reason) {
  try {
    const payload = backupPayload();
    const createdAt = new Date().toISOString();
    await addBackup({
      id: makeBackupId(),
      createdAt,
      reason,
      expenseCount: payload.expenses.length,
      payload,
    });
    await pruneBackups(MAX_AUTO_BACKUPS);
    state.autoBackups = await getAllBackups();
    renderAutoBackups();
  } catch (error) {
    console.error("Automatic backup failed", error);
  }
}

function exportSnapshot(snapshot) {
  if (!snapshot?.payload) {
    showToast("That backup could not be exported.", "error");
    return;
  }
  const json = JSON.stringify(snapshot.payload, null, 2);
  const stamp = snapshot.createdAt
    ? snapshot.createdAt.slice(0, 19).replace(/[:T]/g, "-")
    : dateStamp();
  downloadBlob(
    new Blob([json], { type: "application/json;charset=utf-8" }),
    `china-trip-expenses-backup-${stamp}.json`
  );
  showToast("Backup exported to Files");
}

function dateStamp() {
  return todayISO();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function exportJsonBackup() {
  const json = JSON.stringify(backupPayload(), null, 2);
  downloadBlob(
    new Blob([json], { type: "application/json;charset=utf-8" }),
    `china-trip-expenses-backup-${dateStamp()}.json`
  );
  showToast("JSON backup exported");
}

function validateCurrencyProfile(raw, label) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`The backup is missing its ${label} currency.`);
  }
  const code = String(raw.code ?? "").trim().toUpperCase();
  const name = String(raw.name ?? "").trim();
  const symbol = String(raw.symbol ?? "").trim();
  if (!/^[A-Z0-9]{2,5}$/.test(code)) {
    throw new Error(`The backup has an invalid ${label} currency code.`);
  }
  if (!name || name.length > MAX_CURRENCY_NAME) {
    throw new Error(`The backup has an invalid ${label} currency name.`);
  }
  if (!symbol || symbol.length > MAX_CURRENCY_SYMBOL) {
    throw new Error(`The backup has an invalid ${label} currency symbol.`);
  }
  return { code, name, symbol };
}

function validateTripProfile(raw) {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_TRIP_PROFILE);
  }
  const name = String(raw.name ?? "").trim().slice(0, MAX_TRIP_NAME);
  return {
    name: name || DEFAULT_TRIP_PROFILE.name,
    primary: validateCurrencyProfile(raw.primary, "destination"),
    secondary: validateCurrencyProfile(raw.secondary, "home"),
  };
}

function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The file does not contain a backup object.");
  }
  if (![1, 2, 3].includes(data.schemaVersion)) {
    throw new Error(
      "Unsupported backup version. Expected schemaVersion 1, 2 or 3."
    );
  }
  if (!data.settings || typeof data.settings !== "object") {
    throw new Error("The backup is missing its exchange rate settings.");
  }

  const exchangeRate = normalizeRate(data.settings.exchangeRate);
  if (!exchangeRate) {
    throw new Error("The backup contains an invalid exchange rate.");
  }
  const customCategories =
    data.schemaVersion >= 2
      ? validateCustomCategories(data.settings.customCategories)
      : [];
  const trip =
    data.schemaVersion >= 3
      ? validateTripProfile(data.settings.tripProfile)
      : structuredClone(DEFAULT_TRIP_PROFILE);
  const knownCategories = new Set([
    ...BUILTIN_CATEGORIES.map((category) => category.name),
    ...customCategories.map((category) => category.name),
  ]);

  if (!Array.isArray(data.expenses)) {
    throw new Error("The backup is missing its expense list.");
  }
  if (data.expenses.length > 100_000) {
    throw new Error("The backup contains too many expenses.");
  }

  const seenIds = new Set();
  const expenses = data.expenses.map((raw, index) => {
    const label = `Expense ${index + 1}`;
    if (!raw || typeof raw !== "object") {
      throw new Error(`${label} is invalid.`);
    }
    if (
      typeof raw.id !== "string" ||
      raw.id.length < 1 ||
      raw.id.length > 200 ||
      seenIds.has(raw.id)
    ) {
      throw new Error(`${label} has an invalid or duplicate ID.`);
    }
    seenIds.add(raw.id);

    if (!knownCategories.has(raw.category)) {
      throw new Error(`${label} has an unknown category.`);
    }
    if (!isValidDateString(raw.date)) {
      throw new Error(`${label} has an invalid date.`);
    }
    if (
      typeof raw.description !== "string" ||
      raw.description.length > 160
    ) {
      throw new Error(`${label} has an invalid description.`);
    }

    const primaryCents = Number.isSafeInteger(raw.primaryCents)
      ? raw.primaryCents
      : raw.cnyCents;
    const secondaryCents = Number.isSafeInteger(raw.secondaryCents)
      ? raw.secondaryCents
      : raw.aedCents;
    if (!Number.isSafeInteger(primaryCents) || primaryCents <= 0) {
      throw new Error(`${label} has an invalid destination amount.`);
    }
    if (!Number.isSafeInteger(secondaryCents) || secondaryCents < 0) {
      throw new Error(`${label} has an invalid home-currency amount.`);
    }

    const rate = normalizeRate(raw.exchangeRate);
    if (!rate) {
      throw new Error(`${label} has an invalid saved exchange rate.`);
    }

    const rawEntry =
      raw.entryCurrency === undefined
        ? data.schemaVersion >= 3
          ? "primary"
          : "CNY"
        : raw.entryCurrency;
    const entryCurrency =
      rawEntry === "secondary" || rawEntry === "AED" ? "secondary" : "primary";
    if (
      !["primary", "secondary", "CNY", "AED"].includes(rawEntry)
    ) {
      throw new Error(`${label} has an invalid entry currency.`);
    }

    // Amounts entered in either currency are valid when the saved pair
    // matches the rate in that direction.
    const fromPrimary = convertPrimaryToSecondaryCents(primaryCents, rate);
    const fromSecondary = convertSecondaryToPrimaryCents(secondaryCents, rate);
    if (fromPrimary !== secondaryCents && fromSecondary !== primaryCents) {
      throw new Error(
        `${label} has amounts that do not match its saved rate.`
      );
    }
    if (
      typeof raw.createdAt !== "string" ||
      !Number.isFinite(Date.parse(raw.createdAt))
    ) {
      throw new Error(`${label} has an invalid creation timestamp.`);
    }
    if (
      raw.updatedAt !== undefined &&
      (typeof raw.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(raw.updatedAt)))
    ) {
      throw new Error(`${label} has an invalid update timestamp.`);
    }

    return {
      id: raw.id,
      category: raw.category,
      description: raw.description,
      date: raw.date,
      primaryCents,
      secondaryCents,
      exchangeRate: rate,
      entryCurrency,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt || raw.createdAt,
    };
  });

  return { exchangeRate, customCategories, trip, expenses };
}

async function importBackupFile(file) {
  if (!file) return;
  elements.importFile.value = "";

  let parsed;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    openAlert(
      "Invalid backup",
      "That file is not valid JSON. Choose a China Trip Expenses JSON backup and try again.",
      true
    );
    return;
  }

  let backup;
  try {
    backup = validateBackup(parsed);
  } catch (error) {
    openAlert("Backup could not be imported", error.message, true);
    return;
  }

  openModal({
    icon: "upload",
    title: "Replace all data?",
    message: `This backup contains ${backup.expenses.length} expense${
      backup.expenses.length === 1 ? "" : "s"
    }, ${backup.customCategories.length} custom categor${
      backup.customCategories.length === 1 ? "y" : "ies"
    } and a rate of 1 ${backup.trip.secondary.code} = ${formatRate(
      backup.exchangeRate
    )} ${backup.trip.primary.code}. Your current ${state.expenses.length} expense${
      state.expenses.length === 1 ? "" : "s"
    } will be permanently replaced. This cannot be undone.`,
    confirmLabel: "Replace data",
    danger: true,
    async onConfirm() {
      await captureAutoBackup("before import");
      await replaceAllData(
        backup.expenses,
        backup.exchangeRate,
        backup.customCategories,
        backup.trip
      );
      state.expenses = backup.expenses;
      state.exchangeRate = backup.exchangeRate;
      state.customCategories = backup.customCategories;
      state.trip = backup.trip;
      applyTripProfile();
      startNewExpense();
      renderCategoryPicker("Food");
      renderAll();
      navigate("home");
      await captureAutoBackup("after import");
      showToast("Backup restored");
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Reports and exports                                                        */
/* -------------------------------------------------------------------------- */

function reportSnapshot() {
  const filtered = getFilteredReportExpenses();
  const categories = categoryTotals(filtered).filter(
    (category) => category.count > 0
  );
  const totals = sumExpenses(filtered);
  const rates = [
    ...new Set(
      filtered
        .map((expense) => normalizeRate(expense.exchangeRate))
        .filter(Boolean)
    ),
  ].sort((a, b) => (parseRate(a)?.value || 0) - (parseRate(b)?.value || 0));

  const generatedDate = new Date();
  const generatedLabel = `Generated ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(generatedDate)}`;

  return {
    expenses: filtered,
    sortedExpenses: sortedOldestFirst(filtered),
    categories,
    totals,
    rates: rates.length ? rates : [state.exchangeRate],
    periodLabel: getPeriodLabel(filtered),
    generatedLabel,
    range: getReportFilter(),
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsvReport() {
  const report = reportSnapshot();
  const primary = state.trip.primary;
  const secondary = state.trip.secondary;
  const lines = [];

  lines.push(
    [csvCell(`${state.trip.name} Expenses`), csvCell("Expense Report")].join(",")
  );
  lines.push([csvCell("Date range"), csvCell(report.periodLabel)].join(","));
  lines.push([csvCell("Generated"), csvCell(report.generatedLabel)].join(","));
  lines.push(
    [
      csvCell("Exchange rates"),
      csvCell(report.rates.map((rate) => formatRateLine(rate)).join("; ")),
    ].join(",")
  );
  lines.push("");
  lines.push(
    [
      "Date",
      "Category",
      "Description",
      `Amount (${primary.code})`,
      `Amount (${secondary.code})`,
      `Exchange rate (1 ${secondary.code} = ${primary.code})`,
    ]
      .map(csvCell)
      .join(",")
  );

  for (const expense of report.sortedExpenses) {
    lines.push(
      [
        expense.date,
        expense.category,
        expense.description || "",
        formatCents(primaryOf(expense)),
        formatCents(secondaryOf(expense)),
        formatRate(expense.exchangeRate),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  lines.push("");
  lines.push([csvCell("Category subtotals")].join(","));
  for (const category of report.categories) {
    lines.push(
      [
        category.category,
        `${category.count} item${category.count === 1 ? "" : "s"}`,
        "",
        formatCents(category.primaryCents),
        formatCents(category.secondaryCents),
        "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  lines.push("");
  lines.push(
    [
      "Grand total",
      "",
      "",
      formatCents(report.totals.primaryCents),
      formatCents(report.totals.secondaryCents),
      "",
    ]
      .map(csvCell)
      .join(",")
  );

  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `china-trip-expenses-${dateStamp()}.csv`
  );
  showToast("CSV report exported");
}

function exportPdfReport() {
  const report = reportSnapshot();
  const blob = createReportPdf({
    expenses: report.sortedExpenses.map((expense) => ({
      ...expense,
      primaryCents: primaryOf(expense),
      secondaryCents: secondaryOf(expense),
    })),
    totals: report.totals,
    categoryTotals: report.categories,
    rates: report.rates,
    periodLabel: report.periodLabel,
    generatedLabel: report.generatedLabel,
    tripName: state.trip.name,
    currency: structuredClone(state.trip),
  });
  downloadBlob(blob, `china-trip-expenses-report-${dateStamp()}.pdf`);
  showToast("PDF report exported");
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

function setModalIcon(icon, variant) {
  elements.modalIcon.className = `modal-icon${variant ? ` ${variant}` : ""}`;
  const use = elements.modalIcon.querySelector("use");
  if (use) use.setAttribute("href", `#i-${icon}`);
}

function openModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  icon = "alert",
  showCancel = true,
  onConfirm = null,
}) {
  state.lastFocusedBeforeModal = document.activeElement;
  state.modalHandler = onConfirm;
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalConfirm.textContent = confirmLabel;
  elements.modalConfirm.className = danger ? "button button-danger" : "button button-primary";
  elements.modalConfirm.disabled = false;
  elements.modalCancel.textContent = cancelLabel;
  elements.modalCancel.hidden = !showCancel;
  elements.modalActions.classList.toggle("single", !showCancel);
  setModalIcon(icon, danger ? "danger" : icon === "upload" ? "success" : "");
  elements.modal.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => elements.modalConfirm.focus());
}

function closeModal() {
  elements.modal.hidden = true;
  elements.modalHandler = null;
  document.body.style.overflow = "";
  if (state.lastFocusedBeforeModal?.focus) {
    state.lastFocusedBeforeModal.focus({ preventScroll: true });
  }
  state.lastFocusedBeforeModal = null;
}

function openAlert(title, message, danger = false) {
  openModal({
    title,
    message,
    confirmLabel: "OK",
    danger,
    showCancel: false,
    icon: "alert",
  });
}

async function handleModalConfirm() {
  if (!state.modalHandler) {
    closeModal();
    return;
  }

  elements.modalConfirm.disabled = true;
  elements.modalCancel.disabled = true;
  try {
    await state.modalHandler();
    closeModal();
  } catch (error) {
    console.error(error);
    elements.modalConfirm.disabled = false;
    elements.modalCancel.disabled = false;
    openAlert(
      "Something went wrong",
      error.message || "The action could not be completed on this device.",
      true
    );
  } finally {
    elements.modalCancel.disabled = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Event wiring                                                               */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  for (const button of elements.navButtons) {
    button.addEventListener("click", () => {
      const destination = button.dataset.nav;
      if (destination === "add") {
        startNewExpense();
        navigate("add");
        return;
      }
      if (state.activeView === "add") {
        state.editingId = null;
        state.editingRate = null;
        startNewExpense();
      }
      navigate(destination);
    });
  }

  elements.rateChip.addEventListener("click", () => navigate("settings"));

  elements.main.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    if (editButton && elements.main.contains(editButton)) {
      startEditExpense(editButton.dataset.edit);
      return;
    }

    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    if (deleteCategoryButton && elements.main.contains(deleteCategoryButton)) {
      confirmDeleteCategory(deleteCategoryButton.dataset.deleteCategory);
      return;
    }

    const exportBackupButton = event.target.closest("[data-export-backup]");
    if (exportBackupButton && elements.main.contains(exportBackupButton)) {
      const snapshot = state.autoBackups.find(
        (backup) => backup.id === exportBackupButton.dataset.exportBackup
      );
      if (snapshot) exportSnapshot(snapshot);
      return;
    }

    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton && elements.main.contains(deleteButton)) {
      confirmDeleteExpense(deleteButton.dataset.delete);
      return;
    }

    const goButton = event.target.closest("[data-go]");
    if (goButton && elements.main.contains(goButton)) {
      const destination = goButton.dataset.go;
      if (destination === "reports") {
        openReports();
      } else if (VIEWS.has(destination)) {
        navigate(destination);
      }
    }
  });

  document.querySelector("#home-add-btn").addEventListener("click", () => {
    startNewExpense();
    navigate("add");
  });

  elements.expenseAmount.addEventListener("input", () => {
    showFormError("");
    updateConversionPreview();
  });
  elements.expenseAmount.addEventListener("change", updateConversionPreview);
  elements.expenseForm.addEventListener("submit", handleExpenseSubmit);
  elements.cancelEditBtn.addEventListener("click", cancelEditing);

  for (const button of elements.currencyButtons) {
    button.addEventListener("click", () => {
      switchEntryCurrency(button.dataset.currency);
    });
  }

  elements.rateInput.addEventListener("input", () => showRateError(""));
  elements.rateForm.addEventListener("submit", handleRateSubmit);

  elements.categoryName.addEventListener("input", () => showCategoryError(""));
  elements.categoryForm.addEventListener("submit", handleCategorySubmit);

  elements.tripForm.addEventListener("submit", handleTripSubmit);
  elements.tripName.addEventListener("input", () => showTripError(""));
  elements.exportLatestBackupBtn.addEventListener("click", exportLatestBackup);
  elements.deleteBackupsBtn.addEventListener("click", confirmDeleteBackups);
  elements.resetDataBtn.addEventListener("click", confirmResetData);

  elements.exportJsonBtn.addEventListener("click", exportJsonBackup);
  elements.importJsonBtn.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    importBackupFile(file);
  });

  const rerenderReports = () => renderReports();
  elements.reportFrom.addEventListener("change", rerenderReports);
  elements.reportTo.addEventListener("change", rerenderReports);
  elements.rangeClearBtn.addEventListener("click", () => {
    elements.reportFrom.value = "";
    elements.reportTo.value = "";
    renderReports();
  });

  elements.exportCsvBtn.addEventListener("click", exportCsvReport);
  elements.exportPdfBtn.addEventListener("click", exportPdfReport);
  elements.reportsBackBtn.addEventListener("click", () => {
    navigate(state.reportsReturnView || "home");
  });

  elements.modalCancel.addEventListener("click", closeModal);
  elements.modalConfirm.addEventListener("click", handleModalConfirm);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.modal.hidden) {
      closeModal();
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (error) {
      console.error("Service worker registration failed", error);
    }
  });
}

async function init() {
  bindEvents();
  renderIconPicker();
  applyTripProfile();
  startNewExpense();
  elements.expenseDate.value = todayISO();
  updateRateDisplays();
  renderAll();
  navigate("home", { scroll: false });
  registerServiceWorker();

  try {
    await openDatabase();
    const [savedRate, storedExpenses, storedCategories, storedTrip, backups] =
      await Promise.all([
        getSetting("exchangeRate", DEFAULT_EXCHANGE_RATE),
        getAllExpenses(),
        getSetting("customCategories", []),
        getSetting("tripProfile", null),
        getAllBackups(),
      ]);

    const validatedRate = normalizeRate(savedRate);
    state.exchangeRate = validatedRate || DEFAULT_EXCHANGE_RATE;
    state.customCategories = readStoredCategories(storedCategories);
    state.trip = readStoredTrip(storedTrip);
    state.autoBackups = Array.isArray(backups) ? backups : [];
    state.expenses = Array.isArray(storedExpenses) ? storedExpenses : [];
    state.expenses.sort(compareExpensesNewestFirst);
    state.ready = true;

    applyTripProfile();
    updateRateDisplays();
    renderCategoryPicker(getSelectedCategory());
    renderAll();
    navigate("home", { scroll: false });
  } catch (error) {
    console.error(error);
    state.ready = false;
    showToast("Local storage is unavailable. Please check Safari settings.", "error");
  }
}

init();
