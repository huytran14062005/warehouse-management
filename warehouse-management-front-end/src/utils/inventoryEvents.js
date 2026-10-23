export const INVENTORY_CHANGED_EVENT = "inventory:changed";

export function notifyInventoryChanged() {
  window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT));
}
