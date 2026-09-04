import { createContext, useContext, type ReactNode } from "react";
import { useBoard, type Board } from "./data";

// One fetch and one realtime channel for the whole app, rather than every page
// opening its own.
const BoardContext = createContext<Board | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const board = useBoard();
  return <BoardContext.Provider value={board}>{children}</BoardContext.Provider>;
}

export function useBoardContext(): Board {
  const board = useContext(BoardContext);
  if (!board) throw new Error("useBoardContext must be used inside <BoardProvider>");
  return board;
}
