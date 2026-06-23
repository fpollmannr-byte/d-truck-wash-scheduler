import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Iniciar sesión · Agenda DTS Lavados" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/agenda" });
    });
  }, [navigate]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Sesión iniciada");
    navigate({ to: "/agenda" });
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada. Ya puedes iniciar sesión.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md erp-panel p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-md bg-primary flex items-center justify-center">
            <Truck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Agenda DTS Lavados</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Programación · Camiones</p>
          </div>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">Ingresar</TabsTrigger>
            <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={login} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Correo</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">Ingresar</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signup} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Correo</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña</Label>
                <Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">Crear cuenta</Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
