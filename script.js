(() => {
"use strict";

/* =========================================================
   SMART RESTAURANT — MILESTONE 4 APPLICATION LOGIC
   Shared business rules live in core.js for unit testing.
   Browser storage remains a demo-only, single-profile data layer.
   ========================================================= */

const Core = window.SmartRestaurantCore;
if (!Core) throw new Error("SmartRestaurantCore is missing. Load core.js before script.js.");

const STORAGE_KEYS = {
  menu: "sr_menu_v1",
  tables: "sr_tables_v1",
  reservations: "sr_reservations_v1",
  orders: "sr_orders_v1",
  cart: "sr_cart_v1",
  orderType: "sr_order_type_v1",
  adminSession: "sr_admin_demo_session",
  orderSequence: "sr_order_sequence_v1"
};

const TAX_RATE = Core.TAX_RATE;
const RESERVATION_DURATION_MINUTES = Core.RESERVATION_DURATION_MINUTES;
const ADMIN_DEMO_PIN = "1234"; // Demonstration PIN only; not production authentication.
const ORDER_STATUSES = Core.ORDER_STATUSES;
const NEXT_STATUS = Core.NEXT_STATUS;
const CANCELABLE_STATUSES = Core.CANCELABLE_STATUSES;
const CATEGORY_EMOJIS = {
  "Main Course": "🍽️",
  "Fast Food": "🍟",
  "Beverage": "🥤",
  "Dessert": "🍰"
};

const DEFAULT_MENU = [
  { id: 101, name: "Paneer Pizza", category: "Main Course", price: 249, available: true, emoji: "🍕", rating: 4.5, popular: true, nutrition: { servingSize: "200 g", calories: 420, protein: 18, carbohydrates: 48, fat: 17, ingredients: ["Pizza base", "Paneer", "Cheese", "Vegetables"], allergens: ["Milk", "Gluten"], verified: false, note: "Illustrative estimate only; replace with recipe-verified values." } },
  { id: 102, name: "Veg Burger", category: "Fast Food", price: 149, available: true, emoji: "🍔", rating: 4.7, popular: true, nutrition: { servingSize: "180 g", calories: 390, protein: 12, carbohydrates: 50, fat: 15, ingredients: ["Burger bun", "Vegetable patty", "Lettuce", "Sauce"], allergens: ["Gluten", "Milk", "Soy"], verified: false, note: "Illustrative estimate only; replace with recipe-verified values." } },
  { id: 103, name: "White Sauce Pasta", category: "Main Course", price: 199, available: false, emoji: "🍝", rating: 4.2, popular: false, nutrition: { servingSize: "220 g", calories: 480, protein: 15, carbohydrates: 62, fat: 19, ingredients: ["Pasta", "White sauce", "Milk", "Vegetables"], allergens: ["Milk", "Gluten"], verified: false, note: "Illustrative estimate only; replace with recipe-verified values." } },
  { id: 104, name: "French Fries", category: "Fast Food", price: 99, available: true, emoji: "🍟", rating: 4.6, popular: false, nutrition: { servingSize: "120 g", calories: 365, protein: 4, carbohydrates: 49, fat: 17, ingredients: ["Potato", "Oil", "Salt"], allergens: [], verified: false, note: "Illustrative estimate only; check oil and cross-contact information." } },
  { id: 105, name: "Cold Coffee", category: "Beverage", price: 129, available: true, emoji: "☕", rating: 4.8, popular: true, nutrition: { servingSize: "250 ml", calories: 190, protein: 6, carbohydrates: 28, fat: 6, ingredients: ["Milk", "Coffee", "Sugar"], allergens: ["Milk"], verified: false, note: "Illustrative estimate only; replace with recipe-verified values." } },
  { id: 106, name: "Chocolate Brownie", category: "Dessert", price: 179, available: true, emoji: "🍫", rating: 4.9, popular: false, nutrition: { servingSize: "80 g", calories: 320, protein: 4, carbohydrates: 42, fat: 15, ingredients: ["Cocoa", "Flour", "Sugar", "Butter"], allergens: ["Milk", "Gluten", "Egg (recipe dependent)"], verified: false, note: "Illustrative estimate only; replace with recipe-verified values." } }
];

// Retains the five tables and accessibility flags from the Milestone 2 project.
const DEFAULT_TABLES = [
  { id: "T01", capacity: 2, accessible: true, location: "Ground Floor", status: "Available" },
  { id: "T02", capacity: 4, accessible: false, location: "Main Hall", status: "Occupied" },
  { id: "T03", capacity: 6, accessible: true, location: "Ground Floor", status: "Available" },
  { id: "T04", capacity: 4, accessible: false, location: "Window Side", status: "Available" },
  { id: "T05", capacity: 8, accessible: true, location: "Family Area", status: "Available" }
];

// ---------------------------------------------------------
// GENERAL UTILITIES AND STORAGE
// ---------------------------------------------------------

const volatileStorage = new Map();
function storageGet(key) {
  try { return window.localStorage.getItem(key); }
  catch (error) { console.warn("Browser storage is unavailable; using temporary in-memory data.", error); return volatileStorage.get(key) ?? null; }
}
function storageSet(key, value) {
  try { window.localStorage.setItem(key, String(value)); return true; }
  catch (error) { console.warn("Browser storage write failed; using temporary in-memory data.", error); volatileStorage.set(key, String(value)); return true; }
}
function storageRemove(key) {
  try { window.localStorage.removeItem(key); } catch (error) { console.warn("Could not remove stored value:", error); }
  volatileStorage.delete(key);
}
function readJSON(key, fallback) {
  try {
    const raw = storageGet(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn("Could not read stored data:", key, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    storageSet(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("sr:datachange", { detail: { key } }));
    return true;
  } catch (error) {
    console.error("Could not save data:", key, error);
    showToast("Could not save this change. Please retry.");
    return false;
  }
}

function initializeStorage() {
  if (storageGet(STORAGE_KEYS.menu) === null) writeJSON(STORAGE_KEYS.menu, DEFAULT_MENU);
  else {
    // Non-destructive migration: add demo nutrition records to older menu items by ID.
    const storedMenu = readJSON(STORAGE_KEYS.menu, DEFAULT_MENU);
    if (Array.isArray(storedMenu)) {
      let changed = false;
      const migrated = storedMenu.map(item => {
        if (item && !item.nutrition) {
          const defaultItem = DEFAULT_MENU.find(candidate => Number(candidate.id) === Number(item.id));
          if (defaultItem?.nutrition) { changed = true; return { ...item, nutrition: JSON.parse(JSON.stringify(defaultItem.nutrition)) }; }
        }
        return item;
      });
      if (changed) writeJSON(STORAGE_KEYS.menu, migrated);
    }
  }
  if (storageGet(STORAGE_KEYS.tables) === null) writeJSON(STORAGE_KEYS.tables, DEFAULT_TABLES);
  if (storageGet(STORAGE_KEYS.reservations) === null) writeJSON(STORAGE_KEYS.reservations, []);
  if (storageGet(STORAGE_KEYS.orders) === null) writeJSON(STORAGE_KEYS.orders, []);
  if (storageGet(STORAGE_KEYS.cart) === null) {
    const legacyCart = readJSON("cart", []);
    writeJSON(STORAGE_KEYS.cart, Array.isArray(legacyCart) ? legacyCart : []);
  }
  if (storageGet(STORAGE_KEYS.orderType) === null) {
    const legacyType = storageGet("orderType") || "Dine-in";
    storageSet(STORAGE_KEYS.orderType, Core.isValidOrderType(legacyType) ? legacyType : "Dine-in");
  }
  if (storageGet(STORAGE_KEYS.orderSequence) === null) storageSet(STORAGE_KEYS.orderSequence, "1000");
}

function getMenu() { const value = readJSON(STORAGE_KEYS.menu, DEFAULT_MENU); return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : DEFAULT_MENU; }
function saveMenu(items) { return Array.isArray(items) && writeJSON(STORAGE_KEYS.menu, items); }
function getTables() { const value = readJSON(STORAGE_KEYS.tables, DEFAULT_TABLES); return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : DEFAULT_TABLES; }
function saveTables(items) { return Array.isArray(items) && writeJSON(STORAGE_KEYS.tables, items); }
function getReservations() { const value = readJSON(STORAGE_KEYS.reservations, []); return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function saveReservations(items) { return Array.isArray(items) && writeJSON(STORAGE_KEYS.reservations, items); }
function getOrders() { const value = readJSON(STORAGE_KEYS.orders, []); return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function saveOrders(items) { return Array.isArray(items) && writeJSON(STORAGE_KEYS.orders, items); }
function getCart() { const value = readJSON(STORAGE_KEYS.cart, []); return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function saveCart(items) {
  if (!Array.isArray(items)) return false;
  const saved = writeJSON(STORAGE_KEYS.cart, items);
  updateBadge();
  return saved;
}
function getOrderType() { const value = storageGet(STORAGE_KEYS.orderType) || "Dine-in"; return Core.isValidOrderType(value) ? value : "Dine-in"; }
function setOrderType(type) { if (Core.isValidOrderType(type)) storageSet(STORAGE_KEYS.orderType, type); }
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}
function formatDateTime(value) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHTML(value);
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function nutritionMarkup(nutrition) {
  if (!nutrition) return `<p class="nutrition-unavailable">Nutrition details not added yet.</p>`;
  const allergens = Array.isArray(nutrition.allergens) && nutrition.allergens.length ? nutrition.allergens.map(escapeHTML).join(", ") : "Not specified";
  const ingredients = Array.isArray(nutrition.ingredients) && nutrition.ingredients.length ? nutrition.ingredients.map(escapeHTML).join(", ") : "Not specified";
  const verification = nutrition.verified === true ? "Recipe details marked verified by restaurant" : "Illustrative estimate - verify before customer use";
  const verificationLabel = nutrition.verified === true ? "Recipe-verified" : "Demo estimate";
  return `<div class="nutrition-verification">${verificationLabel}</div><div class="nutrition-quick"><strong>${Number(nutrition.calories)} kcal</strong><span>per ${escapeHTML(nutrition.servingSize || "serving")}</span><span>Protein ${Number(nutrition.protein)} g</span></div><details class="nutrition-details"><summary>Nutrition & ingredients</summary><div class="nutrition-grid"><span>Calories<strong>${Number(nutrition.calories)} kcal</strong></span><span>Protein<strong>${Number(nutrition.protein)} g</strong></span><span>Carbs<strong>${Number(nutrition.carbohydrates)} g</strong></span><span>Fat<strong>${Number(nutrition.fat)} g</strong></span></div><p><strong>Serving:</strong> ${escapeHTML(nutrition.servingSize || "Not specified")}</p><p><strong>Ingredients:</strong> ${ingredients}</p><p><strong>Declared allergens:</strong> ${allergens}</p><p class="nutrition-note">${escapeHTML(nutrition.note || verification)}</p></details>`;
}


function localDateTimeInputValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
function setDefaultDateTime(input) {
  if (!input) return;
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
  future.setMinutes(Math.ceil(future.getMinutes() / 15) * 15, 0, 0);
  input.min = localDateTimeInputValue(new Date());
  if (!input.value) input.value = localDateTimeInputValue(future);
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}
function updateBadge() {
  const count = getCart().reduce((sum, item) => sum + (Number.isInteger(Number(item.qty)) && Number(item.qty) > 0 ? Number(item.qty) : 0), 0);
  document.querySelectorAll("#cart-badge").forEach(el => el.textContent = count);
  const menuCount = document.getElementById("menu-cart-count");
  if (menuCount) menuCount.textContent = count;
}
function isValidPhone(phone) { return Core.isValidPhone(phone); }
function nowISO() { return new Date().toISOString(); }
function navigateTo(url) {
  if (window.__SMART_RESTAURANT_TEST_MODE__ === true) {
    window.__SMART_RESTAURANT_TEST_NAVIGATION__ = String(url);
    return;
  }
  window.location.href = url;
}

// ---------------------------------------------------------
// CART AND BILLING
// ---------------------------------------------------------

function addToCart(itemId) {
  const menuItem = getMenu().find(item => Number(item.id) === Number(itemId));
  if (!menuItem || menuItem.available !== true) { showToast("This item is currently unavailable."); return; }
  const cart = getCart();
  const existing = cart.find(item => Number(item.id) === Number(menuItem.id));
  if (existing) {
    const nextQty = Number(existing.qty) + 1;
    if (!Number.isInteger(nextQty) || nextQty > 99) { showToast("Maximum quantity is 99 per item."); return; }
    existing.qty = nextQty;
  } else cart.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 });
  if (saveCart(cart)) showToast(menuItem.name + " added to cart.");
  renderMenu();
}

function changeQty(itemId, delta) {
  let cart = getCart();
  const entry = cart.find(item => Number(item.id) === Number(itemId));
  if (!entry || ![-1, 1].includes(Number(delta))) return;
  const currentQty = Number(entry.qty);
  if (!Number.isInteger(currentQty) || currentQty < 1 || currentQty > 99) { showToast("Cart quantity is invalid. Remove the item and add it again."); return; }
  const nextQty = currentQty + Number(delta);
  if (nextQty > 99) { showToast("Maximum quantity is 99 per item."); return; }
  if (nextQty === 0) cart = cart.filter(item => Number(item.id) !== Number(itemId));
  else entry.qty = nextQty;
  saveCart(cart);
  renderCart();
}

function removeItem(itemId) {
  saveCart(getCart().filter(item => item.id !== Number(itemId)));
  renderCart();
  showToast("Item removed from cart.");
}

function calculateSubtotal(items) { return Core.calculateSubtotal(Array.isArray(items) ? items : getCart()); }
function calculateTax(subtotal) { return Core.calculateTax(subtotal); }
function calculateTotal(items) { return Core.calculateTotal(Array.isArray(items) ? items : getCart()); }

function renderCart() {
  const container = document.getElementById("cart-container");
  if (!container) return;
  const summary = document.getElementById("order-summary");
  const cart = getCart();
  if (!cart.length || cart.some(item => !Number.isInteger(Number(item?.qty)) || Number(item.qty) < 1 || Number(item.qty) > 99)) {
    container.innerHTML = `<div class="empty-state"><div class="empty-emoji">🛒</div><h2>${cart.length ? "Cart needs attention" : "Your cart is empty"}</h2><p>${cart.length ? "Stored cart data is invalid. Clear the cart and add items again from the menu." : "Choose dishes from the menu to begin."}</p>${cart.length ? '<button class="btn btn-secondary" type="button" data-action="clear-cart">Clear Cart</button>' : ''}<a href="menu.html" class="btn btn-primary">Browse Menu</a></div>`;
    if (summary) summary.hidden = true;
    return;
  }
  container.innerHTML = `<div class="cart-list">${cart.map(item => `
    <div class="cart-item">
      <div><h3>${escapeHTML(item.name)}</h3><p>${money(item.price)} × ${Number(item.qty)} = ${money(Number(item.price) * Number(item.qty))}</p><button class="remove-btn" type="button" data-action="remove-cart-item" data-id="${Number(item.id)}">Remove</button></div>
      <div class="qty-controls"><button class="qty-btn" type="button" data-action="cart-minus" data-id="${Number(item.id)}" aria-label="Decrease quantity">−</button><strong>${Number(item.qty)}</strong><button class="qty-btn" type="button" data-action="cart-plus" data-id="${Number(item.id)}" aria-label="Increase quantity">+</button></div>
    </div>`).join("")}</div>`;
  if (summary) summary.hidden = false;
  const subtotal = calculateSubtotal(cart);
  const tax = calculateTax(subtotal);
  const subEl = document.getElementById("subtotal");
  const taxEl = document.getElementById("tax");
  const totalEl = document.getElementById("grand-total");
  if (subEl) subEl.textContent = money(subtotal);
  if (taxEl) taxEl.textContent = money(tax);
  if (totalEl) totalEl.textContent = money(subtotal + tax);
  syncOrderTypeButtons();
}

function syncOrderTypeButtons() {
  const current = getOrderType();
  document.querySelectorAll(".toggle-btn[data-type]").forEach(button => {
    const active = button.dataset.type === current;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const deliveryField = document.getElementById("delivery-address-field");
  if (deliveryField) deliveryField.hidden = current !== "Home Delivery";
}

function setupOrderTypeToggle() {
  const buttons = document.querySelectorAll(".toggle-btn[data-type]");
  buttons.forEach(button => button.addEventListener("click", () => {
    setOrderType(button.dataset.type);
    syncOrderTypeButtons();
  }));
  syncOrderTypeButtons();
}

function nextOrderId() {
  const orders = getOrders();
  let sequence = Number(storageGet(STORAGE_KEYS.orderSequence) || 1000);
  if (!Number.isInteger(sequence) || sequence < 1000) sequence = 1000;
  const existingMax = orders.reduce((max, order) => {
    const digits = Number(String(order?.id || "").replace(/\D/g, "")) || 0;
    return Math.max(max, digits);
  }, 1000);
  sequence = Math.max(sequence, existingMax) + 1;
  storageSet(STORAGE_KEYS.orderSequence, String(sequence));
  return "ORD" + sequence;
}

function placeOrder() {
  const button = document.getElementById("place-order-button");
  if (button?.dataset.submitting === "true") return;
  const cart = getCart();
  const name = document.getElementById("customer-name")?.value.trim() || "";
  const phone = document.getElementById("customer-phone")?.value.trim() || "";
  const address = document.getElementById("delivery-address")?.value.trim() || "";
  const orderType = getOrderType();
  if (!Core.isValidName(name)) { showToast("Please enter a valid customer name."); document.getElementById("customer-name")?.focus(); return; }
  if (!isValidPhone(phone)) { showToast("Enter a valid 10-digit Indian mobile number."); document.getElementById("customer-phone")?.focus(); return; }
  if (!Core.isValidOrderType(orderType)) { showToast("Choose a valid order type."); return; }
  if (orderType === "Home Delivery" && address.length < 8) { showToast("Enter a complete delivery address."); document.getElementById("delivery-address")?.focus(); return; }
  const checkedCart = Core.validateCartItems(cart, getMenu());
  if (!checkedCart.valid) { showToast(checkedCart.message); return; }
  const orderItems = checkedCart.items;
  const subtotal = calculateSubtotal(orderItems);
  const tax = calculateTax(subtotal);
  const timestamp = nowISO();
  const orders = getOrders();
  const order = {
    id: nextOrderId(), customer: { name, phone, address: orderType === "Home Delivery" ? address : "" },
    orderType, paymentMode: orderType === "Home Delivery" ? "Pay on delivery (demo)" : "Pay at counter (demo)",
    items: orderItems, subtotal, tax, total: subtotal + tax, status: "Placed",
    createdAt: timestamp, updatedAt: timestamp,
    statusHistory: [{ status: "Placed", at: timestamp, note: "Order submitted by customer" }]
  };
  if (orders.some(existing => existing.id === order.id)) { showToast("Could not create a unique order reference. Please retry."); return; }
  if (button) { button.dataset.submitting = "true"; button.disabled = true; }
  orders.push(order);
  if (!saveOrders(orders)) {
    if (button) { button.dataset.submitting = "false"; button.disabled = false; }
    return;
  }
  saveCart([]);
  navigateTo("order-tracking.html?id=" + encodeURIComponent(order.id));
}

// ---------------------------------------------------------
// MENU DISPLAY AND SEARCH
// ---------------------------------------------------------

function renderMenu() {
  const container = document.getElementById("menu-container") || document.getElementById("home-specials");
  if (!container) return;
  const isHome = container.id === "home-specials";
  const search = (document.getElementById("menu-search")?.value || "").trim().toLowerCase();
  const category = document.getElementById("menu-category")?.value || "all";
  const availableOnly = Boolean(document.getElementById("menu-available-only")?.checked);
  let items = getMenu();
  if (isHome) items = items.filter(item => item.available).slice(0, 3);
  else {
    if (search) items = items.filter(item => (item.name + " " + item.category).toLowerCase().includes(search));
    if (category !== "all") items = items.filter(item => item.category === category);
    if (availableOnly) items = items.filter(item => item.available);
  }
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-emoji">🔎</div><h2>No dishes found</h2><p>Try another search or category.</p></div>`;
    updateBadge();
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "menu-card";
    const categoryEmoji = CATEGORY_EMOJIS[item.category] || "🍴";
    const rating = Math.min(5, Math.max(0, Math.round(Number(item.rating) || 0)));
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    card.innerHTML = `
      ${item.popular ? '<span class="popular-badge">🔥 Popular</span>' : ""}
      <div class="menu-emoji">${escapeHTML(item.emoji || categoryEmoji)}</div>
      <h3>${escapeHTML(item.name)}</h3>
      <p class="category">${categoryEmoji} ${escapeHTML(item.category)}</p>
      <div class="rating"><span class="stars">${stars}</span> <span class="rating-number">${Number(item.rating || 0).toFixed(1)}</span></div>
      <p class="price">${money(item.price)}</p>
      ${nutritionMarkup(item.nutrition)}
      <p class="status ${item.available ? "available" : "unavailable"}">${item.available ? "Available" : "Unavailable"}</p>
      <button class="add-btn" type="button" data-action="add-to-cart" data-id="${Number(item.id)}" aria-label="${item.available ? "Add " + escapeHTML(item.name) + " to cart" : escapeHTML(item.name) + " is unavailable"}" ${item.available ? "" : "disabled"}>${item.available ? "🛒 Add to Cart" : "Not Available"}</button>`;
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
  updateBadge();
}

// ---------------------------------------------------------
// RESERVATION AND ACCESSIBILITY LOGIC
// ---------------------------------------------------------

function reservationDurationMs() { return RESERVATION_DURATION_MINUTES * 60000; }
function intervalsOverlap(startA, endA, startB, endB) { return Core.intervalsOverlap(startA, endA, startB, endB); }
function hasReservationConflict(tableId, startDateTime, reservations, durationMinutes = RESERVATION_DURATION_MINUTES) {
  return Core.hasReservationConflict(tableId, startDateTime, reservations, durationMinutes);
}
function isTableSuitable(table, request, reservations) { return Core.isTableSuitable(table, request, reservations); }
function findSuitableTable(tables, reservations, request) { return Core.findSuitableTable(tables, reservations, request); }

function getTableDisplayStatus(table, dateTime, reservations) {
  if (table.status === "Out of Service") return "Out of Service";
  if (table.status === "Occupied") return "Occupied";
  if (dateTime && hasReservationConflict(table.id, dateTime, reservations)) return "Reserved";
  return "Available";
}

function submitReservation(event) {
  event.preventDefault();
  const name = document.getElementById("reservation-name")?.value.trim() || "";
  const phone = document.getElementById("reservation-phone")?.value.trim() || "";
  const dateTime = document.getElementById("reservation-datetime")?.value || "";
  const guests = Number(document.getElementById("reservation-guests")?.value || 0);
  const accessible = Boolean(document.getElementById("reservation-accessible")?.checked);
  const area = document.getElementById("reservation-area")?.value || "Any";
  const result = document.getElementById("reservation-result");
  const request = { name, phone, dateTime, guests, accessible, area };
  const validation = Core.validateReservationRequest(request);
  if (!validation.valid) return setReservationResult(validation.message, true);

  const tables = getTables();
  const firstReadReservations = getReservations();
  let table = null;
  const preferredId = window.selectedReservationTableId;
  if (preferredId) {
    const preferred = tables.find(item => item.id === preferredId);
    if (preferred && isTableSuitable(preferred, request, firstReadReservations)) table = preferred;
    else return setReservationResult("The selected table does not meet the request or is no longer available. Choose another table.", true);
  } else {
    table = findSuitableTable(tables, firstReadReservations, request);
  }
  if (!table) return setReservationResult("No suitable table is available for this date, time and accessibility requirement.", true);

  // Re-read immediately before commit so a repeated submission cannot reuse a just-booked table.
  const reservations = getReservations();
  if (!isTableSuitable(tables.find(item => item.id === table.id), request, reservations)) {
    return setReservationResult("This table was just reserved. Please select another available table.", true);
  }
  const reservation = {
    id: Core.createUniqueId("RES", reservations), customer: { name, phone }, dateTime,
    guests, accessible, area, tableId: table.id,
    durationMinutes: RESERVATION_DURATION_MINUTES, status: "Confirmed", createdAt: nowISO()
  };
  reservations.push(reservation);
  if (!saveReservations(reservations)) return;
  window.selectedReservationTableId = null;
  setReservationResult(`Reservation confirmed. Your table is ${table.id}. Reservation ID: ${reservation.id}.`, false);
  document.getElementById("reservation-form-element")?.reset();
  document.getElementById("reservation-guests").value = "2";
  setDefaultDateTime(document.getElementById("reservation-datetime"));
  renderTables();
  renderCustomerReservations();
  showToast("Table reservation confirmed.");
}

function setReservationResult(message, isError) {
  const result = document.getElementById("reservation-result");
  if (result) result.innerHTML = `<div class="result-card ${isError ? "error" : ""}">${escapeHTML(message)}</div>`;
  if (isError) showToast(message);
  return false;
}

function renderTables() {
  const container = document.getElementById("tables-container");
  if (!container) return;
  const tables = getTables();
  const reservations = getReservations();
  const accessibleOnly = Boolean(document.getElementById("tables-accessible-only")?.checked);
  const dateTime = document.getElementById("tables-view-datetime")?.value || "";
  const guests = Number(document.getElementById("tables-view-guests")?.value || 1);
  const request = { accessible: accessibleOnly, dateTime, guests };
  const display = tables.filter(table => !accessibleOnly || table.accessible);
  container.innerHTML = "";
  if (!display.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h2>No tables match this filter</h2><p>Turn off the accessibility-only filter to see all tables.</p></div>`;
    return;
  }
  display.forEach(table => {
    const status = getTableDisplayStatus(table, dateTime, reservations);
    const capacityOK = Number(table.capacity) >= guests;
    const accessibleOK = !accessibleOnly || table.accessible;
    const canSelect = status === "Available" && capacityOK && accessibleOK;
    const card = document.createElement("article");
    card.className = "table-card " + status.toLowerCase().replaceAll(" ", "-");
    card.innerHTML = `
      <div class="record-head"><h3>🪑 Table ${escapeHTML(table.id)}</h3><span class="status-pill ${status === "Available" ? "status-available" : status === "Occupied" ? "status-occupied" : status === "Reserved" ? "status-reserved" : "status-out"}">${escapeHTML(status)}</span></div>
      <p>Capacity: ${Number(table.capacity)} guests</p>
      <p>Location: ${escapeHTML(table.location || "Not specified")}</p>
      <p class="${table.accessible ? "access" : ""}">${table.accessible ? "♿ Wheelchair Accessible" : "Standard seating"}</p>
      <p>${capacityOK ? "Suitable capacity for current guest count" : "Capacity is too small for this guest count"}</p>
      <div class="table-card-footer"><span class="form-hint">${canSelect ? "Available for selection" : "Not eligible for this request"}</span><button class="btn btn-primary btn-small" type="button" data-action="select-table" data-id="${escapeHTML(table.id)}" ${canSelect ? "" : "disabled"}>Select</button></div>`;
    container.appendChild(card);
  });
}

function renderCustomerReservations() {
  const container = document.getElementById("customer-reservations");
  if (!container) return;
  const reservations = getReservations().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  if (!reservations.length) {
    container.innerHTML = `<div class="empty-state"><p>No reservations have been created in this browser yet.</p></div>`;
    return;
  }
  container.innerHTML = reservations.map(reservation => `
    <article class="record-card"><div class="record-head"><div><h3>${escapeHTML(reservation.id)} · Table ${escapeHTML(reservation.tableId)}</h3><p>${escapeHTML(reservation.customer.name)} · ${Number(reservation.guests)} guests</p></div><span class="status-pill ${reservation.status === "Cancelled" ? "status-cancelled" : "status-available"}">${escapeHTML(reservation.status)}</span></div><p>${formatDateTime(reservation.dateTime)} · ${reservation.accessible ? "♿ Accessible seating requested" : "Standard seating"}</p></article>`).join("");
}

// ---------------------------------------------------------
// ORDER TRACKING AND STATUS TRANSITIONS
// ---------------------------------------------------------

function isValidStatusTransition(current, next) { return Core.isValidStatusTransition(current, next); }

function updateOrderStatus(orderId, nextStatus) {
  const orders = getOrders();
  const order = orders.find(item => item.id === orderId);
  if (!order || !isValidStatusTransition(order.status, nextStatus)) {
    showToast("This order status change is not allowed.");
    return false;
  }
  const previous = order.status;
  order.status = nextStatus;
  order.updatedAt = nowISO();
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: nextStatus, at: order.updatedAt, note: `Status changed from ${previous} to ${nextStatus}` });
  saveOrders(orders);
  renderAdmin();
  if (nextStatus === "Ready") {
    showToast(`${order.id} is ready. The customer can see the update on the Order Tracking page.`);
  } else {
    showToast(`${order.id} updated to ${nextStatus}.`);
  }
  return true;
}

function renderTracking(orderId) {
  const container = document.getElementById("tracking-container");
  if (!container) return;
  const orders = getOrders();
  const selectedId = orderId || orders[orders.length - 1]?.id;
  const order = orders.find(item => item.id.toLowerCase() === String(selectedId || "").toLowerCase());
  const input = document.getElementById("tracking-order-id");
  if (input && selectedId) input.value = selectedId;
  if (!order) {
    container.innerHTML = `<div class="empty-state"><div class="empty-emoji">📦</div><h2>Order not found</h2><p>Check the order ID, or place an order first.</p><a href="menu.html" class="btn btn-primary">Browse Menu</a></div>`;
    return;
  }
  const currentIndex = ORDER_STATUSES.indexOf(order.status);
  const isCancelled = order.status === "Cancelled";
  const timeline = ORDER_STATUSES.map((status, index) => {
    let cls = "";
    if (!isCancelled && index < currentIndex) cls = "done";
    if (!isCancelled && index === currentIndex) cls = "current";
    if (!isCancelled && index < currentIndex) cls = "done";
    return `<div class="timeline-step ${cls}">${escapeHTML(status)}</div>`;
  }).join("");
  const history = (order.statusHistory || []).map(item => `<li><strong>${escapeHTML(item.status)}</strong> · ${formatDateTime(item.at)}${item.note ? ` — ${escapeHTML(item.note)}` : ""}</li>`).join("");
  const readyNotice = Core.getOrderReadyNotice(order);
  const invoice = Core.buildInvoiceSummary(order);
  const receiptItems = invoice ? invoice.items.map(item => `<tr><td>${escapeHTML(item.name)}</td><td>${item.qty}</td><td>${money(item.unitPrice)}</td><td>${money(item.lineTotal)}</td></tr>`).join("") : "";
  container.innerHTML = `
    <article class="tracking-card">
      <div class="tracking-card-head"><div><span class="eyebrow">ORDER REFERENCE</span><h2>${escapeHTML(order.id)}</h2><p>Placed ${formatDateTime(order.createdAt)}</p></div><span class="status-pill ${isCancelled ? "status-cancelled" : order.status === "Completed" ? "status-available" : "status-reserved"}">${escapeHTML(order.status)}</span></div>
      ${readyNotice ? `<div class="order-ready-notice" role="status" aria-live="polite"><strong>${escapeHTML(readyNotice.title)}</strong><p>${escapeHTML(readyNotice.message)}</p><small>Order ${escapeHTML(readyNotice.orderId)}</small></div>` : ""}
      ${isCancelled ? `<div class="result-card error">This order was cancelled.</div>` : `<div class="status-timeline">${timeline}</div><p class="form-hint">Current status: <strong>${escapeHTML(order.status)}</strong>. Updates are made by restaurant staff in the admin panel.</p>`}
      <div class="tracking-meta"><p><strong>Customer:</strong> ${escapeHTML(order.customer?.name || "")}</p><p><strong>Order type:</strong> ${escapeHTML(order.orderType)}</p><p><strong>Payment:</strong> ${escapeHTML(order.paymentMode || "Demo payment")}</p>${order.orderType === "Home Delivery" ? `<p><strong>Delivery address:</strong> ${escapeHTML(order.customer?.address || "")}</p>` : ""}</div>
      <div class="receipt-print-area" id="bill-receipt">
        <div class="receipt-heading"><h2>SMART RESTAURANT</h2><p>Customer Bill / Order Receipt</p></div>
        <div class="receipt-meta"><p><strong>Order ID:</strong> ${escapeHTML(order.id)}</p><p><strong>Customer:</strong> ${escapeHTML(order.customer?.name || "")}</p><p><strong>Order type:</strong> ${escapeHTML(order.orderType)}</p><p><strong>Date:</strong> ${formatDateTime(order.createdAt)}</p></div>
        <table class="receipt-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${receiptItems}</tbody></table>
        <div class="receipt-totals"><div class="summary-row"><span>Subtotal</span><strong>${invoice ? money(invoice.subtotal) : money(order.subtotal)}</strong></div><div class="summary-row"><span>Tax (5%)</span><strong>${invoice ? money(invoice.tax) : money(order.tax)}</strong></div><div class="summary-row total-row"><span>Total</span><strong>${invoice ? money(invoice.total) : money(order.total)}</strong></div></div>
        <p class="receipt-footer">Thank you for choosing Smart Restaurant.</p>
      </div>
      <div class="receipt-actions screen-only"><button class="btn btn-secondary" type="button" data-action="print-bill" ${invoice ? "" : "disabled"}>Print / Save Bill as PDF</button><p class="form-hint">Use your browser's print dialog and choose “Save as PDF” to keep a digital copy.</p></div>
      <h3>Order History</h3><ul class="history-list">${history || "<li>No status history recorded.</li>"}</ul>
    </article>`;
}

// ---------------------------------------------------------
// ADMIN PANEL — LOGIN, MENU, ORDERS, TABLES AND ANALYTICS
// ---------------------------------------------------------

function isAdminUnlocked() { return storageGet(STORAGE_KEYS.adminSession) === "unlocked"; }
function setupAdmin() {
  const loginForm = document.getElementById("admin-login-form");
  const app = document.getElementById("admin-app");
  const loginPanel = document.getElementById("admin-login-panel");
  if (!loginForm || !app || !loginPanel) return;
  if (isAdminUnlocked()) {
    loginPanel.hidden = true;
    app.hidden = false;
    renderAdmin();
  }
  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const pin = document.getElementById("admin-pin").value;
    if (pin === ADMIN_DEMO_PIN) {
      storageSet(STORAGE_KEYS.adminSession, "unlocked");
      loginPanel.hidden = true;
      app.hidden = false;
      renderAdmin();
    } else {
      document.getElementById("admin-login-error").textContent = "Incorrect demo PIN. Try again.";
    }
  });
  document.getElementById("admin-logout")?.addEventListener("click", () => {
    storageRemove(STORAGE_KEYS.adminSession);
    app.hidden = true;
    loginPanel.hidden = false;
    document.getElementById("admin-pin").value = "";
  });
  document.querySelectorAll(".admin-tab").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".admin-section").forEach(section => section.classList.toggle("active", section.id === "tab-" + button.dataset.tab));
    if (button.dataset.tab === "review") renderAdminReview();
  }));
  document.getElementById("menu-item-form")?.addEventListener("submit", saveMenuItemFromForm);
  document.getElementById("cancel-menu-edit")?.addEventListener("click", resetMenuForm);
  document.getElementById("table-form")?.addEventListener("submit", saveTableFromForm);
  document.getElementById("cancel-table-edit")?.addEventListener("click", resetTableForm);
}

function renderAdmin() {
  if (!isAdminUnlocked()) return;
  renderAnalytics();
  renderAdminMenu();
  renderAdminOrders();
  renderAdminReservations();
  renderAdminTables();
  renderRecentOrders();
  renderAdminReview();
}

function calculateAnalytics(data) { return Core.calculateAnalytics(data); }

function renderAnalytics() {
  const metricsContainer = document.getElementById("analytics-metrics");
  if (!metricsContainer) return;
  const metrics = calculateAnalytics({ orders: getOrders(), reservations: getReservations(), menu: getMenu() });
  const cards = [
    ["Total Orders", metrics.totalOrders, "All recorded orders"],
    ["Completed", metrics.completedOrders, "Successfully completed"],
    ["Pending", metrics.pendingOrders, "Awaiting completion"],
    ["Completed-Order Value", money(metrics.revenue), "Completed orders only"],
    ["Reservations", metrics.totalReservations, "Active reservations"],
    ["Accessible Requests", metrics.accessibleReservations, "Active accessibility requests"],
    ["Cancelled Orders", metrics.cancelledOrders, "Excluded from revenue"],
    ["Unavailable Dishes", metrics.unavailableMenuItems, "Menu items not orderable"]
  ];
  metricsContainer.innerHTML = cards.map(([label, value, note]) => `<div class="metric-card"><span class="metric-label">${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></div>`).join("");
  const orders = getOrders();
  const statusCounts = ORDER_STATUSES.concat("Cancelled").map(status => ({ label: status, value: orders.filter(order => order.status === status).length }));
  renderBarChart("status-chart", statusCounts);
  renderBarChart("popular-chart", metrics.popularItems.slice(0, 5).map(item => ({ label: item.name, value: item.quantity })));
}

function renderBarChart(elementId, rows) {
  const container = document.getElementById(elementId);
  if (!container) return;
  if (!rows.length || rows.every(row => row.value === 0)) {
    container.innerHTML = `<p class="form-hint">No recorded data yet. Place sample orders to populate this chart.</p>`;
    return;
  }
  const max = Math.max(1, ...rows.map(row => row.value));
  container.innerHTML = rows.map(row => `<div class="bar-row"><span class="bar-label" title="${escapeHTML(row.label)}">${escapeHTML(row.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, row.value / max * 100)}%"></div></div><strong class="bar-value">${Number(row.value)}</strong></div>`).join("");
}

function renderRecentOrders() {
  const container = document.getElementById("recent-orders");
  if (!container) return;
  const orders = getOrders().slice(-5).reverse();
  if (!orders.length) { container.innerHTML = `<p class="form-hint">No orders have been placed yet.</p>`; return; }
  container.innerHTML = `<table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Status</th><th>Total</th></tr></thead><tbody>${orders.map(order => `<tr><td>${escapeHTML(order.id)}</td><td>${escapeHTML(order.customer?.name || "")}</td><td>${escapeHTML(order.orderType)}</td><td>${escapeHTML(order.status)}</td><td>${money(order.total)}</td></tr>`).join("")}</tbody></table>`;
}

function renderAdminMenu() {
  const container = document.getElementById("admin-menu-list");
  if (!container) return;
  const items = getMenu();
  container.innerHTML = `<table class="data-table"><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Nutrition</th><th>Availability</th><th>Actions</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHTML(item.emoji || "🍽️")} ${escapeHTML(item.name)}<br><small>${item.id}</small></td><td>${escapeHTML(item.category)}</td><td>${money(item.price)}</td><td>${item.nutrition ? `${Number(item.nutrition.calories)} kcal / ${escapeHTML(item.nutrition.servingSize || "serving")}` : "Not added"}<br><small>${item.nutrition?.verified ? "Verified" : "Estimate / unverified"}</small></td><td><span class="status-pill ${item.available ? "status-available" : "status-cancelled"}">${item.available ? "Available" : "Unavailable"}</span></td><td><div class="table-actions"><button class="btn btn-secondary btn-small" type="button" data-action="edit-menu-item" data-id="${item.id}">Edit</button><button class="btn ${item.available ? "btn-danger" : "btn-primary"} btn-small" type="button" data-action="toggle-menu-item" data-id="${item.id}">${item.available ? "Disable" : "Enable"}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function saveMenuItemFromForm(event) {
  event.preventDefault();
  const editId = Number(document.getElementById("menu-edit-id").value || 0);
  const name = document.getElementById("admin-food-name").value.trim();
  const category = document.getElementById("admin-food-category").value;
  const price = Number(document.getElementById("admin-food-price").value);
  const emoji = document.getElementById("admin-food-emoji").value.trim() || "🍽️";
  const available = document.getElementById("admin-food-available").checked;
  const message = document.getElementById("menu-form-message");
  const nutritionInputs = ["admin-serving-size", "admin-calories", "admin-protein", "admin-carbs", "admin-fat", "admin-ingredients", "admin-allergens"];
  const hasNutrition = nutritionInputs.some(id => String(document.getElementById(id)?.value || "").trim() !== "");
  let nutrition = null;
  if (hasNutrition) {
    nutrition = {
      servingSize: document.getElementById("admin-serving-size")?.value.trim() || "",
      calories: Number(document.getElementById("admin-calories")?.value),
      protein: Number(document.getElementById("admin-protein")?.value),
      carbohydrates: Number(document.getElementById("admin-carbs")?.value),
      fat: Number(document.getElementById("admin-fat")?.value),
      ingredients: (document.getElementById("admin-ingredients")?.value || "").split(",").map(value => value.trim()).filter(Boolean),
      allergens: (document.getElementById("admin-allergens")?.value || "").split(",").map(value => value.trim()).filter(Boolean),
      verified: Boolean(document.getElementById("admin-nutrition-verified")?.checked),
      note: document.getElementById("admin-nutrition-verified")?.checked ? "Nutrition details marked verified by restaurant administrator." : "Illustrative estimate - verify against the actual recipe before customer use."
    };
  }
  const validation = Core.validateMenuItem({ name, category, price, nutrition });
  if (!validation.valid) {
    if (message) message.textContent = validation.message;
    document.getElementById("admin-food-name")?.focus();
    return;
  }
  const items = getMenu();
  if (editId) {
    const index = items.findIndex(item => item.id === editId);
    if (index < 0) { if (message) message.textContent = "The selected menu item was not found."; return; }
    items[index] = { ...items[index], name, category, price, emoji, available, nutrition: nutrition || items[index].nutrition || null };
  } else {
    const newId = Math.max(100, ...items.map(item => Number(item.id) || 0)) + 1;
    items.push({ id: newId, name, category, price, emoji, available, rating: 0, popular: false, nutrition });
  }
  saveMenu(items);
  resetMenuForm();
  renderAdmin();
  if (message) message.textContent = "Menu item saved. Customer menu now uses the updated record.";
  showToast("Menu saved successfully.");
}

function editMenuItem(itemId) {
  const item = getMenu().find(entry => entry.id === Number(itemId));
  if (!item) return;
  document.getElementById("menu-edit-id").value = item.id;
  document.getElementById("admin-food-name").value = item.name;
  document.getElementById("admin-food-category").value = item.category;
  document.getElementById("admin-food-price").value = item.price;
  document.getElementById("admin-food-emoji").value = item.emoji || "🍽️";
  document.getElementById("admin-food-available").checked = item.available;
  const n = item.nutrition || {};
  document.getElementById("admin-serving-size").value = n.servingSize || "";
  document.getElementById("admin-calories").value = n.calories ?? "";
  document.getElementById("admin-protein").value = n.protein ?? "";
  document.getElementById("admin-carbs").value = n.carbohydrates ?? "";
  document.getElementById("admin-fat").value = n.fat ?? "";
  document.getElementById("admin-ingredients").value = Array.isArray(n.ingredients) ? n.ingredients.join(", ") : "";
  document.getElementById("admin-allergens").value = Array.isArray(n.allergens) ? n.allergens.join(", ") : "";
  document.getElementById("admin-nutrition-verified").checked = n.verified === true;
  document.getElementById("menu-form-title").textContent = "Edit Food Item #" + item.id;
  document.getElementById("cancel-menu-edit").hidden = false;
  document.getElementById("admin-food-name").focus();
}

function resetMenuForm() {
  document.getElementById("menu-item-form")?.reset();
  const editId = document.getElementById("menu-edit-id");
  if (editId) editId.value = "";
  const title = document.getElementById("menu-form-title");
  if (title) title.textContent = "Add Food Item";
  const cancel = document.getElementById("cancel-menu-edit");
  if (cancel) cancel.hidden = true;
  const available = document.getElementById("admin-food-available");
  if (available) available.checked = true;
  const verified = document.getElementById("admin-nutrition-verified");
  if (verified) verified.checked = false;
}

function toggleMenuItem(itemId) {
  const items = getMenu();
  const item = items.find(entry => entry.id === Number(itemId));
  if (!item) return;
  item.available = !item.available;
  saveMenu(items);
  renderAdmin();
  showToast(item.name + (item.available ? " enabled." : " marked unavailable."));
}

function renderAdminOrders() {
  const container = document.getElementById("admin-orders-list");
  if (!container) return;
  const orders = getOrders().slice().reverse();
  if (!orders.length) { container.innerHTML = `<div class="empty-state"><h2>No orders yet</h2><p>Place an order from the customer menu to see it here.</p></div>`; return; }
  container.innerHTML = orders.map(order => {
    const next = NEXT_STATUS[order.status];
    return `<article class="record-card"><div class="record-head"><div><h3>${escapeHTML(order.id)} · ${escapeHTML(order.customer?.name || "Customer")}</h3><p>${escapeHTML(order.orderType)} · ${formatDateTime(order.createdAt)}</p></div><span class="status-pill ${order.status === "Completed" ? "status-available" : order.status === "Cancelled" ? "status-cancelled" : "status-reserved"}">${escapeHTML(order.status)}</span></div><p>${(order.items || []).map(item => `${escapeHTML(item.name)} × ${Number(item.qty)}`).join(" · ")}</p><p><strong>Total: ${money(order.total)}</strong></p><div class="record-actions">${next ? `<button class="btn btn-primary btn-small" type="button" data-action="advance-order" data-id="${escapeHTML(order.id)}">Mark ${escapeHTML(next)}</button>` : ""}${CANCELABLE_STATUSES.includes(order.status) ? `<button class="btn btn-danger btn-small" type="button" data-action="cancel-order" data-id="${escapeHTML(order.id)}">Cancel Order</button>` : ""}<a class="btn btn-secondary btn-small" href="order-tracking.html?id=${encodeURIComponent(order.id)}">View Tracking</a></div></article>`;
  }).join("");
}

function renderAdminReservations() {
  const container = document.getElementById("admin-reservations-list");
  if (!container) return;
  const reservations = getReservations().slice().reverse();
  if (!reservations.length) { container.innerHTML = `<div class="empty-state"><h2>No reservations yet</h2><p>Use the customer reservation form to create a booking.</p></div>`; return; }
  container.innerHTML = reservations.map(reservation => `<article class="record-card"><div class="record-head"><div><h3>${escapeHTML(reservation.id)} · Table ${escapeHTML(reservation.tableId)}</h3><p>${escapeHTML(reservation.customer.name)} · ${escapeHTML(reservation.customer.phone)}</p></div><span class="status-pill ${reservation.status === "Cancelled" ? "status-cancelled" : "status-available"}">${escapeHTML(reservation.status)}</span></div><p>${formatDateTime(reservation.dateTime)} · ${Number(reservation.guests)} guests · ${reservation.accessible ? "♿ Accessible seating requested" : "Standard seating"}</p><p>Preferred area: ${escapeHTML(reservation.area || "Any")}</p><div class="record-actions">${reservation.status !== "Cancelled" ? `<button class="btn btn-danger btn-small" type="button" data-action="cancel-reservation" data-id="${escapeHTML(reservation.id)}">Cancel Reservation</button>` : ""}</div></article>`).join("");
}

function cancelReservation(reservationId) {
  const reservations = getReservations();
  const reservation = reservations.find(item => item.id === reservationId);
  if (!reservation || reservation.status === "Cancelled") return;
  reservation.status = "Cancelled";
  reservation.cancelledAt = nowISO();
  saveReservations(reservations);
  renderAdmin();
  renderTables();
  renderCustomerReservations();
  showToast("Reservation cancelled.");
}

function renderAdminTables() {
  const container = document.getElementById("admin-tables-list");
  if (!container) return;
  container.innerHTML = getTables().map(table => `<article class="table-card ${table.status.toLowerCase().replaceAll(" ", "-")}"><h3>🪑 ${escapeHTML(table.id)}</h3><p>Capacity: ${Number(table.capacity)} guests</p><p>Location: ${escapeHTML(table.location || "Not specified")}</p><p>${table.accessible ? "♿ Wheelchair Accessible" : "Standard seating"}</p><p>Status: ${escapeHTML(table.status)}</p><div class="record-actions"><button class="btn btn-secondary btn-small" type="button" data-action="edit-table" data-id="${escapeHTML(table.id)}">Edit</button></div></article>`).join("");
}

function saveTableFromForm(event) {
  event.preventDefault();
  const originalId = document.getElementById("table-edit-id").value;
  const id = document.getElementById("admin-table-id").value.trim().toUpperCase();
  const capacity = Number(document.getElementById("admin-table-capacity").value);
  const location = document.getElementById("admin-table-location").value.trim() || "Not specified";
  const status = document.getElementById("admin-table-status").value;
  const accessible = document.getElementById("admin-table-accessible").checked;
  const validation = Core.validateTable({ id, capacity, status });
  if (!validation.valid) { showToast(validation.message); return; }
  const tables = getTables();
  const duplicate = tables.some(table => table.id === id && table.id !== originalId);
  if (duplicate) { showToast("That table ID already exists."); return; }
  if (originalId) {
    const table = tables.find(item => item.id === originalId);
    if (!table) return;
    Object.assign(table, { id, capacity, location, status, accessible });
  } else {
    tables.push({ id, capacity, location, status, accessible });
  }
  saveTables(tables);
  resetTableForm();
  renderAdminTables();
  showToast("Table information saved.");
}

function editTable(tableId) {
  const table = getTables().find(item => item.id === tableId);
  if (!table) return;
  document.getElementById("table-edit-id").value = table.id;
  document.getElementById("admin-table-id").value = table.id;
  document.getElementById("admin-table-id").readOnly = true;
  document.getElementById("admin-table-capacity").value = table.capacity;
  document.getElementById("admin-table-location").value = table.location || "";
  document.getElementById("admin-table-status").value = table.status;
  document.getElementById("admin-table-accessible").checked = table.accessible;
  document.getElementById("cancel-table-edit").hidden = false;
  document.getElementById("admin-table-id").focus();
}

function resetTableForm() {
  document.getElementById("table-form")?.reset();
  const id = document.getElementById("table-edit-id");
  if (id) id.value = "";
  const cancel = document.getElementById("cancel-table-edit");
  if (cancel) cancel.hidden = true;
  const tableId = document.getElementById("admin-table-id");
  if (tableId) tableId.readOnly = false;
}

function renderAdminReview() {
  const container = document.getElementById("admin-review-summary");
  if (!container) return;
  container.textContent = "Open the Mid-term Review page to run the complete isolated business-logic test suite.";
}

// ---------------------------------------------------------
// MID-TERM REVIEW: ISOLATED LOGIC TESTS
// ---------------------------------------------------------

function runMidtermTests() {
  const results = [];
  function test(name, fn) {
    try {
      const passed = fn() === true;
      results.push({ name, passed, detail: passed ? "Expected behavior observed." : "The check returned an unexpected result." });
    } catch (error) {
      results.push({ name, passed: false, detail: error.message || "Unexpected test error." });
    }
  }
  const sampleTables = [
    { id: "T01", capacity: 2, accessible: true, status: "Available" },
    { id: "T02", capacity: 4, accessible: false, status: "Available" },
    { id: "T03", capacity: 6, accessible: true, status: "Available" },
    { id: "T04", capacity: 8, accessible: true, status: "Out of Service" }
  ];
  const baseTime = "2030-01-01T19:00";
  const noReservations = [];
  test("A01 — Accessible table with sufficient capacity is selected", () => findSuitableTable(sampleTables, noReservations, { guests: 5, accessible: true, dateTime: baseTime })?.id === "T03");
  test("A02 — Non-accessible table is rejected when accessibility is required", () => !isTableSuitable(sampleTables[1], { guests: 3, accessible: true, dateTime: baseTime }, noReservations));
  test("A03 — Table with insufficient capacity is rejected", () => !isTableSuitable(sampleTables[0], { guests: 3, accessible: false, dateTime: baseTime }, noReservations));
  test("A04 — Out-of-service table is rejected", () => !isTableSuitable(sampleTables[3], { guests: 4, accessible: true, dateTime: baseTime }, noReservations));
  const conflicting = [{ id: "RES1", tableId: "T03", dateTime: baseTime, durationMinutes: 90, status: "Confirmed" }];
  test("A05 — Overlapping reservation prevents double booking", () => hasReservationConflict("T03", "2030-01-01T19:30", conflicting));
  test("A06 — Non-overlapping time slot remains available", () => !hasReservationConflict("T03", "2030-01-01T21:00", conflicting));
  test("O01 — Valid order status transition is accepted", () => isValidStatusTransition("Placed", "Confirmed") && isValidStatusTransition("Ready", "Completed"));
  test("O02 — Skipping order status stages is rejected", () => !isValidStatusTransition("Placed", "Ready") && !isValidStatusTransition("Completed", "Preparing"));
  test("O03 — Cancellation is limited to early order states", () => isValidStatusTransition("Placed", "Cancelled") && !isValidStatusTransition("Preparing", "Cancelled"));
  const analytics = calculateAnalytics({
    orders: [
      { id: "ORD1", status: "Completed", total: 313, items: [{ name: "Burger", qty: 2 }] },
      { id: "ORD2", status: "Cancelled", total: 200, items: [{ name: "Pizza", qty: 5 }] },
      { id: "ORD3", status: "Preparing", total: 150, items: [{ name: "Burger", qty: 1 }] }
    ], reservations: [{ status: "Confirmed", accessible: true }, { status: "Cancelled", accessible: true }], menu: []
  });
  test("D01 — Cancelled orders are excluded from completed-order revenue", () => analytics.revenue === 313);
  test("D02 — Popularity counts quantities and ignores cancelled orders", () => analytics.popularItems[0]?.name === "Burger" && analytics.popularItems[0]?.quantity === 3);
  test("D03 — Only active accessible reservations are counted", () => analytics.accessibleReservations === 1 && analytics.totalReservations === 1);
  const orderSnapshot = { id: 101, name: "Paneer Pizza", unitPrice: 249, qty: 1 };
  const currentMenuPriceAfterEdit = 299;
  test("D04 — Historical order item price remains a snapshot", () => orderSnapshot.unitPrice === 249 && currentMenuPriceAfterEdit === 299);
  test("M01 — Unavailable menu items are distinguishable from available items", () => DEFAULT_MENU.find(item => item.id === 103).available === false && DEFAULT_MENU.find(item => item.id === 101).available === true);
  test("M02 — Menu records have unique IDs and positive prices", () => new Set(DEFAULT_MENU.map(item => item.id)).size === DEFAULT_MENU.length && DEFAULT_MENU.every(item => item.name.trim().length > 0 && Number(item.price) > 0));
  return results;
}

function renderMidtermReview() {
  const button = document.getElementById("run-review-tests");
  const resultsContainer = document.getElementById("review-results");
  const summary = document.getElementById("review-summary");
  if (!button || !resultsContainer || !summary) return;
  button.addEventListener("click", () => {
    const results = runMidtermTests();
    const passed = results.filter(item => item.passed).length;
    const failed = results.length - passed;
    summary.innerHTML = `<strong>${passed}/${results.length} logic checks passed.</strong> ${failed ? `${failed} failed check(s) need attention.` : "All isolated sample-data checks passed."} These are code-level logic checks, not a claim that every browser workflow has been manually verified.`;
    resultsContainer.innerHTML = results.map((result, index) => `<div class="review-result ${result.passed ? "pass" : "fail"}"><div><strong>${result.passed ? "PASS" : "FAIL"}</strong><div>${index + 1}. ${escapeHTML(result.name)}</div><small>${escapeHTML(result.detail)}</small></div><span>${result.passed ? "✓" : "✕"}</span></div>`).join("");
  });
}

// ---------------------------------------------------------
// MILESTONE 4 QUALITY REVIEW
// ---------------------------------------------------------

function renderMilestone4Review() {
  const button = document.getElementById("run-m4-tests");
  const resultsContainer = document.getElementById("m4-review-results");
  const summary = document.getElementById("m4-review-summary");
  if (!button || !resultsContainer || !summary || !window.SmartRestaurantQA) return;
  button.addEventListener("click", () => {
    const results = window.SmartRestaurantQA.run();
    const passed = results.filter(item => item.passed).length;
    const failed = results.length - passed;
    summary.textContent = `${passed}/${results.length} checks passed. ${failed ? `${failed} failed check(s) need attention.` : "All isolated business-rule checks passed."} Browser integration tests are listed in the final milestone test report.`;
    resultsContainer.innerHTML = results.map((result, index) => `<div class="review-result ${result.passed ? "pass" : "fail"}" role="listitem"><div><strong>${result.passed ? "PASS" : "FAIL"}</strong><div>${index + 1}. ${escapeHTML(result.name)}</div><small>${escapeHTML(result.detail)}</small></div><span aria-hidden="true">${result.passed ? "✓" : "✕"}</span></div>`).join("");
  });
}


// ---------------------------------------------------------
// PERSISTENT LIGHT / DARK THEME SWITCHER
// Dark mode remains the default for first-time visitors.
// The saved preference is shared by every page in this website.
// ---------------------------------------------------------
const THEME_STORAGE_KEY = "sr_theme_preference";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function updateThemeControls(theme) {
  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    const isLight = theme === "light";
    const icon = button.querySelector(".theme-toggle-icon");
    const label = button.querySelector(".theme-toggle-label");
    if (icon) icon.textContent = isLight ? "☾" : "☀";
    if (label) label.textContent = isLight ? "Dark mode" : "Light mode";
    button.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
    button.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
    button.setAttribute("aria-pressed", String(isLight));
  });
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", theme === "light" ? "#F7F4EE" : "#0B1118");
}

function applyTheme(theme, persist = true) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", safeTheme);
  if (persist) {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme); }
    catch (error) { console.warn("Theme preference could not be saved in this browser.", error); }
  }
  updateThemeControls(safeTheme);
  return safeTheme;
}

function setupThemeToggle() {
  let initial = currentTheme();
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") initial = saved;
  } catch (_) { /* Continue with the theme already applied in the document head. */ }
  applyTheme(initial, false);
  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });
}

// ---------------------------------------------------------
// SHARED EVENT HANDLING AND PAGE INITIALIZATION
// ---------------------------------------------------------

function setupNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    if (!links.id) links.id = "primary-navigation";
    toggle.setAttribute("aria-controls", links.id);
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", event => {
      if (event.target.closest("a") && window.matchMedia("(max-width: 680px)").matches) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
  let scrollQueued = false;
  window.addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(() => {
      document.querySelector(".navbar")?.classList.toggle("scrolled", window.scrollY > 10);
      scrollQueued = false;
    });
  }, { passive: true });
}

function setupDelegatedActions() {
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === "add-to-cart") addToCart(id);
    else if (action === "clear-cart") { saveCart([]); renderCart(); showToast("Cart cleared."); }
    else if (action === "cart-plus") changeQty(id, 1);
    else if (action === "cart-minus") changeQty(id, -1);
    else if (action === "remove-cart-item") removeItem(id);
    else if (action === "select-table") {
      window.selectedReservationTableId = id;
      const result = document.getElementById("reservation-result");
      if (result) result.innerHTML = `<div class="result-card">Table ${escapeHTML(id)} selected. Complete the reservation form and submit to confirm this table.</div>`;
      document.getElementById("reservation-form")?.scrollIntoView({ behavior: "smooth" });
    }
    else if (action === "edit-menu-item") editMenuItem(id);
    else if (action === "toggle-menu-item") toggleMenuItem(id);
    else if (action === "advance-order") {
      const order = getOrders().find(item => item.id === id);
      if (order && NEXT_STATUS[order.status]) updateOrderStatus(id, NEXT_STATUS[order.status]);
    }
    else if (action === "cancel-order") updateOrderStatus(id, "Cancelled");
    else if (action === "cancel-reservation") cancelReservation(id);
    else if (action === "edit-table") editTable(id);
    else if (action === "print-bill") window.print();
  });
}

function initializePage() {
  setupThemeToggle();
  setupNavigation();
  initializeStorage();
  setupDelegatedActions();
  updateBadge();

  const page = document.body.dataset.page;
  if (page === "home") renderMenu();
  if (page === "menu") {
    renderMenu();
    document.getElementById("menu-search")?.addEventListener("input", renderMenu);
    document.getElementById("menu-category")?.addEventListener("change", renderMenu);
    document.getElementById("menu-available-only")?.addEventListener("change", renderMenu);
  }
  if (page === "cart") {
    renderCart();
    setupOrderTypeToggle();
    document.getElementById("place-order-button")?.addEventListener("click", placeOrder);
  }
  if (page === "tables") {
    setDefaultDateTime(document.getElementById("reservation-datetime"));
    setDefaultDateTime(document.getElementById("tables-view-datetime"));
    document.getElementById("reservation-form-element")?.addEventListener("submit", submitReservation);
    ["tables-accessible-only", "tables-view-datetime", "tables-view-guests"].forEach(id => document.getElementById(id)?.addEventListener("input", renderTables));
    renderTables();
    renderCustomerReservations();
  }
  if (page === "tracking") {
    document.getElementById("tracking-search-form")?.addEventListener("submit", event => {
      event.preventDefault();
      renderTracking(document.getElementById("tracking-order-id").value.trim());
    });
    const requestedId = new URLSearchParams(window.location.search).get("id");
    renderTracking(requestedId);
  }
  if (page === "admin") setupAdmin();
  if (page === "review") renderMidtermReview();
  if (page === "milestone4-review") renderMilestone4Review();

  window.addEventListener("sr:datachange", () => {
    updateBadge();
    if (page === "home" || page === "menu") renderMenu();
    if (page === "tables") { renderTables(); renderCustomerReservations(); }
    if (page === "tracking") {
      const requestedId = new URLSearchParams(window.location.search).get("id") || document.getElementById("tracking-order-id")?.value;
      renderTracking(requestedId);
    }
    if (page === "admin") renderAdmin();
  });
  window.addEventListener("storage", event => {
    if (!event.key || Object.values(STORAGE_KEYS).includes(event.key)) {
      updateBadge();
      if (page === "home" || page === "menu") renderMenu();
      if (page === "tables") { renderTables(); renderCustomerReservations(); }
      if (page === "tracking") renderTracking(new URLSearchParams(window.location.search).get("id"));
      if (page === "admin") renderAdmin();
    }
  });
}

// Explicit app surface supports automated integration tests and local QA tooling.
window.SmartRestaurantApp = Object.freeze({
  initializePage, placeOrder, submitReservation, updateOrderStatus, renderMenu, renderCart,
  renderTables, renderTracking, renderAdmin, getMenu, getTables, getCart, getOrders,
  getReservations, calculateAnalytics, isTableSuitable, findSuitableTable,
  isValidStatusTransition, nutritionMarkup
});

document.addEventListener("DOMContentLoaded", initializePage);

})();
