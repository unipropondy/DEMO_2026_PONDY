import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { socket } from "../constants/socket";

/* ================= TYPES ================= */

export interface Terminal {
  TerminalCode: string;
  TerminalName: string;
}

interface TerminalState {
  terminalCode: string | null;
  terminalName: string | null;
  isConfigured: boolean;

  setTerminal: (code: string, name: string) => void;
  clearTerminal: () => void;
  joinSocketRoom: () => void;
}

/* ================= STORE ================= */

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      terminalCode: null,
      terminalName: null,
      isConfigured: false,

      setTerminal: (code, name) => {
        set({ terminalCode: code, terminalName: name, isConfigured: true });
        // Immediately join the socket room after setting the terminal
        const room = `terminal_${code}`;
        socket.emit("join_terminal", { terminalCode: code });
        console.log(`🖥️ [TerminalStore] Terminal set to: ${code} (${name}) | Joined room: ${room}`);
      },

      clearTerminal: () => {
        set({ terminalCode: null, terminalName: null, isConfigured: false });
        console.log("🖥️ [TerminalStore] Terminal configuration cleared.");
      },

      joinSocketRoom: () => {
        const { terminalCode, isConfigured } = get();
        if (!isConfigured || !terminalCode) {
          console.log("🖥️ [TerminalStore] joinSocketRoom: No terminal configured, skipping.");
          return;
        }
        socket.emit("join_terminal", { terminalCode });
        console.log(`🖥️ [TerminalStore] Re-joined socket room: terminal_${terminalCode}`);
      },
    }),
    {
      name: "terminal-config-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
