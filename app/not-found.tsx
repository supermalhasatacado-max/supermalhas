import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>Essa página não está por aqui.</h1>
      <p>Vamos voltar para a loja?</p>
      <Link href="/" className="btn primary">
        Voltar ao início
      </Link>
    </main>
  );
}
