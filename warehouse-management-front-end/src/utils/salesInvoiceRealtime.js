import { io } from "socket.io-client";

const socketUrl = process.env.REACT_APP_SOCKET_URL ||
  (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

let realtimeConnected = false;

export const isSalesInvoiceRealtimeConnected = () => realtimeConnected;

export function connectSalesInvoiceRealtime() {
  const socket = io(socketUrl, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    reconnectionDelayMax: 5000,
    auth: (callback) => callback({ token: localStorage.getItem("token") }),
  });
  const refresh = () => {
    window.dispatchEvent(new Event("sales-invoices:realtime-refresh"));
    window.dispatchEvent(new Event("sales-invoices:action-count-refresh"));
  };
  const reconnectWithToken = (event) => {
    if (event?.type === "storage" && event.key !== "token") return;
    if (localStorage.getItem("token")) socket.disconnect().connect();
  };
  socket.on("connect", () => {
    realtimeConnected = true;
    refresh();
  });
  socket.on("disconnect", () => {
    realtimeConnected = false;
  });
  socket.on("sales-invoice:changed", refresh);
  window.addEventListener("auth:token-refreshed", reconnectWithToken);
  window.addEventListener("storage", reconnectWithToken);
  socket.connect();
  return () => {
    realtimeConnected = false;
    window.removeEventListener("auth:token-refreshed", reconnectWithToken);
    window.removeEventListener("storage", reconnectWithToken);
    socket.removeAllListeners();
    socket.disconnect();
  };
}
