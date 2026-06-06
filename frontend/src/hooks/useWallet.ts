import { useCallback, useEffect, useState } from "react";
import { connectWallet, hasMetaMask } from "@/lib/wallet";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      return addr;
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts?.[0]?.toLowerCase() ?? null);
    };
    eth.on("accountsChanged", handler);
    return () => eth.removeListener?.("accountsChanged", handler);
  }, []);

  return { address, connect, connecting, hasMetaMask: hasMetaMask() };
}
