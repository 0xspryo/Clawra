import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Send, Plus, Copy, Eye, EyeOff, Loader2, Check, AlertCircle, ArrowDownToLine, Download, KeyRound } from "lucide-react";
import type { BalanceResponse, DistributeResponse, WalletInfo, WithdrawResponse } from "@shared/schema";

interface GeneratedWallet {
  publicKey: string;
  privateKey: string;
}

export default function Home() {
  const { toast } = useToast();
  const [network, setNetwork] = useState("mainnet");
  const [sourceWallet, setSourceWallet] = useState<GeneratedWallet | null>(null);
  const [showSourceKey, setShowSourceKey] = useState(false);
  const [walletCount, setWalletCount] = useState(5);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [distributedWallets, setDistributedWallets] = useState<WalletInfo[]>([]);
  const [signatures, setSignatures] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [moreCount, setMoreCount] = useState(5);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [copiedSource, setCopiedSource] = useState<string | null>(null);

  const generateWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generate-wallet");
      return (await res.json()) as GeneratedWallet;
    },
    onSuccess: (data) => {
      setSourceWallet(data);
      setBalance(null);
      setDistributedWallets([]);
      setSignatures([]);
      toast({ title: "Wallet created", description: "Your new developer wallet is ready. Fund it with SOL to get started." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const checkBalanceMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", "/api/balance", { privateKey: key, network });
      return (await res.json()) as BalanceResponse;
    },
    onSuccess: (data) => {
      setBalance(data);
      toast({ title: "Balance fetched", description: `${data.balance} SOL available` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const distributeMutation = useMutation({
    mutationFn: async (params: { privateKey: string; walletCount: number }) => {
      const res = await apiRequest("POST", "/api/distribute", { ...params, network });
      return (await res.json()) as DistributeResponse;
    },
    onSuccess: (data) => {
      setDistributedWallets((prev) => [...prev, ...data.wallets]);
      setSignatures((prev) => [...prev, ...data.signatures]);
      setBalance((prev) => prev ? { ...prev, balance: Math.max(0, prev.balance - data.totalDistributed) } : prev);
      toast({ title: "Distribution complete", description: `${data.totalDistributed.toFixed(6)} SOL sent to ${data.wallets.length} wallets` });
    },
    onError: (err: Error) => {
      toast({ title: "Distribution failed", description: err.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (params: { walletPrivateKeys: string[]; destinationAddress: string }) => {
      const res = await apiRequest("POST", "/api/withdraw", { ...params, network });
      return (await res.json()) as WithdrawResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Withdraw complete",
        description: `${data.totalWithdrawn.toFixed(6)} SOL swept from ${data.walletsSwept} wallets${data.walletsSkipped > 0 ? ` (${data.walletsSkipped} skipped)` : ""}`,
      });
      setDistributedWallets([]);
      setSignatures([]);
      if (sourceWallet) {
        checkBalanceMutation.mutate(sourceWallet.privateKey);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Withdraw failed", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copySourceKey = (key: "public" | "private") => {
    if (!sourceWallet) return;
    const text = key === "public" ? sourceWallet.publicKey : sourceWallet.privateKey;
    navigator.clipboard.writeText(text);
    setCopiedSource(key);
    setTimeout(() => setCopiedSource(null), 2000);
  };

  const exportWallet = () => {
    if (!sourceWallet) return;
    const data = JSON.stringify({
      publicKey: sourceWallet.publicKey,
      privateKey: sourceWallet.privateKey,
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solana-wallet-${sourceWallet.publicKey.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Wallet exported", description: "JSON file downloaded with your wallet keys" });
  };

  const copyAll = () => {
    const text = distributedWallets
      .map((w, i) => `Wallet ${i + 1}:\n  Public: ${w.publicKey}\n  Private: ${w.privateKey}\n  Amount: ${w.amount} SOL`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copied all wallets", description: "All wallet details copied to clipboard" });
  };

  const handleCheckBalance = () => {
    if (!sourceWallet) return;
    checkBalanceMutation.mutate(sourceWallet.privateKey);
  };

  const handleDistribute = () => {
    if (!sourceWallet || !balance) return;
    distributeMutation.mutate({ privateKey: sourceWallet.privateKey, walletCount });
  };

  const handleDistributeMore = () => {
    if (!sourceWallet || !balance) return;
    distributeMutation.mutate({ privateKey: sourceWallet.privateKey, walletCount: moreCount });
  };

  const handleWithdraw = () => {
    if (!withdrawAddress.trim() || distributedWallets.length === 0) return;
    withdrawMutation.mutate({
      walletPrivateKeys: distributedWallets.map((w) => w.privateKey),
      destinationAddress: withdrawAddress.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-primary/10 mb-3">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">
            Solana Wallet Distributor
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Generate a developer wallet, fund it with SOL, and distribute across multiple new wallets.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Developer Wallet
            </CardTitle>
            <Select value={network} onValueChange={(v) => { setNetwork(v); setBalance(null); setDistributedWallets([]); setSignatures([]); }}>
              <SelectTrigger className="w-32" data-testid="select-network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mainnet">Mainnet</SelectItem>
                <SelectItem value="devnet">Devnet</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            {!sourceWallet ? (
              <div className="text-center py-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click below to generate a brand new Solana wallet. You'll be able to export the private key.
                </p>
                <Button
                  data-testid="button-generate-wallet"
                  onClick={() => generateWalletMutation.mutate()}
                  disabled={generateWalletMutation.isPending}
                  size="lg"
                >
                  {generateWalletMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                  ) : (
                    <><Wallet className="w-4 h-4 mr-2" /> Generate New Wallet</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Public Key</Label>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono break-all flex-1 bg-muted/50 rounded-md px-3 py-2" data-testid="text-source-public-key">
                        {sourceWallet.publicKey}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="button-copy-source-public"
                        onClick={() => copySourceKey("public")}
                      >
                        {copiedSource === "public" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Private Key</Label>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono break-all flex-1 bg-muted/50 rounded-md px-3 py-2" data-testid="text-source-private-key">
                        {showSourceKey ? sourceWallet.privateKey : "\u2022".repeat(40)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="button-toggle-source-key"
                        onClick={() => setShowSourceKey(!showSourceKey)}
                      >
                        {showSourceKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="button-copy-source-private"
                        onClick={() => copySourceKey("private")}
                      >
                        {copiedSource === "private" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-export-wallet"
                    onClick={exportWallet}
                  >
                    <Download className="w-3 h-3 mr-1" /> Export Wallet JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-generate-new"
                    onClick={() => {
                      setSourceWallet(null);
                      setBalance(null);
                      setDistributedWallets([]);
                      setSignatures([]);
                      setShowSourceKey(false);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> New Wallet
                  </Button>
                  <Button
                    size="sm"
                    data-testid="button-check-balance"
                    onClick={handleCheckBalance}
                    disabled={checkBalanceMutation.isPending}
                  >
                    {checkBalanceMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Check Balance"
                    )}
                  </Button>
                </div>

                {balance && (
                  <div className="rounded-md bg-muted/50 p-4 space-y-1" data-testid="text-balance-info">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-2xl font-bold tabular-nums">{balance.balance.toFixed(6)} <span className="text-sm font-normal text-muted-foreground">SOL</span></p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {sourceWallet && balance && balance.balance > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" />
                Distribute SOL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wallet-count">Number of wallets to create</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="wallet-count"
                    data-testid="input-wallet-count"
                    type="number"
                    min={1}
                    max={50}
                    value={walletCount}
                    onChange={(e) => setWalletCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="w-24 font-mono"
                  />
                  <span className="text-sm text-muted-foreground">
                    ~{(balance.balance / walletCount).toFixed(6)} SOL each
                  </span>
                </div>
              </div>
              <Button
                data-testid="button-distribute"
                onClick={handleDistribute}
                disabled={distributeMutation.isPending}
                className="w-full"
              >
                {distributeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Distributing...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Distribute to {walletCount} Wallets</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {distributedWallets.length > 0 && (
          <Card>
            <CardHeader className="pb-4 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Generated Wallets ({distributedWallets.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={copyAll} data-testid="button-copy-all">
                <Copy className="w-3 h-3 mr-1" /> Copy All
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {distributedWallets.map((wallet, i) => (
                <div
                  key={i}
                  className="rounded-md border p-3 space-y-2 text-sm"
                  data-testid={`card-wallet-${i}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Wallet {i + 1}</span>
                    <span className="font-bold tabular-nums">{wallet.amount.toFixed(6)} SOL</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground w-12 shrink-0">Public</span>
                      <code className="text-xs font-mono break-all flex-1">{wallet.publicKey}</code>
                      <button
                        data-testid={`button-copy-public-${i}`}
                        onClick={() => copyToClipboard(wallet.publicKey, i * 2)}
                        className="shrink-0 text-muted-foreground"
                      >
                        {copiedIndex === i * 2 ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground w-12 shrink-0">Private</span>
                      <code className="text-xs font-mono break-all flex-1">{wallet.privateKey}</code>
                      <button
                        data-testid={`button-copy-private-${i}`}
                        onClick={() => copyToClipboard(wallet.privateKey, i * 2 + 1)}
                        className="shrink-0 text-muted-foreground"
                      >
                        {copiedIndex === i * 2 + 1 ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4" />
                  Withdraw all back to one wallet
                </p>
                <div className="space-y-2">
                  <Input
                    data-testid="input-withdraw-address"
                    placeholder="Destination wallet address (public key)"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    data-testid="button-withdraw-all"
                    onClick={handleWithdraw}
                    disabled={withdrawMutation.isPending || !withdrawAddress.trim()}
                    variant="destructive"
                    className="w-full"
                  >
                    {withdrawMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sweeping wallets...</>
                    ) : (
                      <><ArrowDownToLine className="w-4 h-4 mr-2" /> Withdraw from all {distributedWallets.length} wallets</>
                    )}
                  </Button>
                </div>
              </div>

              {sourceWallet && balance && balance.balance > 0 && (
                <div className="pt-3 border-t space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Distribute to more wallets
                  </p>
                  <div className="flex gap-2 items-center">
                    <Input
                      data-testid="input-more-count"
                      type="number"
                      min={1}
                      max={50}
                      value={moreCount}
                      onChange={(e) => setMoreCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="w-24 font-mono"
                    />
                    <Button
                      data-testid="button-distribute-more"
                      onClick={handleDistributeMore}
                      disabled={distributeMutation.isPending}
                      variant="outline"
                      className="flex-1"
                    >
                      {distributeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Plus className="w-4 h-4 mr-1" /> Distribute to {moreCount} More</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            This tool connects to Solana {network}. Private keys are generated server-side and never stored. Export your wallet to save it. Use at your own risk.
          </p>
        </div>
      </div>
    </div>
  );
}
