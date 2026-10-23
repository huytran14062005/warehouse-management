import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../css/InternalLayout.css";

function InternalLayout() {
  return (
    <div className="internal-workspace">
      <Sidebar />
      <section className="internal-workspace-content">
        <Outlet />
      </section>
    </div>
  );
}

export default InternalLayout;
