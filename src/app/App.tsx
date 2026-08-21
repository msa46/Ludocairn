export function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <p className="wordmark">Deckwright</p>
        <p className="tagline">A local-first tabletop card-game toolkit</p>
      </header>

      <main id="main-content" className="site-main">
        <section className="foundation-card" aria-labelledby="foundation-title">
          <p className="eyebrow">Foundation increment</p>
          <h1 id="foundation-title">Tabletop games, clearly tracked.</h1>
          <p className="lede">
            Define readable games, keep session state on your device, and print
            what the table needs.
          </p>
          <p id="foundation-status" className="status-note" role="status">
            The foundation is ready for the card and game engines.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>Static by design. No account or backend required.</p>
      </footer>
    </div>
  )
}
