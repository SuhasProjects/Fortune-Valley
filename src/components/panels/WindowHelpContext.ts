import { createContext } from 'react';
/** Shared slot lets a sheet put its help toggle in the window header. */
export const WindowHelpContext = createContext<HTMLElement | null>(null);
