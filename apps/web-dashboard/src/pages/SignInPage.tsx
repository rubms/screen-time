import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function SignInPage() {
  const { signIn, error } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900">Screen Time Control</h1>
        <p className="mt-2 text-slate-600 text-sm">
          Parent dashboard for managing children&apos;s screen time across Windows
          and Android devices.
        </p>
        <ul className="mt-4 text-left text-sm text-slate-500 space-y-1 list-disc pl-5">
          <li>Set schedules and daily budgets</li>
          <li>Block or limit apps and websites</li>
          <li>Issue temporary unlocks when needed</li>
        </ul>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button className="mt-6 w-full" onClick={() => signIn()}>
          Sign in with Google
        </Button>
      </Card>
    </div>
  );
}
