import { useEffect, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chrome, ShieldCheck } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { GOOGLE_CLIENT_ID } from "@/config/env";

type LocationState = {
  from?: string;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, login, loginWithGoogle, isAuthenticated, isLoading } = useUser();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const state = (location.state as LocationState | null) ?? null;
  const redirectTo = state?.from;

  useEffect(() => {
    if (!isAuthenticated) return;
    const target = redirectTo || (user?.role === 'admin' ? '/admin' : '/dashboard');
    navigate(target, { replace: true });
  }, [isAuthenticated, navigate, redirectTo, user?.role]);

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      const loggedInUser = await login(email, name || undefined);
      toast({
        title: "Logged in",
        description: "Welcome back to OG GAINZ.",
      });
      const target = redirectTo || (loggedInUser.role === 'admin' ? '/admin' : '/dashboard');
      navigate(target, { replace: true });
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredentialLogin = async (credentialResponse: CredentialResponse) => {
    try {
      if (!credentialResponse.credential) {
        throw new Error("Google login did not return an ID token.");
      }

      setSubmitting(true);
      const loggedInUser = await loginWithGoogle(credentialResponse.credential);
      toast({
        title: "Logged in",
        description: "Welcome back to OG GAINZ.",
      });

      const target = redirectTo || (loggedInUser.role === 'admin' ? '/admin' : '/dashboard');
      navigate(target, { replace: true });
    } catch (err) {
      toast({
        title: "Google login failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-oz-neutral/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-oz-primary">OG</span>
            <span className="text-2xl font-extrabold tracking-tight text-oz-accent">GAINZ</span>
          </div>
        </div>

        <Card className="rounded-2xl shadow-lg border-oz-neutral/40">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-oz-primary">Welcome back</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fuel your fitness journey with precision nutrition.
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-3">
              {GOOGLE_CLIENT_ID ? (
                <div className="w-full flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleCredentialLogin}
                    onError={() =>
                      toast({
                        title: "Google login failed",
                        description: "Please try again.",
                        variant: "destructive",
                      })
                    }
                    theme="filled_black"
                    shape="pill"
                    text="continue_with"
                    size="large"
                    width="320"
                    useOneTap={false}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-oz-neutral/50 p-3 text-xs text-muted-foreground">
                  Google Sign-In is not configured. Set <span className="font-mono">VITE_GOOGLE_CLIENT_ID</span> to enable it.
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-oz-neutral/40" />
                <div className="text-xs text-muted-foreground">OR</div>
                <div className="h-px flex-1 bg-oz-neutral/40" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  disabled={submitting || isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Name (optional)</label>
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  disabled={submitting || isLoading}
                />
              </div>

              <Button
                className="w-full bg-oz-accent hover:bg-oz-accent/90 rounded-xl"
                onClick={handleLogin}
                disabled={submitting || isLoading || !email.trim()}
              >
                <Chrome className="h-4 w-4 mr-2" />
                Continue
              </Button>
            </div>

            <div className="pt-1 text-xs text-muted-foreground flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Secure login · Admin access enforced server-side</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}