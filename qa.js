/* Smart Restaurant - Milestone 4 isolated edge-case test suite. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./core.js") : root.SmartRestaurantCore);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartRestaurantQA = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";
  if (!Core) throw new Error("SmartRestaurantCore must load before qa.js");

  function run() {
    const results = [];
    function check(name, fn, detail) {
      try {
        const passed = fn() === true;
        results.push({ name, passed, detail: passed ? "Expected result confirmed." : (detail || "Unexpected result.") });
      } catch (error) {
        results.push({ name, passed: false, detail: error?.message || "Test raised an exception." });
      }
    }

    const base = "2030-01-01T19:00:00";
    const existing = [{ id: "RES-A", tableId: "T01", dateTime: base, durationMinutes: 90, status: "Confirmed" }];
    const tables = [
      { id: "T01", capacity: 2, accessible: true, location: "Ground Floor", status: "Available" },
      { id: "T02", capacity: 4, accessible: false, location: "Main Hall", status: "Available" },
      { id: "T03", capacity: 6, accessible: true, location: "Ground Floor", status: "Available" },
      { id: "T04", capacity: 8, accessible: true, location: "Family Area", status: "Out of Service" },
      { id: "T05", capacity: 4, accessible: true, location: "Window Side", status: "Occupied" }
    ];
    const menu = [
      { id: 101, name: "Veg Burger", category: "Fast Food", price: 149, available: true, emoji: "🍔", rating: 4.7, popular: true },
      { id: 102, name: "Paneer Pizza", category: "Main Course", price: 249, available: true, emoji: "🍕", rating: 4.5, popular: false },
      { id: 103, name: "Pasta", category: "Main Course", price: 199, available: false, emoji: "🍝", rating: 4.0, popular: false }
    ];

    // Reservation availability, edge boundaries and validation.
    check("R01 - Accessible table with sufficient capacity is selected", () => Core.findSuitableTable(tables, [], { guests: 5, accessible: true, dateTime: base })?.id === "T03");
    check("R02 - Non-accessible table is rejected when accessibility is required", () => !Core.isTableSuitable(tables[1], { guests: 3, accessible: true, dateTime: base }, []));
    check("R03 - A table below the requested capacity is rejected", () => !Core.isTableSuitable(tables[0], { guests: 3, accessible: false, dateTime: base }, []));
    check("R04 - An occupied table is rejected", () => !Core.isTableSuitable(tables[4], { guests: 2, accessible: false, dateTime: base }, []));
    check("R05 - An out-of-service table is rejected", () => !Core.isTableSuitable(tables[3], { guests: 2, accessible: true, dateTime: base }, []));
    check("R06 - Unknown table status fails closed", () => !Core.isTableSuitable({ ...tables[0], status: "Unknown" }, { guests: 2, accessible: true }, []));
    check("R07 - Overlapping same-table reservation is detected", () => Core.hasReservationConflict("T01", "2030-01-01T19:30:00", existing));
    check("R08 - A booking on a different table does not conflict", () => !Core.hasReservationConflict("T02", "2030-01-01T19:30:00", existing));
    check("R09 - Adjacent 90-minute slot is allowed", () => !Core.hasReservationConflict("T01", "2030-01-01T20:30:00", existing));
    check("R10 - Cancelled reservation no longer blocks a slot", () => !Core.hasReservationConflict("T01", "2030-01-01T19:30:00", [{ ...existing[0], status: "Cancelled" }]));
    check("R11 - Malformed requested date fails closed", () => Core.hasReservationConflict("T01", "not-a-date", existing));
    check("R12 - Invalid requested duration fails closed", () => Core.hasReservationConflict("T01", base, existing, 0));
    check("R13 - Invalid stored duration uses safe 90-minute default", () => Core.hasReservationConflict("T01", "2030-01-01T19:30:00", [{ ...existing[0], durationMinutes: -5 }]));
    check("R14 - Valid future reservation request passes", () => Core.validateReservationRequest({ name: "Jay Jain", phone: "9876543210", dateTime: "2030-01-01T19:00", guests: 4, accessible: true }, Date.parse("2029-12-31T00:00:00")).valid);
    check("R15 - Blank or one-character customer name is rejected", () => !Core.validateReservationRequest({ name: "J", phone: "9876543210", dateTime: base, guests: 2, accessible: false }, Date.parse("2029-12-31")).valid);
    check("R16 - Invalid Indian mobile number is rejected", () => !Core.validateReservationRequest({ name: "Jay Jain", phone: "12345", dateTime: base, guests: 2, accessible: false }, Date.parse("2029-12-31")).valid);
    check("R17 - Past reservation date is rejected", () => !Core.validateReservationRequest({ name: "Jay Jain", phone: "9876543210", dateTime: base, guests: 2, accessible: false }, Date.parse("2030-01-02")).valid);
    check("R18 - Guest count above 20 is rejected", () => !Core.validateReservationRequest({ name: "Jay Jain", phone: "9876543210", dateTime: base, guests: 21, accessible: false }, Date.parse("2029-12-31")).valid);
    check("R19 - Fractional guest count is rejected", () => !Core.validateReservationRequest({ name: "Jay Jain", phone: "9876543210", dateTime: base, guests: 2.5, accessible: false }, Date.parse("2029-12-31")).valid);

    // Cart, checkout and billing edge cases.
    check("C01 - Valid cart uses the current menu price snapshot", () => {
      const result = Core.validateCartItems([{ id: 101, qty: 2, price: 1 }], menu);
      return result.valid && result.items[0].unitPrice === 149 && result.items[0].qty === 2;
    });
    check("C02 - Empty cart is rejected", () => !Core.validateCartItems([], menu).valid);
    check("C03 - Non-array cart is rejected", () => !Core.validateCartItems(null, menu).valid);
    check("C04 - Disabled menu item cannot be checked out", () => !Core.validateCartItems([{ id: 103, qty: 1 }], menu).valid);
    check("C05 - Deleted or unknown menu item cannot be checked out", () => !Core.validateCartItems([{ id: 999, qty: 1 }], menu).valid);
    check("C06 - Zero quantity is rejected", () => !Core.validateCartItems([{ id: 101, qty: 0 }], menu).valid);
    check("C07 - Negative quantity is rejected", () => !Core.validateCartItems([{ id: 101, qty: -1 }], menu).valid);
    check("C08 - Fractional quantity is rejected", () => !Core.validateCartItems([{ id: 101, qty: 1.5 }], menu).valid);
    check("C09 - Quantity above 99 is rejected", () => !Core.validateCartItems([{ id: 101, qty: 100 }], menu).valid);
    check("C10 - Duplicate item IDs in the cart are rejected", () => !Core.validateCartItems([{ id: 101, qty: 1 }, { id: 101, qty: 2 }], menu).valid);
    check("C11 - Invalid current menu price is rejected", () => !Core.validateCartItems([{ id: 101, qty: 1 }], [{ ...menu[0], price: -1 }]).valid);
    check("C12 - Tax is rounded to the nearest rupee", () => Core.calculateTax(149) === 7);
    check("C13 - Final total equals subtotal plus tax", () => Core.calculateTotal([{ unitPrice: 149, qty: 2 }]) === 313);
    check("C14 - Invalid numeric amounts do not create NaN totals", () => Number.isFinite(Core.calculateTotal([{ unitPrice: "bad", qty: 2 }])));

    // Menu and table form validation.
    check("M01 - Valid menu item passes validation", () => Core.validateMenuItem({ name: "Veg Burger", category: "Fast Food", price: 149 }).valid);
    check("M02 - Blank menu item name is rejected", () => !Core.validateMenuItem({ name: " ", category: "Fast Food", price: 149 }).valid);
    check("M03 - Zero or negative menu price is rejected", () => !Core.validateMenuItem({ name: "Burger", category: "Fast Food", price: 0 }).valid);
    check("M04 - Unknown menu category is rejected", () => !Core.validateMenuItem({ name: "Burger", category: "Other", price: 99 }).valid);
    check("T01 - Valid table record passes validation", () => Core.validateTable({ id: "T99", capacity: 4, status: "Available" }).valid);
    check("T02 - Invalid table ID is rejected", () => !Core.validateTable({ id: "<script>", capacity: 4, status: "Available" }).valid);
    check("T03 - Table capacity outside 1-20 is rejected", () => !Core.validateTable({ id: "T99", capacity: 21, status: "Available" }).valid);
    check("T04 - Fractional table capacity is rejected", () => !Core.validateTable({ id: "T99", capacity: 2.5, status: "Available" }).valid);
    check("T05 - Unknown table status is rejected", () => !Core.validateTable({ id: "T99", capacity: 4, status: "Open" }).valid);

    // Order state machine and data analytics.
    check("O01 - Valid next order states are accepted", () => Core.isValidStatusTransition("Placed", "Confirmed") && Core.isValidStatusTransition("Ready", "Completed"));
    check("O02 - Skipping order stages is rejected", () => !Core.isValidStatusTransition("Placed", "Ready") && !Core.isValidStatusTransition("Completed", "Preparing"));
    check("O03 - Cancellation is allowed only in early states", () => Core.isValidStatusTransition("Placed", "Cancelled") && Core.isValidStatusTransition("Confirmed", "Cancelled") && !Core.isValidStatusTransition("Preparing", "Cancelled"));
    check("O04 - Unknown order statuses cannot transition", () => !Core.isValidStatusTransition("Unknown", "Preparing"));
    const metrics = Core.calculateAnalytics({
      orders: [
        { id: "ORD1", status: "Completed", total: 313, items: [{ name: "Burger", qty: 2 }] },
        { id: "ORD2", status: "Cancelled", total: 900, items: [{ name: "Pizza", qty: 9 }] },
        { id: "ORD3", status: "Preparing", total: 149, items: [{ name: "Burger", qty: 1 }] }
      ],
      reservations: [{ status: "Confirmed", accessible: true }, { status: "Cancelled", accessible: true }],
      menu: [{ available: false }, { available: true }]
    });
    check("D01 - Cancelled orders are excluded from completed-order revenue", () => metrics.revenue === 313);
    check("D02 - Popular-item analytics count quantities, not order occurrences", () => metrics.popularItems[0]?.name === "Burger" && metrics.popularItems[0]?.quantity === 3);
    check("D03 - Cancelled accessible reservations are excluded", () => metrics.accessibleReservations === 1 && metrics.totalReservations === 1);
    check("D04 - Unavailable menu item count is accurate", () => metrics.unavailableMenuItems === 1);
    check("D05 - Empty analytics input returns safe zero values", () => {
      const empty = Core.calculateAnalytics({ orders: [], reservations: [], menu: [] });
      return empty.totalOrders === 0 && empty.revenue === 0 && empty.popularItems.length === 0;
    });
    check("D06 - Missing or malformed analytics arrays do not throw", () => {
      const empty = Core.calculateAnalytics({ orders: null, reservations: "bad", menu: {} });
      return empty.totalOrders === 0 && empty.totalReservations === 0 && empty.unavailableMenuItems === 0;
    });
    check("I01 - Generated reservation IDs avoid existing identifiers", () => {
      const id = Core.createUniqueId("RES", [{ id: "RES-USED" }]);
      return id.startsWith("RES") && id !== "RES-USED";
    });

    // Final milestone: nutrition data, printable billing and in-app status notices.
    const validNutrition = { servingSize: "200 g", calories: 420, protein: 18, carbohydrates: 48, fat: 17, ingredients: ["Paneer", "Cheese"], allergens: ["Milk"], verified: false };
    check("N01 - Complete nutritional information passes validation", () => Core.validateNutrition(validNutrition).valid);
    check("N02 - Nutrition values reject negative calories", () => !Core.validateNutrition({ ...validNutrition, calories: -1 }).valid);
    check("N03 - Partial nutrition records reject missing macros", () => !Core.validateNutrition({ ...validNutrition, protein: "" }).valid);
    check("N04 - Nutrition details remain optional for menu items", () => Core.validateNutrition(null).valid);
    const invoiceOrder = { id: "ORD1001", customer: { name: "Test Customer" }, orderType: "Takeaway", items: [{ name: "Burger", qty: 2, unitPrice: 149 }], subtotal: 298, tax: 15, total: 313, paymentMode: "Pay at counter (demo)", status: "Placed" };
    check("B01 - Invoice summary includes order ID, customer and items", () => { const bill = Core.buildInvoiceSummary(invoiceOrder); return bill?.id === "ORD1001" && bill.customerName === "Test Customer" && bill.items[0].name === "Burger"; });
    check("B02 - Invoice summary preserves line quantities and amounts", () => { const bill = Core.buildInvoiceSummary(invoiceOrder); return bill?.items[0].qty === 2 && bill.items[0].lineTotal === 298; });
    check("B03 - Invoice summary preserves stored subtotal, tax and total", () => { const bill = Core.buildInvoiceSummary(invoiceOrder); return bill?.subtotal === 298 && bill.tax === 15 && bill.total === 313; });
    check("B04 - Invoice summary rejects a missing order", () => Core.buildInvoiceSummary(null) === null);
    check("B05 - Ready notice gives takeaway collection instruction", () => Core.getOrderReadyNotice({ ...invoiceOrder, status: "Ready" })?.message.includes("takeaway counter"));
    check("B06 - Home-delivery ready notice gives dispatch instruction", () => Core.getOrderReadyNotice({ ...invoiceOrder, orderType: "Home Delivery", status: "Ready" })?.message.includes("ready for dispatch"));
    check("B07 - No ready notice is shown before order reaches Ready", () => Core.getOrderReadyNotice({ ...invoiceOrder, status: "Preparing" }) === null);

    return results;
  }

  return Object.freeze({ run });
});
