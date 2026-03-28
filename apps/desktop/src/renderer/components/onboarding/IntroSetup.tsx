import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FluidText } from "@/components/satisui/fluid-text";
import { useUIStore } from "../../stores/ui-store.js";

export function IntroSetup() {
  const [gatewayUrl, setGatewayUrl] = useState("http://localhost:3000");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");

  const setOnboarded = useUIStore((s) => s.setOnboarded);
  const setGatewayUrlStore = useUIStore((s) => s.setGatewayUrl);
  const setGatewayTokenStore = useUIStore((s) => s.setGatewayToken);

  const handleLaunch = useCallback(async () => {
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await fetch(`${gatewayUrl}/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setTestResult("success");
        setGatewayUrlStore(gatewayUrl);
        if (token.trim()) setGatewayTokenStore(token.trim());
        setOnboarded(true);
      } else {
        setTestResult("error");
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }, [gatewayUrl, token, setGatewayUrlStore, setGatewayTokenStore, setOnboarded]);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full max-w-sm px-4"
        >
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-5 text-sm font-medium text-muted-foreground">
                Connect to Gateway
              </h2>

              {/* Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!testing && token.trim()) handleLaunch();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label htmlFor="gateway-url" className="text-xs font-medium text-muted-foreground">
                    Gateway URL
                  </label>
                  <Input
                    id="gateway-url"
                    value={gatewayUrl}
                    onChange={(e) => {
                      setGatewayUrl(e.target.value);
                      setTestResult("idle");
                    }}
                    placeholder="http://localhost:3000"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="auth-token" className="text-xs font-medium text-muted-foreground">
                    Auth Token
                  </label>
                  <Input
                    id="auth-token"
                    type="password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setTestResult("idle");
                    }}
                    placeholder="Paste token from gateway console"
                    className="font-mono text-sm"
                  />
                </div>

                {/* Launch (tests connection first) */}
                <Button
                  type="submit"
                  size="default"
                  disabled={testing || !token.trim()}
                  className="mt-2 w-full gap-2"
                >
                  {testing ? (
                    <>
                      <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Launch Hatch
                      <ArrowRightIcon className="size-3.5" />
                    </>
                  )}
                </Button>
              </form>

              <AnimatePresence>
                {testResult === "error" && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-center text-xs text-destructive"
                  >
                    Connection failed — check your URL and token.
                  </motion.p>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

      {/* Footer: Dino + HATCH logo */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4 px-8">
        <motion.img
          src="/images/identity-removebg.png"
          alt="Hatch mascot"
          className="size-40 shrink-0 drop-shadow-md"
          // initial={{ opacity: 0, scale: 0.8 }}
          // animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
          // transition={{
          //   opacity: { duration: 0.5, delay: 0.2 },
          //   scale: { duration: 0.5, delay: 0.2 },
          //   y: { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
          // }}
        />
        <FluidText
          text="HATCH"
          className="text-9xl font-extrabold tracking-widest text-foreground"
          maxScale={3}
          radius={250}
        />
      </div>
    </div>
  );
}
