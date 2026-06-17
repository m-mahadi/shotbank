import type { ShotBankBridge } from "@/types";

declare global {
  interface Window {
    shotbank?: ShotBankBridge;
  }
}

export {};
