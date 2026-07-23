import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-6 py-10 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,47,73,0.92)_0%,rgba(14,116,144,0.72)_34%,rgba(15,23,42,0.86)_68%,rgba(20,83,45,0.72)_100%)]" />
      <div className="absolute left-0 top-0 h-full w-2/5 bg-cyan-300/10 [clip-path:polygon(0_0,70%_0,100%_100%,0_100%)]" />
      <div className="absolute bottom-0 right-0 h-2/3 w-1/2 bg-emerald-300/10 [clip-path:polygon(28%_0,100%_22%,100%_100%,0_100%)]" />
      <div className="relative">
        <Suspense fallback={<div className="text-slate-100">Giriş ekranı yükleniyor...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
