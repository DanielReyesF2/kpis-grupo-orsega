import React from "react";
import Sidebar from "./Sidebar";
import { TopBar } from "./TopBar";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden ml-0 lg:ml-[250px]">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto bg-gray-50 px-4 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}