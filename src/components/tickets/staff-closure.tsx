"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ClosureContextValue = {
  closing: boolean;
  setClosing: (closing: boolean) => void;
  message: string;
};

const ClosureContext = createContext<ClosureContextValue | null>(null);

export function StaffClosureProvider({ children, ticketNumber, requesterName }: { children: ReactNode; ticketNumber: string; requesterName: string }) {
  const [closing, setClosing] = useState(false);
  const firstName = requesterName.trim().split(/\s+/)[0] || "there";
  const message = `Hi ${firstName},\n\nYour support ticket ${ticketNumber} is now closed. If you still need help, please open a new ticket and we'll be happy to assist.\n\nThank you,\nIT Support`;
  return <ClosureContext.Provider value={{ closing, setClosing, message }}>{children}</ClosureContext.Provider>;
}

export function useStaffClosure() {
  return useContext(ClosureContext);
}
