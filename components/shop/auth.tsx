"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldCheck, UserRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { browserAuth } from "@/lib/auth/client";
import { safeReturnPath } from "@/lib/auth/config";
import { Header, Footer } from "./shell";
import { Button, ErrorBox, Field } from "./ui";

type Mode = "login" | "signup" | "forgot" | "reset";
export function AuthPage({ returnTo, initialError = "", reset = false }: { returnTo?: string; initialError?: string; reset?: boolean }) {
  const [mode, setMode] = useState<Mode>(reset ? "reset" : "login");
  const [error, setError] = useState(initialError), [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false), [visible, setVisible] = useState(false);
  const destination = safeReturnPath(returnTo);
  function change(value: Mode) { setMode(value); setError(""); setSuccess(""); setVisible(false); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    try {
      const client = browserAuth();
      const callback = `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(destination)}`;
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.code === "email_not_confirmed" ? "Confirme seu e-mail para entrar. Confira também a caixa de spam." : "Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.");
        window.location.assign(destination);
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: callback, data: { full_name: String(form.get("name") || "").trim().slice(0, 150) } } });
        if (error) throw new Error("Não foi possível criar sua conta agora. Confira os dados ou tente novamente mais tarde.");
        if (data.session) window.location.assign(destination);
        else setSuccess("Confira sua caixa de entrada para confirmar o e-mail. Depois, entre para acompanhar seus pedidos.");
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?return_to=/entrar/nova-senha` });
        if (error) throw new Error("Não foi possível enviar o link agora. Aguarde um momento e tente novamente.");
        setSuccess("Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha. Confira também a caixa de spam.");
      } else {
        if (password !== form.get("confirm")) throw new Error("As senhas precisam ser iguais.");
        const { data, error: sessionError } = await client.auth.getUser();
        if (sessionError || !data.user) throw new Error("Esse link expirou. Solicite um novo link em Esqueci minha senha.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw new Error("Não foi possível salvar a senha. Use uma senha diferente, com pelo menos 10 caracteres.");
        window.location.assign("/minha-conta");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }
  const title = { login: "Seu negócio começa aqui.", signup: "Vamos crescer juntos.", forgot: "Recupere seu acesso.", reset: "Uma nova senha para você." }[mode];
  return <><Header /><main id="conteudo" className="container auth-page">
    <div className="auth-intro"><span className="eyebrow"><i /> SUA CONTA SUPER MALHAS</span><h1>Mais facilidade.<br />Mais possibilidades.</h1><p>Acompanhe cada etapa dos seus pedidos e deixe tudo pronto para a próxima compra.</p><div className="auth-benefit"><ShieldCheck size={24} /><span>Seus dados protegidos.<br /><small>Acesso seguro ao histórico e às informações da sua conta.</small></span></div><Link href="/camisetas" className="text-link"><ArrowLeft size={16} /> Continuar explorando a loja</Link></div>
    <section className="auth-card" aria-labelledby="auth-title"><span className="auth-avatar"><UserRound size={26} /></span><h2 id="auth-title">{title}</h2><p>{mode === "login" ? "Entre com seu e-mail e senha para continuar." : mode === "signup" ? "Crie sua conta em poucos passos." : mode === "forgot" ? "Enviaremos um link para você criar uma nova senha." : "Escolha uma senha com pelo menos 10 caracteres."}</p>
      <ErrorBox message={error} />{success ? <div className="notice success" role="status"><CheckCircle2 size={21} /><span>{success}</span></div> : <form onSubmit={submit}>
        {mode === "signup" && <Field label="Seu nome" required><input name="name" autoComplete="name" required maxLength={150} placeholder="Como podemos chamar você?" disabled={busy} /></Field>}
        {mode !== "reset" && <Field label="E-mail" required><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@empresa.com.br" disabled={busy} /></Field>}
        {mode !== "forgot" && <Field label={mode === "reset" ? "Nova senha" : "Senha"} required hint={mode === "signup" ? "Use pelo menos 10 caracteres." : ""}><span className="password-field"><input name="password" type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 10} maxLength={128} placeholder={mode === "login" ? "Digite sua senha" : "Crie uma senha segura"} disabled={busy} /><button type="button" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></Field>}
        {mode === "reset" && <Field label="Confirme a nova senha" required><input name="confirm" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy} /></Field>}
        {mode === "login" && <button className="text-link auth-forgot" type="button" onClick={() => change("forgot")}>Esqueci minha senha</button>}
        <Button busy={busy} type="submit" className="auth-submit">{{login:"Entrar na minha conta",signup:"Criar minha conta",forgot:"Enviar link de recuperação",reset:"Salvar nova senha"}[mode]}<ArrowRight size={18} /></Button>
        {mode === "signup" && <small className="auth-terms">Ao criar sua conta, você concorda com os <Link href="/politicas/termos">Termos de uso</Link> e a <Link href="/politicas/privacidade">Política de privacidade</Link>.</small>}
      </form>}
      <div className="auth-switch">{mode === "login" ? <>Ainda não tem uma conta? <button onClick={() => change("signup")}>Cadastre-se</button></> : <button onClick={() => change("login")}>Voltar para entrar na conta</button>}</div>
    </section></main><Footer /></>;
}
