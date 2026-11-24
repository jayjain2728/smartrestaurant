/*
 * Smart Restaurant - Milestone 4 shared business rules.
 * UMD wrapper keeps the same code testable in Node and usable by browser pages.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartRestaurantCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TAX_RATE = 0.05;
  const RESERVATION_DURATION_MINUTES = 90;
  const ORDER_STATUSES = ["Placed", "Confirmed", "Preparing", "Ready", "Completed"];
  const NEXT_STATUS = Object.freeze({
    Placed: "Confirmed",
    Confirmed: "Preparing",
    Preparing: "Ready",
    Ready: "Completed"
  });
  const CANCELABLE_STATUSES = ["Placed", "Confirmed"];
  const TABLE_STATUSES = ["Available", "Occupied", "Out of Service"];
  const ORDER_TYPES = ["Dine-in", "Takeaway", "Home Delivery"];
  const MENU_CATEGORIES = ["Main Course", "Fast Food", "Beverage", "Dessert"];

  function isValidName(value, min = 2, max = 60) {
    const name = String(value ?? "").trim();
    return name.length >= min && name.length <= max && !/[\u0000-\u001F\u007F]/.test(name);
  }

  function isValidPhone(phone) {
    return /^[6-9]\d{9}$/.test(String(phone ?? "").trim());
  }

  function isValidOrderType(type) {
    return ORDER_TYPES.includes(type);
  }

  function isValidGuestCount(value) {
    return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20;
  }

  function isValidMenuItem(item) {
    return Boolean(item && Number.isInteger(Number(item.id)) && Number(item.id) > 0 &&
      isValidName(item.name, 2, 60) && MENU_CATEGORIES.includes(item.category) &&
      Number.isFinite(Number(item.price)) && Number(item.price) > 0 && Number(item.price) <= 99999 &&
      typeof item.available === "boolean");
  }

  function validateNutrition(nutrition) {
    if (nutrition == null) return { valid: true, message: "Nutrition data is optional." };
    if (typeof nutrition !== "object" || Array.isArray(nutrition)) return { valid: false, message: "Nutrition details must be a valid record." };
    const servingSize = String(nutrition.servingSize ?? "").trim();
    if (!servingSize || servingSize.length > 40) return { valid: false, message: "Enter a serving size (for example, 200 g or 250 ml)." };
    for (const [field, label] of [["calories", "Calories"], ["protein", "Protein"], ["carbohydrates", "Carbohydrates"], ["fat", "Fat"]]) {
      if (nutrition[field] === "" || nutrition[field] == null) return { valid: false, message: `${label} is required when nutrition details are entered.` };
      const value = Number(nutrition[field]);
      if (!Number.isFinite(value) || value < 0 || value > 10000) return { valid: false, message: `${label} must be a number between 0 and 10,000.` };
    }
    for (const field of ["ingredients", "allergens"]) {
      if (nutrition[field] != null && !Array.isArray(nutrition[field])) return { valid: false, message: `${field} must be a list.` };
      if (Array.isArray(nutrition[field]) && nutrition[field].some(value => String(value).length > 80)) return { valid: false, message: `${field} entries are too long.` };
    }
    return { valid: true, message: "Nutrition details are valid." };
  }

  function validateMenuItem(item) {
    if (!item || !isValidName(item.name, 2, 60)) return { valid: false, message: "Enter a food name between 2 and 60 characters." };
    if (!MENU_CATEGORIES.includes(item.category)) return { valid: false, message: "Choose a valid menu category." };
    if (!Number.isFinite(Number(item.price)) || Number(item.price) <= 0 || Number(item.price) > 99999) {
      return { valid: false, message: "Enter a price greater than zero and no more than 99,999." };
    }
    const nutritionResult = validateNutrition(item.nutrition);
    if (!nutritionResult.valid) return nutritionResult;
    return { valid: true, message: "Menu item is valid." };
  }

  function buildInvoiceSummary(order) {
    if (!order || !order.id || !order.customer?.name || !Array.isArray(order.items) || order.items.length === 0) return null;
    const items = [];
    for (const item of order.items) {
      const qty = Number(item?.qty);
      const unitPrice = Number(item?.unitPrice);
      if (!item?.name || !Number.isInteger(qty) || qty < 1 || qty > 999 || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
      items.push({
        id: item.id ?? null,
        name: String(item.name),
        qty,
        unitPrice,
        lineTotal: Math.round(unitPrice * qty * 100) / 100
      });
    }
    const subtotal = Number(order.subtotal);
    const tax = Number(order.tax);
    const total = Number(order.total);
    if (![subtotal, tax, total].every(value => Number.isFinite(value) && value >= 0)) return null;
    return {
      id: String(order.id),
      customerName: String(order.customer.name),
      orderType: String(order.orderType || 'Not specified'),
      paymentMode: String(order.paymentMode || 'Demo payment'),
      createdAt: order.createdAt || '',
      items,
      subtotal,
      tax,
      total,
      status: String(order.status || 'Placed')
    };
  }

  function getOrderReadyNotice(order) {
    if (!order || order.status !== 'Ready') return null;
    let message = 'Your order is ready and will be served by restaurant staff.';
    if (order.orderType === 'Takeaway') message = 'Your order is ready. Please collect it from the takeaway counter.';
    if (order.orderType === 'Home Delivery') message = 'Your order is ready for dispatch. Delivery updates are handled by restaurant staff.';
    return { title: 'Your order is ready!', message, orderId: String(order.id || '') };
  }

  function validateTable(table) {
    if (!table || !/^[A-Z0-9-]{2,8}$/.test(String(table.id ?? "").trim().toUpperCase())) {
      return { valid: false, message: "Enter a valid table ID (2-8 letters, numbers or hyphens)." };
    }
    if (!Number.isInteger(Number(table.capacity)) || Number(table.capacity) < 1 || Number(table.capacity) > 20) {
      return { valid: false, message: "Table capacity must be an integer from 1 to 20." };
    }
    if (!TABLE_STATUSES.includes(table.status)) return { valid: false, message: "Choose a valid table status." };
    return { valid: true, message: "Table is valid." };
  }

  function validateCartItems(cart, menu) {
    if (!Array.isArray(cart) || cart.length === 0) return { valid: false, message: "Your cart is empty.", items: [] };
    if (!Array.isArray(menu)) return { valid: false, message: "Menu data is unavailable. Refresh and try again.", items: [] };
    const seen = new Set();
    const items = [];
    for (const entry of cart) {
      const id = Number(entry?.id);
      const qty = Number(entry?.qty);
      if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
        return { valid: false, message: "Cart contains an invalid or duplicate item. Remove it and try again.", items: [] };
      }
      seen.add(id);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return { valid: false, message: "Each item quantity must be a whole number from 1 to 99.", items: [] };
      }
      const current = menu.find(item => Number(item?.id) === id);
      if (!current || current.available !== true) {
        return { valid: false, message: `${String(current?.name || entry?.name || "An item")} is unavailable. Remove it before checkout.`, items: [] };
      }
      if (!isValidMenuItem(current)) return { valid: false, message: "A menu item has invalid details. Contact the administrator.", items: [] };
      items.push({
        id,
        name: String(current.name).trim(),
        category: current.category,
        unitPrice: Number(current.price),
        qty,
        nutrition: current.nutrition ? JSON.parse(JSON.stringify(current.nutrition)) : null
      });
    }
    return { valid: true, message: "Cart is valid.", items };
  }

  function calculateSubtotal(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const price = Number(item?.price ?? item?.unitPrice ?? 0);
      const qty = Number(item?.qty ?? item?.quantity ?? 0);
      return sum + (Number.isFinite(price) && price >= 0 && Number.isFinite(qty) && qty >= 0 ? price * qty : 0);
    }, 0);
  }

  function calculateTax(subtotal) {
    const value = Number(subtotal);
    return Number.isFinite(value) && value >= 0 ? Math.round(value * TAX_RATE) : 0;
  }

  function calculateTotal(items) {
    const subtotal = calculateSubtotal(items);
    return subtotal + calculateTax(subtotal);
  }

  function parseTime(value) {
    if (typeof value !== "string" || !value.trim()) return NaN;
    return new Date(value).getTime();
  }

  function isValidDuration(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 720;
  }

  function intervalsOverlap(startA, endA, startB, endB) {
    return Number.isFinite(startA) && Number.isFinite(endA) && Number.isFinite(startB) && Number.isFinite(endB) &&
      startA < endB && endA > startB;
  }

  function hasReservationConflict(tableId, startDateTime, reservations, durationMinutes = RESERVATION_DURATION_MINUTES) {
    const start = parseTime(startDateTime);
    if (!Number.isFinite(start) || !isValidDuration(durationMinutes) || !Array.isArray(reservations)) return true;
    const end = start + Number(durationMinutes) * 60000;
    return reservations.some(reservation => {
      if (!reservation || reservation.tableId !== tableId || reservation.status === "Cancelled") return false;
      const existingStart = parseTime(reservation.dateTime);
      if (!Number.isFinite(existingStart)) return false;
      const existingDuration = isValidDuration(reservation.durationMinutes)
        ? Number(reservation.durationMinutes)
        : RESERVATION_DURATION_MINUTES;
      const existingEnd = existingStart + existingDuration * 60000;
      return intervalsOverlap(start, end, existingStart, existingEnd);
    });
  }

  function validateReservationRequest(request, now = Date.now()) {
    if (!request || !isValidName(request.name, 2, 60)) return { valid: false, message: "Please enter a valid name." };
    if (!isValidPhone(request.phone)) return { valid: false, message: "Please enter a valid 10-digit mobile number." };
    const start = parseTime(request.dateTime);
    if (!Number.isFinite(start) || start <= now) return { valid: false, message: "Choose a future reservation date and time." };
    if (!isValidGuestCount(request.guests)) return { valid: false, message: "Guest count must be between 1 and 20." };
    if (typeof request.accessible !== "boolean") return { valid: false, message: "Accessibility preference is invalid." };
    return { valid: true, message: "Reservation request is valid." };
  }

  function isTableSuitable(table, request, reservations) {
    if (!table || !request || table.status !== "Available") return false;
    if (!isValidGuestCount(request.guests) || !Number.isInteger(Number(table.capacity)) || Number(table.capacity) < Number(request.guests)) return false;
    if (request.accessible === true && table.accessible !== true) return false;
    if (request.dateTime) {
      if (!Number.isFinite(parseTime(request.dateTime))) return false;
      if (hasReservationConflict(table.id, request.dateTime, reservations)) return false;
    }
    return true;
  }

  function findSuitableTable(tables, reservations, request) {
    if (!Array.isArray(tables) || !request) return null;
    const candidates = tables.filter(table => isTableSuitable(table, request, reservations));
    if (!candidates.length) return null;
    const area = String(request.area || "Any").toLowerCase();
    return candidates.sort((a, b) => {
      const aArea = area !== "any" && String(a.location || "").toLowerCase().includes(area) ? 0 : 1;
      const bArea = area !== "any" && String(b.location || "").toLowerCase().includes(area) ? 0 : 1;
      return aArea - bArea || Number(a.capacity) - Number(b.capacity);
    })[0];
  }

  function isValidStatusTransition(current, next) {
    if (next === "Cancelled") return CANCELABLE_STATUSES.includes(current);
    return NEXT_STATUS[current] === next;
  }

  function calculateAnalytics(data) {
    const orders = Array.isArray(data?.orders) ? data.orders : [];
    const reservations = Array.isArray(data?.reservations) ? data.reservations : [];
    const menu = Array.isArray(data?.menu) ? data.menu : [];
    const completedOrders = orders.filter(order => order?.status === "Completed");
    const pendingOrders = orders.filter(order => order && !["Completed", "Cancelled"].includes(order.status));
    const cancelledOrders = orders.filter(order => order?.status === "Cancelled");
    const revenue = completedOrders.reduce((sum, order) => {
      const total = Number(order?.total);
      return sum + (Number.isFinite(total) && total > 0 ? total : 0);
    }, 0);
    const popularity = new Map();
    orders.filter(order => order && order.status !== "Cancelled").forEach(order => {
      (Array.isArray(order.items) ? order.items : []).forEach(item => {
        const name = String(item?.name || "Unknown item");
        const qty = Number(item?.qty);
        if (Number.isInteger(qty) && qty > 0 && qty <= 999) popularity.set(name, (popularity.get(name) || 0) + qty);
      });
    });
    const popularItems = Array.from(popularity, ([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: cancelledOrders.length,
      revenue,
      totalReservations: reservations.filter(item => item && item.status !== "Cancelled").length,
      accessibleReservations: reservations.filter(item => item && item.status !== "Cancelled" && item.accessible === true).length,
      popularItems,
      unavailableMenuItems: menu.filter(item => item && item.available === false).length
    };
  }

  function createUniqueId(prefix, records, idField = "id") {
    const used = new Set((Array.isArray(records) ? records : []).map(item => String(item?.[idField] ?? "")));
    let candidate;
    do {
      const token = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
        : `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      candidate = `${prefix}${token}`;
    } while (used.has(candidate));
    return candidate;
  }

  function getOrderStatuses() { return ORDER_STATUSES.slice(); }
  function getNextStatus(current) { return NEXT_STATUS[current] || null; }

  return Object.freeze({
    TAX_RATE, RESERVATION_DURATION_MINUTES, ORDER_STATUSES: getOrderStatuses(),
    NEXT_STATUS, CANCELABLE_STATUSES: CANCELABLE_STATUSES.slice(), TABLE_STATUSES: TABLE_STATUSES.slice(),
    ORDER_TYPES: ORDER_TYPES.slice(), MENU_CATEGORIES: MENU_CATEGORIES.slice(),
    isValidName, isValidPhone, isValidOrderType, isValidGuestCount, isValidMenuItem,
    validateNutrition, validateMenuItem, validateTable, validateCartItems, calculateSubtotal, calculateTax,
    calculateTotal, parseTime, isValidDuration, intervalsOverlap, hasReservationConflict,
    validateReservationRequest, isTableSuitable, findSuitableTable,
    isValidStatusTransition, calculateAnalytics, createUniqueId, getNextStatus,
    buildInvoiceSummary, getOrderReadyNotice
  });
});
