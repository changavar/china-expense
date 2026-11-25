const DB_NAME = "china-trip-expenses";
const DB_VERSION = 2;
const EXPENSES_STORE = "expenses";
const SETTINGS_STORE = "settings";
const BACKUPS_STORE = "backups";

let databasePromise = null;

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionAsPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("IndexedDB transaction was aborted"));
  });
}

export function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support local storage for expenses."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(EXPENSES_STORE)) {
        const expenseStore = database.createObjectStore(EXPENSES_STORE, {
          keyPath: "id",
        });
        expenseStore.createIndex("date", "date", { unique: false });
        expenseStore.createIndex("category", "category", { unique: false });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }

      if (!database.objectStoreNames.contains(BACKUPS_STORE)) {
        const backupStore = database.createObjectStore(BACKUPS_STORE, {
          keyPath: "id",
        });
        backupStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Could not open the local expense database."));
    };

    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("The local expense database is blocked by another tab."));
    };
  });

  return databasePromise;
}

export async function getAllExpenses() {
  const database = await openDatabase();
  const transaction = database.transaction(EXPENSES_STORE, "readonly");
  const result = await requestAsPromise(
    transaction.objectStore(EXPENSES_STORE).getAll()
  );
  await transactionAsPromise(transaction);
  return Array.isArray(result) ? result : [];
}

export async function putExpense(expense) {
  const database = await openDatabase();
  const transaction = database.transaction(EXPENSES_STORE, "readwrite");
  transaction.objectStore(EXPENSES_STORE).put(expense);
  await transactionAsPromise(transaction);
  return expense;
}

export async function removeExpense(id) {
  const database = await openDatabase();
  const transaction = database.transaction(EXPENSES_STORE, "readwrite");
  transaction.objectStore(EXPENSES_STORE).delete(id);
  await transactionAsPromise(transaction);
}

export async function getSetting(key, fallback = null) {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readonly");
  const result = await requestAsPromise(
    transaction.objectStore(SETTINGS_STORE).get(key)
  );
  await transactionAsPromise(transaction);
  return result ? result.value : fallback;
}

export async function setSetting(key, value) {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put({ key, value });
  await transactionAsPromise(transaction);
}

/**
 * Atomically replace every expense, the exchange rate, categories and trip profile.
 * Used by the confirmed backup restore flow only.
 */
export async function replaceAllData(
  expenses,
  exchangeRate,
  customCategories = [],
  tripProfile = null
) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [EXPENSES_STORE, SETTINGS_STORE],
    "readwrite"
  );
  const expenseStore = transaction.objectStore(EXPENSES_STORE);
  const settingsStore = transaction.objectStore(SETTINGS_STORE);

  expenseStore.clear();
  for (const expense of expenses) expenseStore.put(expense);
  settingsStore.put({ key: "exchangeRate", value: exchangeRate });
  settingsStore.put({ key: "customCategories", value: customCategories });
  if (tripProfile) {
    settingsStore.put({ key: "tripProfile", value: tripProfile });
  }

  await transactionAsPromise(transaction);
}

/**
 * Remove all expenses and settings. Automatic backups are kept on purpose so a
 * reset can still be recovered or exported.
 */
export async function clearAllData() {
  const database = await openDatabase();
  const transaction = database.transaction(
    [EXPENSES_STORE, SETTINGS_STORE],
    "readwrite"
  );
  transaction.objectStore(EXPENSES_STORE).clear();
  transaction.objectStore(SETTINGS_STORE).clear();
  await transactionAsPromise(transaction);
}

export async function addBackup(snapshot) {
  const database = await openDatabase();
  const transaction = database.transaction(BACKUPS_STORE, "readwrite");
  transaction.objectStore(BACKUPS_STORE).put(snapshot);
  await transactionAsPromise(transaction);
  return snapshot;
}

export async function getAllBackups() {
  const database = await openDatabase();
  const transaction = database.transaction(BACKUPS_STORE, "readonly");
  const result = await requestAsPromise(
    transaction.objectStore(BACKUPS_STORE).getAll()
  );
  await transactionAsPromise(transaction);
  if (!Array.isArray(result)) return [];
  return result.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

export async function deleteBackup(id) {
  const database = await openDatabase();
  const transaction = database.transaction(BACKUPS_STORE, "readwrite");
  transaction.objectStore(BACKUPS_STORE).delete(id);
  await transactionAsPromise(transaction);
}

export async function clearBackups() {
  const database = await openDatabase();
  const transaction = database.transaction(BACKUPS_STORE, "readwrite");
  transaction.objectStore(BACKUPS_STORE).clear();
  await transactionAsPromise(transaction);
}

/** Keep only the newest `keep` automatic backups. */
export async function pruneBackups(keep = 12) {
  const backups = await getAllBackups();
  if (backups.length <= keep) return;
  const database = await openDatabase();
  const transaction = database.transaction(BACKUPS_STORE, "readwrite");
  const store = transaction.objectStore(BACKUPS_STORE);
  for (const backup of backups.slice(keep)) store.delete(backup.id);
  await transactionAsPromise(transaction);
}

export async function getDatabaseSummary() {
  const expenses = await getAllExpenses();
  const exchangeRate = await getSetting("exchangeRate", null);
  return { expenses, exchangeRate };
}
